import test from "node:test";
import assert from "node:assert/strict";
import { setup, ORIGIN } from "./helpers.js";
import { verifyAccessJwt } from "../src/access.js";

const content = (over = {}) => ({
  headline: "Savings options for Repatha", summary: "Here is what we found.", eligibility: "Commercial insurance only.",
  checked_at: "2026-11-15",
  items: [{ title: "Co-pay card", text: "May reduce your cost.", url: "https://www.repatha.com/enrollment", terms_url: "https://www.repatha.com/copaytcs" }],
  sources: [{ label: "Repatha cost", url: "https://www.repatha.com/repatha-cost" }],
  ...over,
});
const resultBody = (over = {}) => ({ verified: true, source_note: "Checked repatha.com on 2026-11-15", content: content(), ...over });
const j = (r) => r.json();

async function readyRequest(t) {
  const id = await t.verified();
  const r = await t.post(`/api/admin/requests/${id}/result`, resultBody());
  assert.equal(r.status, 200);
  return id;
}
const linkFromSms = (t) => t.twilio.calls.filter((c) => c.op === "send").pop().body.match(/https:\/\/saverx\.ai\/r\/([\w-]{43})/);

test("admin routes require authentication", async () => {
  const t = setup({ env: { ADMIN_DEV_EMAIL: "", ENVIRONMENT: "production" } });
  assert.equal((await t.call("GET", "/api/admin/requests")).status, 401);
  assert.equal((await t.call("GET", "/api/admin/stats")).status, 401);
  assert.equal((await t.call("GET", "/admin/savings")).status, 401);
  assert.equal((await t.post("/api/admin/requests/x/send", {})).status, 401);
});

test("dev bypass is ignored outside ENVIRONMENT=dev", async () => {
  const t = setup({ env: { ENVIRONMENT: "production", ADMIN_DEV_EMAIL: "admin@example.test" } });
  assert.equal((await t.call("GET", "/api/admin/requests")).status, 401);
});

test("admin page and list never expose full phone numbers", async () => {
  const t = setup();
  await t.verified();
  const page = await t.call("GET", "/admin/savings");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("Content-Security-Policy"), /default-src 'none'/);
  const list = await j(await t.call("GET", "/api/admin/requests?status=verified"));
  assert.equal(list.requests.length, 1);
  assert.equal(list.requests[0].phone_last4, "0100");
  assert.ok(!JSON.stringify(list).includes("415"));
});

test("saving a result requires the verification checkbox, a source note and valid content", async () => {
  const t = setup();
  const id = await t.verified();
  const path = `/api/admin/requests/${id}/result`;
  assert.equal((await t.post(path, resultBody({ verified: false }))).status, 400);
  assert.equal((await t.post(path, resultBody({ source_note: " " }))).status, 400);
  assert.equal((await t.post(path, resultBody({ content: content({ items: [{ title: "x", text: "y", url: "http://insecure.example" }] }) }))).status, 400);
  assert.equal((await t.post(path, resultBody({ content: content({ items: [{ title: "x", text: "y", url: "javascript:alert(1)" }] }) }))).status, 400);
  assert.equal((await t.post(path, resultBody({ content: content({ checked_at: "yesterday" }) }))).status, 400);
  assert.equal((await t.post(path, resultBody({ content: content({ headline: "" }) }))).status, 400);
  assert.equal(t.q("SELECT * FROM results").length, 0);
  assert.equal((await t.post(path, resultBody())).status, 200);
  assert.equal(t.q("SELECT status FROM requests")[0].status, "ready");
});

test("results cannot be saved or sent for unverified phone numbers", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  assert.equal((await t.post(`/api/admin/requests/${request_id}/result`, resultBody())).status, 409);
  assert.equal((await t.post(`/api/admin/requests/${request_id}/send`, {})).status, 409);
  assert.equal(t.twilio.calls.filter((c) => c.op === "send").length, 0);
});

