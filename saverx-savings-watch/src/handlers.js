// Savings Watch public API: POST /api/savings/start and POST /api/savings/verify.
//
// Rules this file enforces (see docs/SAVINGS_WATCH_PLAN.md):
//  - Server-side consent text only; transactional consent is required; Watch consent is separate.
//  - Abuse controls before any Twilio call: origin check, honeypot, Turnstile, per-IP + per-phone limits.
//  - Responses never echo phone numbers. No PII in events/analytics.

import { normalizeUsPhone, isValidSlug, isValidCode } from "./validate.js";
import { hmacHex, randomId } from "./crypto.js";
import { CONSENT_VERSION, CONSENT_TEXTS } from "./consent.js";
import { verifyTurnstile } from "./turnstile.js";

const MAX_BODY = 4096;
const HOUR = 3600;
const DEDUPE_DAYS = 30;
const LIMITS = { startPerIp: 5, startPerPhone: 3, verifyPerIp: 20, maxVerifyAttempts: 5 };

export function createApp({ store, twilio, env, now = () => Date.now(), fetchFn = fetch }) {
  const origins = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const pilot = (env.PILOT_SLUGS || "repatha").split(",").map((s) => s.trim());
  const iso = () => new Date(now()).toISOString();
  const bucket = (seconds) => Math.floor(now() / 1000 / seconds);

  function cors(request) {
    const o = request.headers.get("Origin");
    const h = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    if (o && origins.includes(o)) {
      h["Access-Control-Allow-Origin"] = o;
      h["Vary"] = "Origin";
      h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
      h["Access-Control-Allow-Headers"] = "Content-Type";
    }
    return h;
  }
  const reply = (request, status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(request) } });
  const fail = (request, status, error, message) => reply(request, status, { error, message });

  async function readJson(request) {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    try { const v = JSON.parse(text); return v && typeof v === "object" ? v : null; } catch { return null; }
  }

  async function limited(name, id, max, seconds) {
    return (await store.hit(`${name}:${id}:${bucket(seconds)}`)) > max;
  }

  async function start(request, ip) {
    const body = await readJson(request);
    if (!body) return fail(request, 400, "bad_request", "Invalid request.");
    if (body.hp) return reply(request, 200, { ok: true }); // honeypot: pretend success, do nothing

    const slug = String(body.drug_slug || "").toLowerCase();
    if (!isValidSlug(slug) || !pilot.includes(slug)) return fail(request, 400, "unsupported_drug", "This medication isn't available yet.");
    const phone = normalizeUsPhone(body.phone);
    if (!phone) return fail(request, 400, "invalid_phone", "Enter a valid US mobile number.");
    if (body.consent_transactional !== true) return fail(request, 400, "consent_required", "Please agree to receive a text message.");

    const texts = CONSENT_TEXTS[CONSENT_VERSION];
    const ipHash = await hmacHex(env.HMAC_KEY, "ip:" + ip);
    if (await limited("start-ip", ipHash, LIMITS.startPerIp, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");
    if (!(await verifyTurnstile({ env, token: body.turnstile_token, ip, fetchFn }))) return fail(request, 400, "bot_check_failed", "Verification check failed. Please retry.");

    const phoneHmac = await hmacHex(env.HMAC_KEY, "phone:" + phone);
    if (await limited("start-phone", phoneHmac, LIMITS.startPerPhone, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");
    if (await store.isSuppressed(phoneHmac)) {
      return fail(request, 409, "opted_out", "This number opted out of texts. Reply START to our last text to rejoin.");
    }

    // Duplicate request (same phone + medication within 30 days): reuse it, just resend the code.
    const since = new Date(now() - DEDUPE_DAYS * 86400 * 1000).toISOString();
    let existing = await store.findRecentRequest(phoneHmac, slug, since);
    let id;
    if (existing) {
      id = existing.id;
      if (existing.status !== "new") return reply(request, 200, { ok: true, request_id: id, already_verified: true });
    } else {
      id = randomId();
      await store.createRequest({
        id, drug_slug: slug, phone_hmac: phoneHmac, phone_e164: phone, status: "new",
        ip_hash: ipHash, source_page: String(body.source_page || "").slice(0, 200), created_at: iso(),
      });
      const ua = (request.headers.get("User-Agent") || "").slice(0, 200);
      const types = body.consent_watch === true ? ["transactional", "watch"] : ["transactional"];
      for (const type of types) {
        await store.addConsent({
          id: randomId(), request_id: id, type, text_version: CONSENT_VERSION,
          text_shown: texts[type], checked_at: iso(), ip_hash: ipHash, user_agent: ua,
        });
      }
      await store.addEvent(iso().slice(0, 10), "signup_started", slug);
    }

    const sent = await twilio.startVerification(phone);
    if (!sent.ok) return fail(request, 502, "sms_unavailable", "We couldn't send the code. Please try again.");
    return reply(request, 200, { ok: true, request_id: id });
  }

  async function verify(request, ip) {
    const body = await readJson(request);
    if (!body) return fail(request, 400, "bad_request", "Invalid request.");
    if (typeof body.request_id !== "string" || !isValidCode(body.code)) return fail(request, 400, "invalid_code", "Enter the code we texted you.");

    const ipHash = await hmacHex(env.HMAC_KEY, "ip:" + ip);
    if (await limited("verify-ip", ipHash, LIMITS.verifyPerIp, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");

    const req = await store.getRequest(body.request_id);
    if (!req) return fail(request, 404, "not_found", "Request not found.");
    if (req.status !== "new") return reply(request, 200, { ok: true, verified: true });

    const attempts = await store.bumpVerifyAttempts(req.id);
    if (attempts > LIMITS.maxVerifyAttempts) return fail(request, 429, "too_many_attempts", "Too many incorrect codes. Please start again.");

    const check = await twilio.checkVerification(req.phone_e164, body.code);
    if (check.status !== "approved") return fail(request, 400, "wrong_code", "That code didn't match. Please try again.");

    await store.markVerified(req.id, iso());
    await store.addEvent(iso().slice(0, 10), "phone_verified", req.drug_slug);
    return reply(request, 200, { ok: true, verified: true });
  }

  return async function handle(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
    if (request.method === "GET" && url.pathname === "/api/savings/health") return reply(request, 200, { ok: true, service: "savings-watch-v1" });
    if (request.method !== "POST") return fail(request, 405, "method_not_allowed", "Method not allowed.");

    // Browser POSTs must come from our own site (blocks casual cross-site abuse; not a security boundary alone)
    const origin = request.headers.get("Origin");
    if (!origin || !origins.includes(origin)) return fail(request, 403, "forbidden_origin", "Forbidden.");

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    try {
      if (url.pathname === "/api/savings/start") return await start(request, ip);
      if (url.pathname === "/api/savings/verify") return await verify(request, ip);
    } catch (err) {
      console.error("savings error", err && err.message); // message only: never log request bodies/phones
      return fail(request, 500, "server_error", "Something went wrong. Please try again.");
    }
    return fail(request, 404, "not_found", "Not found.");
  };
}
