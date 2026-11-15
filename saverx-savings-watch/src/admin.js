// Admin workflow (protected by Cloudflare Access + JWT check): review verified requests, prepare a
// verified result, preview it, then send the text. The link token is created at SEND time and only
// its hash is stored.
import { adminEmail } from "./access.js";
import { validateContent } from "./content.js";
import { withinSendWindow } from "./twilio.js";
import { renderResult, pageHeaders } from "./result-page.js";
import { adminPageHtml } from "./admin-html.js";

const LINK_DAYS = 14;
const MAX_SENDS = 3;
const STATUSES = ["new", "verified", "ready", "sent", "closed"];

const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function adminRoutes(ctx, request, url) {
  const { pathname } = url;
  const isPage = pathname === "/admin/savings" || pathname.startsWith("/admin/savings/");
  if (!isPage && !pathname.startsWith("/api/admin/")) return null;
  const { reply, fail, store } = ctx;

  const email = await adminEmail(ctx, request);
  if (!email) return isPage ? new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } }) : fail(request, 401, "unauthorized", "Unauthorized.");
  if (request.method === "POST" && !ctx.originOk(request)) return fail(request, 403, "forbidden_origin", "Forbidden.");

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));
  if (request.method === "GET" && pathname === "/admin/savings") {
    return new Response(adminPageHtml(nonce), { headers: pageHeaders(nonce) });
  }
  const preview = pathname.match(/^\/admin\/savings\/preview\/([\w-]+)$/);
  if (request.method === "GET" && preview) {
    const row = await store.getResult(preview[1]);
    if (!row) return new Response("Not found", { status: 404 });
    return new Response(renderResult({ content: JSON.parse(row.content_json), nonce, preview: true }), { headers: pageHeaders(nonce) });
  }

  if (request.method === "GET" && pathname === "/api/admin/stats") return reply(request, 200, await store.stats());
  if (request.method === "GET" && pathname === "/api/admin/requests") {
    const status = url.searchParams.get("status");
    if (status && !STATUSES.includes(status)) return fail(request, 400, "bad_request", "Unknown status.");
    return reply(request, 200, { requests: await store.listRequests(status || null) });
  }

  const m = pathname.match(/^\/api\/admin\/requests\/([\w-]+)(?:\/(result|send))?$/);
  if (!m) return fail(request, 404, "not_found", "Not found.");
  const req = await store.getRequest(m[1]);
  if (!req) return fail(request, 404, "not_found", "Request not found.");

  if (request.method === "GET" && !m[2]) {
    const result = await store.latestResult(req.id);
    return reply(request, 200, {
      request: { id: req.id, drug_slug: req.drug_slug, status: req.status, created_at: req.created_at, verified_at: req.verified_at, phone_last4: (req.phone_e164 || "").slice(-4) },
      result: result && { id: result.id, content: JSON.parse(result.content_json), source_note: result.source_note, verified_by: result.verified_by, verified_at: result.verified_at, sent: !!result.token_hash, expires_at: result.expires_at, viewed_at: result.viewed_at, outcome: result.outcome },
      messages: await store.messagesForRequest(req.id),
    });
  }

  if (request.method === "POST" && m[2] === "result") return saveResult(ctx, request, req, email);
  if (request.method === "POST" && m[2] === "send") return send(ctx, request, req);
  return fail(request, 405, "method_not_allowed", "Method not allowed.");
}

async function saveResult(ctx, request, req, email) {
  const { fail, reply, store } = ctx;
  if (!["verified", "ready", "sent"].includes(req.status)) return fail(request, 409, "not_verified", "Phone number isn't verified yet.");
  const body = await ctx.readJson(request);
  if (!body) return fail(request, 400, "bad_request", "Invalid request.");
  if (body.verified !== true) return fail(request, 400, "verification_required", "Confirm that you verified this information on the official sources.");
  const note = typeof body.source_note === "string" ? body.source_note.trim() : "";
  if (!note || note.length > 300) return fail(request, 400, "source_note_required", "Describe what you verified and where (max 300 characters).");
  const v = validateContent(body.content);
  if (v.error) return fail(request, 400, "invalid_content", v.error);

  const id = ctx.id();
  await store.createResult({ id, request_id: req.id, content_json: JSON.stringify(v.value), source_note: note, verified_by: email, verified_at: ctx.iso(), created_at: ctx.iso() });
  if (req.status === "verified") await store.setRequestStatus(req.id, "ready");
  return reply(request, 200, { ok: true, result_id: id, preview_url: `/admin/savings/preview/${id}` });
}

async function send(ctx, request, req) {
  const { fail, reply, store, twilio, env } = ctx;
  if (!["verified", "ready", "sent"].includes(req.status)) return fail(request, 409, "not_verified", "Phone number isn't verified yet.");
  if (!req.phone_e164) return fail(request, 409, "phone_purged", "The phone number was already deleted under the retention policy.");
  const result = await store.latestResult(req.id);
  if (!result) return fail(request, 409, "no_result", "Save a verified result first.");
  if (!(await store.consentActive(req.id, "transactional"))) return fail(request, 409, "no_consent", "No active text-message consent for this request.");
  if (await store.isSuppressed(await ctx.hash("phone", req.phone_e164))) return fail(request, 409, "opted_out", "This number has opted out.");
  if (env.ALLOW_ANY_HOUR !== "true" && !withinSendWindow(ctx.now())) return fail(request, 409, "quiet_hours", "Outside the 11am-9pm ET send window. Try again later.");
  if ((await store.countMessages(req.id)) >= MAX_SENDS) return fail(request, 429, "send_limit", "Send limit reached for this request.");

  const token = randomToken();
  const link = `${ctx.baseUrl}/r/${token}`;
  // No medication name or health information in the SMS body.
  const body = `SaveRx: Your savings info is ready: ${link} (expires in ${LINK_DAYS} days). Reply STOP to opt out, HELP for help.`;
  const msgId = ctx.id();
  await store.createMessage({ id: msgId, request_id: req.id, result_id: result.id, status: "sending", created_at: ctx.iso() });
  const sent = await twilio.sendMessage(req.phone_e164, body);
  const day = ctx.iso().slice(0, 10);
  if (!sent.ok) {
    await store.updateMessage(msgId, { status: "failed", errorCode: sent.code }, ctx.iso());
    await store.addEvent(day, "sms_failed", req.drug_slug);
    return fail(request, 502, "send_failed", "Twilio couldn't send the message.");
  }
  // Sending again rotates the token, so any earlier link stops working.
  await store.setResultToken(result.id, await ctx.hash("token", token), new Date(ctx.now() + LINK_DAYS * 86400000).toISOString());
  await store.updateMessage(msgId, { sid: sent.sid, status: sent.status || "queued" }, ctx.iso());
  await store.setRequestStatus(req.id, "sent");
  await store.addEvent(day, "sms_sent", req.drug_slug);
  // The link is deliberately not returned: only the recipient's phone receives it (dev: see mock log).
  return reply(request, 200, { ok: true, status: sent.status || "queued" });
}