test("send: SMS has link + STOP language and NO medication name; link works then expires", async () => {
  let ms = Date.UTC(2026, 10, 15, 17, 0, 0);
  const t = setup({ clock: () => ms });
  const id = await readyRequest(t);
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 200);
  const sms = t.twilio.calls.filter((c) => c.op === "send").pop();
  assert.match(sms.body, /STOP/);
  assert.ok(!/repatha|evolocumab|amgen|cholesterol/i.test(sms.body));
  assert.ok(sms.body.length < 160);
  assert.equal(t.q("SELECT status FROM requests")[0].status, "sent");
  assert.equal(t.q("SELECT status FROM messages")[0].status, "queued");

  const token = linkFromSms(t)[1];
  const page = await t.call("GET", `/r/${token}`, undefined, { origin: null });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Savings options for Repatha/);
  assert.match(html, /utm_source=saverx/);
  assert.equal(page.headers.get("Cache-Control"), "no-store");
  assert.match(page.headers.get("X-Robots-Tag"), /noindex/);
  assert.equal(t.q("SELECT count FROM events WHERE name='result_viewed'")[0].count, 1);
  await t.call("GET", `/r/${token}`, undefined, { origin: null });
  assert.equal(t.q("SELECT count FROM events WHERE name='result_viewed'")[0].count, 1); // counted once

  ms += 14 * 86400000 + 1000;
  const expired = await t.call("GET", `/r/${token}`, undefined, { origin: null });
  assert.equal(expired.status, 410);
  assert.ok(!(await expired.text()).includes("Savings options"));
});

test("only the token hash is stored; unknown or malformed tokens 404", async () => {
  const t = setup();
  const id = await readyRequest(t);
  await t.post(`/api/admin/requests/${id}/send`, {});
  const token = linkFromSms(t)[1];
  assert.ok(!JSON.stringify(t.q("SELECT * FROM results")).includes(token));
  for (const bad of ["short", "x".repeat(43), "../etc/passwd"]) assert.equal((await t.call("GET", `/r/${bad}`, undefined, { origin: null })).status, 404);
});

test("result page escapes HTML in admin-entered content", async () => {
  const t = setup();
  const id = await t.verified();
  await t.post(`/api/admin/requests/${id}/result`, resultBody({ content: content({ headline: "<script>alert(1)</script>", items: [{ title: "<img src=x onerror=1>", text: "a&b", url: "https://example.com/?a=1&b=2" }] }) }));
  await t.post(`/api/admin/requests/${id}/send`, {});
  const html = await (await t.call("GET", `/r/${linkFromSms(t)[1]}`, undefined, { origin: null })).text();
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&lt;script&gt;/);
});

test("sending again rotates the token: the old link stops working", async () => {
  const t = setup();
  const id = await readyRequest(t);
  await t.post(`/api/admin/requests/${id}/send`, {});
  const first = linkFromSms(t)[1];
  await t.post(`/api/admin/requests/${id}/send`, {});
  const second = linkFromSms(t)[1];
  assert.notEqual(first, second);
  assert.equal((await t.call("GET", `/r/${first}`, undefined, { origin: null })).status, 404);
  assert.equal((await t.call("GET", `/r/${second}`, undefined, { origin: null })).status, 200);
});

test("send is blocked for opted-out numbers and after consent withdrawal", async () => {
  const t = setup();
  const id = await readyRequest(t);
  await t.store.addSuppression(await t.phoneHmac(), "stop", new Date().toISOString());
  const r = await t.post(`/api/admin/requests/${id}/send`, {});
  assert.equal(r.status, 409);
  assert.equal((await j(r)).error, "opted_out");
  await t.store.removeSuppression(await t.phoneHmac());
  await t.store.withdrawConsents(await t.phoneHmac(), new Date().toISOString());
  assert.equal((await j(await t.post(`/api/admin/requests/${id}/send`, {}))).error, "no_consent");
  assert.equal(t.twilio.calls.filter((c) => c.op === "send").length, 0);
});

