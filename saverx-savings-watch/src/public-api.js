// Public visitor API: consent text, start, verify, outcome.
import { normalizeUsPhone, isValidSlug, isValidCode } from "./validate.js";
import { CONSENT_VERSION, CONSENT_TEXTS } from "./consent.js";
import { verifyTurnstile } from "./turnstile.js";

const HOUR = 3600;
const DEDUPE_DAYS = 30;
const LIMITS = { startPerIp: 5, startPerPhone: 3, verifyPerIp: 20, maxVerifyAttempts: 5, outcomePerIp: 30 };
export const OUTCOMES = ["worked", "not_worked", "need_help"];

export async function publicApi(ctx, request, url) {
  const { pathname } = url;
  if (!pathname.startsWith("/api/savings/")) return null;
  const { reply, fail } = ctx;

  if (request.method === "GET" && pathname === "/api/savings/health") return reply(request, 200, { ok: true, service: "savings-watch-v1" });
  if (request.method === "GET" && pathname === "/api/savings/consent") {
    return reply(request, 200, { version: CONSENT_VERSION, texts: CONSENT_TEXTS[CONSENT_VERSION] });
  }
  if (request.method !== "POST") return fail(request, 405, "method_not_allowed", "Method not allowed.");
  // Browser POSTs must come from our own site (blocks casual cross-site abuse; not a security boundary alone)
  if (!ctx.originOk(request)) return fail(request, 403, "forbidden_origin", "Forbidden.");

  if (pathname === "/api/savings/start") return start(ctx, request);
  if (pathname === "/api/savings/verify") return verify(ctx, request);
  if (pathname === "/api/savings/outcome") return outcome(ctx, request);
  return null;
}

async function start(ctx, request) {
  const { reply, fail, store, env } = ctx;
  const body = await ctx.readJson(request);
  if (!body) return fail(request, 400, "bad_request", "Invalid request.");
  if (body.hp) return reply(request, 200, { ok: true }); // honeypot: pretend success, do nothing

  const slug = String(body.drug_slug || "").toLowerCase();
  if (!isValidSlug(slug) || !ctx.pilot.includes(slug)) return fail(request, 400, "unsupported_drug", "This medication isn't available yet.");
  const phone = normalizeUsPhone(body.phone);
  if (!phone) return fail(request, 400, "invalid_phone", "Enter a valid US mobile number.");
  if (body.consent_transactional !== true) return fail(request, 400, "consent_required", "Please agree to receive a text message.");

  const texts = CONSENT_TEXTS[CONSENT_VERSION];
  const ip = ctx.ipOf(request);
  const ipHash = await ctx.hash("ip", ip);
  if (await ctx.limited("start-ip", ipHash, LIMITS.startPerIp, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");
  if (!(await verifyTurnstile({ env, token: body.turnstile_token, ip, fetchFn: ctx.fetchFn }))) return fail(request, 400, "bot_check_failed", "Verification check failed. Please retry.");

  const phoneHmac = await ctx.hash("phone", phone);
  if (await ctx.limited("start-phone", phoneHmac, LIMITS.startPerPhone, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");
  if (await store.isSuppressed(phoneHmac)) {
    return fail(request, 409, "opted_out", "This number opted out of texts. Reply START to our last text to rejoin.");
  }

  // Duplicate request (same phone + medication within 30 days): reuse it, just resend the code.
  const since = new Date(ctx.now() - DEDUPE_DAYS * 86400 * 1000).toISOString();
  const existing = await store.findRecentRequest(phoneHmac, slug, since);
  let id;
  if (existing) {
    id = existing.id;
    if (existing.status !== "new") return reply(request, 200, { ok: true, request_id: id, already_verified: true });
  } else {
    id = ctx.id();
    await store.createRequest({
      id, drug_slug: slug, phone_hmac: phoneHmac, phone_e164: phone, status: "new",
      ip_hash: ipHash, source_page: String(body.source_page || "").slice(0, 200), created_at: ctx.iso(),
    });
    const ua = (request.headers.get("User-Agent") || "").slice(0, 200);
    for (const type of body.consent_watch === true ? ["transactional", "watch"] : ["transactional"]) {
      await store.addConsent({
        id: ctx.id(), request_id: id, type, text_version: CONSENT_VERSION,
        text_shown: texts[type], checked_at: ctx.iso(), ip_hash: ipHash, user_agent: ua,
      });
    }
    await store.addEvent(ctx.iso().slice(0, 10), "signup_started", slug);
  }

  const sent = await ctx.twilio.startVerification(phone);
  if (!sent.ok) return fail(request, 502, "sms_unavailable", "We couldn't send the code. Please try again.");
  return reply(request, 200, { ok: true, request_id: id });
}

async function verify(ctx, request) {
  const { reply, fail, store } = ctx;
  const body = await ctx.readJson(request);
  if (!body) return fail(request, 400, "bad_request", "Invalid request.");
  if (typeof body.request_id !== "string" || !isValidCode(body.code)) return fail(request, 400, "invalid_code", "Enter the code we texted you.");

  const ipHash = await ctx.hash("ip", ctx.ipOf(request));
  if (await ctx.limited("verify-ip", ipHash, LIMITS.verifyPerIp, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts. Try again later.");

  const req = await store.getRequest(body.request_id);
  if (!req) return fail(request, 404, "not_found", "Request not found.");
  if (req.status !== "new") return reply(request, 200, { ok: true, verified: true });

  const attempts = await store.bumpVerifyAttempts(req.id);
  if (attempts > LIMITS.maxVerifyAttempts) return fail(request, 429, "too_many_attempts", "Too many incorrect codes. Please start again.");

  const check = await ctx.twilio.checkVerification(req.phone_e164, body.code);
  if (check.status !== "approved") return fail(request, 400, "wrong_code", "That code didn't match. Please try again.");

  await store.markVerified(req.id, ctx.iso());
  await store.addEvent(ctx.iso().slice(0, 10), "phone_verified", req.drug_slug);
  return reply(request, 200, { ok: true, verified: true });
}

async function outcome(ctx, request) {
  const { reply, fail, store } = ctx;
  const body = await ctx.readJson(request);
  if (!body || !OUTCOMES.includes(body.outcome) || typeof body.token !== "string") return fail(request, 400, "bad_request", "Invalid request.");
  const ipHash = await ctx.hash("ip", ctx.ipOf(request));
  if (await ctx.limited("outcome-ip", ipHash, LIMITS.outcomePerIp, HOUR)) return fail(request, 429, "rate_limited", "Too many attempts.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(body.token)) return fail(request, 404, "not_found", "Not found.");
  const row = await store.getResultByTokenHash(await ctx.hash("token", body.token));
  if (!row || !row.expires_at || row.expires_at <= ctx.iso()) return fail(request, 404, "not_found", "Not found.");
  const req = await store.getRequest(row.request_id);
  await store.setOutcome(row.id, body.outcome, ctx.iso());
  await store.addEvent(ctx.iso().slice(0, 10), "outcome_" + body.outcome, req.drug_slug);
  return reply(request, 200, { ok: true });
}
