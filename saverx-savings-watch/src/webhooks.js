// Twilio webhooks: delivery status + inbound replies (STOP/START/HELP). Every request must carry a
// valid X-Twilio-Signature; unsigned or forged requests are rejected before touching the database.
import { normalizeUsPhone } from "./validate.js";
import { twilioSignature, safeEqual } from "./twilio.js";

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP"];
const HELP_WORDS = ["HELP", "INFO"];
const RANK = { sending: 0, queued: 1, accepted: 1, sent: 2, delivered: 3 };
const FAILED = ["failed", "undelivered"];

const twiml = (inner = "") => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { status: 200, headers: { "Content-Type": "text/xml" } });

export async function webhooks(ctx, request, url) {
  if (request.method !== "POST" || !["/api/twilio/status", "/api/twilio/inbound"].includes(url.pathname)) return null;
  const { env, store } = ctx;
  if (!env.TWILIO_AUTH_TOKEN) return new Response("Not configured", { status: 503 });

  const text = await request.text();
  if (text.length > 16384) return new Response("Too large", { status: 413 });
  const params = new URLSearchParams(text);
  const expected = await twilioSignature(env.TWILIO_AUTH_TOKEN, ctx.baseUrl + url.pathname, params);
  if (!safeEqual(expected, request.headers.get("X-Twilio-Signature") || "")) return new Response("Forbidden", { status: 403 });

  if (url.pathname === "/api/twilio/status") return status(ctx, params);

  // ---- inbound reply ----
  const phone = normalizeUsPhone(params.get("From") || "");
  const word = (params.get("Body") || "").trim().toUpperCase();
  if (!phone) return twiml();
  const phoneHmac = await ctx.hash("phone", phone);
  const day = ctx.iso().slice(0, 10);

  if (STOP_WORDS.includes(word)) {
    await store.addSuppression(phoneHmac, "stop", ctx.iso());
    await store.withdrawConsents(phoneHmac, ctx.iso());
    await store.addEvent(day, "opted_out", "all");
    return twiml(); // Twilio's Messaging Service opt-out handling sends the confirmation text
  }
  if (START_WORDS.includes(word)) {
    await store.removeSuppression(phoneHmac);
    await store.restoreConsents(phoneHmac);
    return twiml();
  }
  if (HELP_WORDS.includes(word)) {
    return twiml("<Message>SaveRx.ai: savings info you requested. Help: help@saverx.ai. Msg &amp; data rates may apply. Reply STOP to opt out.</Message>");
  }
  return twiml();
}

async function status(ctx, params) {
  const { store } = ctx;
  const sid = params.get("MessageSid") || params.get("SmsSid");
  const next = (params.get("MessageStatus") || params.get("SmsStatus") || "").toLowerCase();
  if (!sid || !next) return twiml();
  const msg = await store.getMessageBySid(sid);
  if (!msg) return twiml(); // unknown sid: acknowledge so Twilio doesn't retry

  const errorCode = params.get("ErrorCode") || null;
  const failed = FAILED.includes(next);
  const cur = msg.status;
  const advance = failed ? !FAILED.includes(cur) && cur !== "delivered" : (RANK[next] ?? -1) > (RANK[cur] ?? -1) && !FAILED.includes(cur);
  if (!advance) return twiml(); // late or out-of-order callback

  await store.updateMessage(msg.id, { status: next, errorCode }, ctx.iso());
  const req = await store.getRequest(msg.request_id);
  const day = ctx.iso().slice(0, 10);
  if (next === "delivered") await store.addEvent(day, "sms_delivered", req.drug_slug);
  if (failed) await store.addEvent(day, "sms_failed", req.drug_slug);
  // 21610 = recipient has opted out at the carrier/Twilio level: honor it on our side too
  if (errorCode === "21610") {
    const phoneHmac = req.phone_hmac;
    await store.addSuppression(phoneHmac, "stop", ctx.iso());
    await store.withdrawConsents(phoneHmac, ctx.iso());
  }
  return twiml();
}