test("quiet hours block sends unless ALLOW_ANY_HOUR (test-only) is set", async () => {
  const night = Date.UTC(2026, 10, 15, 6, 0, 0); // 1am ET
  const t = setup({ env: { ALLOW_ANY_HOUR: "false" }, clock: () => night });
  const id = await readyRequest(t);
  assert.equal((await j(await t.post(`/api/admin/requests/${id}/send`, {}))).error, "quiet_hours");
  // Noon ET is outside the window too: 8am Hawaii time is 2pm ET in daylight time.
  const noon = setup({ env: { ALLOW_ANY_HOUR: "false" }, clock: () => Date.UTC(2026, 10, 15, 17, 0, 0) });
  const id2 = await readyRequest(noon);
  assert.equal((await j(await noon.post(`/api/admin/requests/${id2}/send`, {}))).error, "quiet_hours");
  const twoPm = setup({ env: { ALLOW_ANY_HOUR: "false" }, clock: () => Date.UTC(2026, 10, 15, 19, 0, 0) }); // 2pm ET
  const id3 = await readyRequest(twoPm);
  assert.equal((await twoPm.post(`/api/admin/requests/${id3}/send`, {})).status, 200);
});

test("SMS provider failure is recorded, not counted, and sets no token", async () => {
  const t = setup();
  const id = await readyRequest(t);
  t.twilio.sendMessage = async () => ({ ok: false, code: "30007" });
  const r = await t.post(`/api/admin/requests/${id}/send`, {});
  assert.equal(r.status, 502);
  assert.equal(t.q("SELECT status, error_code FROM messages")[0].error_code, "30007");
  assert.equal(t.q("SELECT token_hash FROM results")[0].token_hash, null);
  assert.equal(t.q("SELECT status FROM requests")[0].status, "ready");
  assert.equal(t.q("SELECT count FROM events WHERE name='sms_failed'")[0].count, 1);
});

test("overlapping sends are blocked; a stale in-flight send releases its slot", async () => {
  const t = setup();
  const id = await readyRequest(t);
  const resultId = t.q("SELECT id FROM results")[0].id;
  // Simulate a send already in flight: the reservation is held, not yet resolved.
  assert.equal(await t.store.reserveSendSlot({ id: "msg-inflight", request_id: id, result_id: resultId, status: "sending", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 3), true);
  const r = await t.post(`/api/admin/requests/${id}/send`, {});
  assert.equal(r.status, 429);
  assert.equal((await j(r)).error, "send_in_progress");
  assert.equal(t.twilio.calls.filter((c) => c.op === "send").length, 0);
  // A stale (>1h) in-flight row releases the slot, so the send can proceed.
  await t.db.raw.prepare("UPDATE messages SET updated_at=? WHERE id='msg-inflight'").run(new Date(Date.now() - 2 * 3600 * 1000).toISOString());
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 200);
  assert.equal(t.q("SELECT status FROM messages WHERE id='msg-inflight'")[0].status, "failed");
});

test("max 3 successful sends per request", async () => {
  const t = setup();
  const id = await readyRequest(t);
  for (let i = 0; i < 3; i++) assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 200);
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 429);
});

test("outcome feedback is recorded for valid links only", async () => {
  const t = setup();
  const id = await readyRequest(t);
  await t.post(`/api/admin/requests/${id}/send`, {});
  const token = linkFromSms(t)[1];
  assert.equal((await t.post("/api/savings/outcome", { token, outcome: "worked" })).status, 200);
  assert.equal(t.q("SELECT outcome FROM results")[0].outcome, "worked");
  assert.equal(t.q("SELECT count FROM events WHERE name='outcome_worked'")[0].count, 1);
  assert.equal((await t.post("/api/savings/outcome", { token, outcome: "bogus" })).status, 400);
  assert.equal((await t.post("/api/savings/outcome", { token: "x".repeat(43), outcome: "worked" })).status, 404);
});

test("purge removes phones and unsent drafts of verified requests that never got a send (45 days)", async () => {
  let ms = Date.UTC(2026, 10, 15, 12, 0, 0);
  const t = setup({ clock: () => ms });
  const id = await readyRequest(t); // verified + draft result, never sent
  assert.deepEqual(await t.store.purge(ms), { phonesPurged: 0, resultsDeleted: 0 });
  ms += 46 * 86400000;
  const out = await t.store.purge(ms);
  assert.equal(out.phonesPurged, 1);
  assert.equal(out.resultsDeleted, 1);
  assert.equal(t.q("SELECT phone_e164 FROM requests")[0].phone_e164, null);
  assert.equal(t.q("SELECT * FROM results").length, 0);
  assert.equal(t.q("SELECT * FROM consents").length, 1); // consent records kept
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 409); // phone gone
});

