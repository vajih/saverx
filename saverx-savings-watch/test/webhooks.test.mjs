import test from "node:test";
import assert from "node:assert/strict";
import { setup, E164 } from "./helpers.js";
import { twilioSignature } from "../src/twilio.js";

const AUTH = "test-auth-token";
async function hook(t, path, fields, { sign = true, badSig = false } = {}) {
  const params = new URLSearchParams(fields);
  const sig = badSig ? "forged" : await twilioSignature(AUTH, "https://saverx.ai" + path, params);
  return t.app(new Request("https://saverx.ai" + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(sign ? { "X-Twilio-Signature": sig } : {}) },
    body: params.toString(),
  }));
}
const inbound = (t, Body, opts) => hook(t, "/api/twilio/inbound", { From: E164, Body }, opts);

async function sentMessage(t) {
  const id = await t.verified();
  await t.post(`/api/admin/requests/${id}/result`, {
    verified: true, source_note: "checked",
    content: { headline: "H", checked_at: "2026-11-15", items: [{ title: "T", text: "X", url: "https://example.com" }] },
  });
  await t.post(`/api/admin/requests/${id}/send`, {});
  return { id, sid: t.q("SELECT twilio_sid FROM messages")[0].twilio_sid };
}

test("forged, missing, or unconfigured signatures are rejected before any DB change", async () => {
  const t = setup();
  assert.equal((await inbound(t, "STOP", { sign: false })).status, 403);
  assert.equal((await inbound(t, "STOP", { badSig: true })).status, 403);
  assert.equal(t.q("SELECT * FROM suppression").length, 0);
  const none = setup({ env: { TWILIO_AUTH_TOKEN: "" } });
  assert.equal((await inbound(none, "STOP")).status, 503);
});

test("STOP suppresses the number, withdraws consent, and blocks later sends", async () => {
  const t = setup();
  const { id } = await sentMessage(t);
  assert.equal((await inbound(t, " stop ")).status, 200);
  assert.equal(t.q("SELECT * FROM suppression").length, 1);
  assert.ok(t.q("SELECT withdrawn_at FROM consents").every((c) => c.withdrawn_at));
  assert.equal(t.q("SELECT count FROM events WHERE name='opted_out'")[0].count, 1);
  const r = await t.post(`/api/admin/requests/${id}/send`, {});
  assert.equal(r.status, 409);
  // and a fresh sign-up from the same number is refused too
  assert.equal((await t.start()).status, 409);
});

test("every STOP keyword works; unrelated words do nothing", async () => {
  for (const w of ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]) {
    const t = setup();
    await inbound(t, w);
    assert.equal(t.q("SELECT * FROM suppression").length, 1, w);
  }
  const t = setup();
  await inbound(t, "thanks!");
  assert.equal(t.q("SELECT * FROM suppression").length, 0);
});

test("START restores messaging after STOP", async () => {
  const t = setup();
  const { id } = await sentMessage(t);
  await inbound(t, "STOP");
  await inbound(t, "START");
  assert.equal(t.q("SELECT * FROM suppression").length, 0);
  assert.ok(t.q("SELECT withdrawn_at FROM consents").every((c) => c.withdrawn_at === null));
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 200);
});

test("HELP replies with contact info and STOP instructions", async () => {
  const t = setup();
  const res = await inbound(t, "HELP");
  const xml = await res.text();
  assert.match(xml, /<Message>/);
  assert.match(xml, /STOP/);
  assert.match(xml, /help@saverx\.ai/);
});

test("delivery status: queued -> sent -> delivered, with out-of-order callbacks ignored", async () => {
  const t = setup();
  const { sid } = await sentMessage(t);
  const status = (MessageStatus, extra = {}) => hook(t, "/api/twilio/status", { MessageSid: sid, MessageStatus, ...extra });
  await status("sent");
  assert.equal(t.q("SELECT status FROM messages")[0].status, "sent");
  await status("delivered");
  assert.equal(t.q("SELECT status FROM messages")[0].status, "delivered");
  await status("sent"); // late callback must not downgrade
  assert.equal(t.q("SELECT status FROM messages")[0].status, "delivered");
  assert.equal(t.q("SELECT count FROM events WHERE name='sms_delivered'")[0].count, 1);
  await status("delivered"); // duplicate callback not double counted
  assert.equal(t.q("SELECT count FROM events WHERE name='sms_delivered'")[0].count, 1);
});

test("delivery failure is recorded with the error code", async () => {
  const t = setup();
  const { sid } = await sentMessage(t);
  await hook(t, "/api/twilio/status", { MessageSid: sid, MessageStatus: "undelivered", ErrorCode: "30003" });
  const m = t.q("SELECT status, error_code FROM messages")[0];
  assert.equal(m.status, "undelivered");
  assert.equal(m.error_code, "30003");
  assert.equal(t.q("SELECT count FROM events WHERE name='sms_failed'")[0].count, 1);
});

test("error 21610 (recipient opted out) suppresses the number", async () => {
  const t = setup();
  const { sid } = await sentMessage(t);
  await hook(t, "/api/twilio/status", { MessageSid: sid, MessageStatus: "failed", ErrorCode: "21610" });
  assert.equal(t.q("SELECT * FROM suppression").length, 1);
});

test("unknown message SID is acknowledged without error", async () => {
  const t = setup();
  const res = await hook(t, "/api/twilio/status", { MessageSid: "SMnope", MessageStatus: "delivered" });
  assert.equal(res.status, 200);
});