test("purge removes expired results and phone numbers but keeps consent records", async () => {
  let ms = Date.UTC(2026, 10, 15, 17, 0, 0);
  const t = setup({ clock: () => ms });
  const id = await readyRequest(t);
  await t.post(`/api/admin/requests/${id}/send`, {});
  assert.deepEqual(await t.store.purge(ms), { phonesPurged: 0, resultsDeleted: 0 });
  ms += (14 + 31) * 86400000;
  const out = await t.store.purge(ms);
  assert.equal(out.resultsDeleted, 1);
  assert.equal(t.q("SELECT phone_e164 FROM requests")[0].phone_e164, null);
  assert.equal(t.q("SELECT * FROM consents").length, 1);
  assert.equal((await t.post(`/api/admin/requests/${id}/send`, {})).status, 409);
});

test("stats expose aggregate funnel counts only", async () => {
  const t = setup();
  const id = await readyRequest(t);
  await t.post(`/api/admin/requests/${id}/send`, {});
  const s = await j(await t.call("GET", "/api/admin/stats"));
  assert.equal(s.totals.signup_started, 1);
  assert.equal(s.totals.phone_verified, 1);
  assert.equal(s.totals.sms_sent, 1);
  assert.ok(!JSON.stringify(s).includes("555"));
});

// ---- Cloudflare Access JWT ----
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
async function mintJwt(overrides = {}, { badSig = false } = {}) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1", alg: "RS256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: "https://team.cloudflareaccess.com", aud: ["aud-123"], email: "Admin@Example.test", exp: now + 600, ...overrides };
  const signingInput = `${b64({ alg: "RS256", kid: "k1" })}.${b64(payload)}`;
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signingInput))).toString("base64url");
  return { token: `${signingInput}.${badSig ? sig.slice(0, -4) + "AAAA" : sig}`, fetchFn: async () => ({ json: async () => ({ keys: [jwk] }) }) };
}
const opts = (fetchFn) => ({ teamDomain: "team.cloudflareaccess.com", aud: "aud-123", allowedEmails: ["admin@example.test"], fetchFn, cache: new Map() });

test("Access JWT: valid token accepted (email case-insensitive)", async () => {
  const { token, fetchFn } = await mintJwt();
  assert.equal(await verifyAccessJwt(token, opts(fetchFn)), "admin@example.test");
});
test("Access JWT: rejects expired, wrong audience, wrong issuer, non-allowlisted email, bad signature, garbage", async () => {
  const past = Math.floor(Date.now() / 1000) - 10;
  for (const over of [{ exp: past }, { aud: ["other"] }, { iss: "https://evil.cloudflareaccess.com" }, { email: "intruder@example.test" }]) {
    const { token, fetchFn } = await mintJwt(over);
    assert.equal(await verifyAccessJwt(token, opts(fetchFn)), null, JSON.stringify(over));
  }
  const bad = await mintJwt({}, { badSig: true });
  assert.equal(await verifyAccessJwt(bad.token, opts(bad.fetchFn)), null);
  assert.equal(await verifyAccessJwt("a.b.c", opts(async () => ({ json: async () => ({ keys: [] }) }))), null);
  assert.equal(await verifyAccessJwt(undefined, opts(async () => ({}))), null);
});
test("admin API accepts a valid Access JWT and rejects a forged one", async () => {
  const { token, fetchFn } = await mintJwt();
  const env = { ENVIRONMENT: "production", ADMIN_DEV_EMAIL: "", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-123", ADMIN_EMAILS: "admin@example.test" };
  const t = setup({ env, fetchFn });
  assert.equal((await t.call("GET", "/api/admin/stats", undefined, { headers: { "Cf-Access-Jwt-Assertion": token } })).status, 200);
  assert.equal((await t.call("GET", "/api/admin/stats", undefined, { headers: { "Cf-Access-Jwt-Assertion": token.slice(0, -6) + "AAAAAA" } })).status, 401);
});
