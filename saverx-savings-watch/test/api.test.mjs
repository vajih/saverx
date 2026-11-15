import test from "node:test";
import assert from "node:assert/strict";
import { setup, ORIGIN, PHONE } from "./helpers.js";
import { verifyTurnstile } from "../src/turnstile.js";
import { createTwilioClient } from "../src/twilio.js";
import { CONSENT_TEXTS, CONSENT_VERSION } from "../src/consent.js";

const j = (r) => r.json();

test("successful enrollment: start then verify (Repatha pilot)", async () => {
  const t = setup();
  const r1 = await t.start({ consent_watch: true, source_page: "/drugs/repatha/" });
  assert.equal(r1.status, 200);
  const { request_id } = await j(r1);
  assert.ok(request_id);
  assert.deepEqual(t.twilio.calls.map((c) => c.op), ["start"]);
  assert.equal(t.store.consents.length, 2); // transactional + separate watch consent
  assert.deepEqual(t.store.consents.map((c) => c.type), ["transactional", "watch"]);
  assert.ok(t.store.consents.every((c) => c.confirmed_at === null));

  const r2 = await t.post("/api/savings/verify", { request_id, code: "123456" });
  assert.equal(r2.status, 200);
  assert.equal((await j(r2)).verified, true);
  assert.equal(t.store.requests.get(request_id).status, "verified");
  assert.ok(t.store.consents.every((c) => c.confirmed_at));
  assert.ok([...t.store.events.keys()].some((k) => k.includes("|phone_verified|repatha")));
});

test("consent text is stored from the server, not the client", async () => {
  const t = setup();
  await t.start({ consent_text: "client-forged text" });
  assert.equal(t.store.consents[0].text_shown, CONSENT_TEXTS[CONSENT_VERSION].transactional);
  assert.equal(t.store.consents[0].text_version, CONSENT_VERSION);
});

test("watch consent is not recorded unless explicitly given", async () => {
  const t = setup();
  await t.start();
  assert.deepEqual(t.store.consents.map((c) => c.type), ["transactional"]);
});

test("responses and storage never echo the raw phone in the response", async () => {
  const t = setup();
  const text = await (await t.start()).text();
  assert.ok(!text.includes("555"));
});

test("invalid phone numbers are rejected before Twilio", async () => {
  const t = setup();
  for (const phone of ["", "12345", "+44 20 7946 0958", "(015) 555-0100"]) {
    const r = await t.start({ phone });
    assert.equal(r.status, 400);
    assert.equal((await j(r)).error, "invalid_phone");
  }
  assert.equal(t.twilio.calls.length, 0);
});

test("missing or non-true consent is rejected", async () => {
  const t = setup();
  for (const v of [undefined, false, "true", 1]) {
    const r = await t.start({ consent_transactional: v });
    assert.equal(r.status, 400);
    assert.equal((await j(r)).error, "consent_required");
  }
  assert.equal(t.twilio.calls.length, 0);
});

test("only pilot medications accepted", async () => {
  const t = setup();
  for (const slug of ["ozempic", "../etc", ""]) assert.equal((await t.start({ drug_slug: slug })).status, 400);
});

test("verification failures: wrong code, bad format, unknown request", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  const wrong = await t.post("/api/savings/verify", { request_id, code: "000000" });
  assert.equal(wrong.status, 400);
  assert.equal((await j(wrong)).error, "wrong_code");
  assert.equal(t.store.requests.get(request_id).status, "new");
  assert.equal((await t.post("/api/savings/verify", { request_id, code: "abc" })).status, 400);
  assert.equal((await t.post("/api/savings/verify", { request_id: "nope", code: "123456" })).status, 404);
});

test("verify attempts are capped at 5, even with the right code afterwards", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  for (let i = 0; i < 5; i++) assert.equal((await t.post("/api/savings/verify", { request_id, code: "000000" })).status, 400);
  const r = await t.post("/api/savings/verify", { request_id, code: "123456" });
  assert.equal(r.status, 429);
  assert.equal(t.store.requests.get(request_id).status, "new");
});

test("duplicate request within 30 days reuses the same request and consent rows", async () => {
  const t = setup();
  const a = await j(await t.start());
  const b = await j(await t.start());
  assert.equal(a.request_id, b.request_id);
  assert.equal(t.store.requests.size, 1);
  assert.equal(t.store.consents.length, 1);
});

test("duplicate after verification does not resend a code", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  await t.post("/api/savings/verify", { request_id, code: "123456" });
  const calls = t.twilio.calls.length;
  const again = await j(await t.start());
  assert.equal(again.already_verified, true);
  assert.equal(t.twilio.calls.length, calls);
});

test("per-phone rate limit trips on the 4th start within an hour", async () => {
  const t = setup();
  for (let i = 0; i < 3; i++) assert.equal((await t.start({}, { ipAddr: "203.0.113." + i })).status, 200);
  const r = await t.start({}, { ipAddr: "203.0.113.99" });
  assert.equal(r.status, 429);
});

test("per-IP rate limit trips on the 6th start within an hour", async () => {
  const t = setup();
  for (let i = 0; i < 5; i++) assert.equal((await t.start({ phone: `(415) 555-01${10 + i}` })).status, 200);
  assert.equal((await t.start({ phone: "(415) 555-0199" })).status, 429);
});

test("rate-limit window resets in the next hour", async () => {
  let ms = Date.UTC(2026, 10, 15, 12, 0, 0);
  const t = setup({ clock: () => ms });
  for (let i = 0; i < 3; i++) await t.start({}, { ipAddr: "203.0.113." + i });
  assert.equal((await t.start({}, { ipAddr: "203.0.113.50" })).status, 429);
  ms += 3600 * 1000;
  assert.equal((await t.start({}, { ipAddr: "203.0.113.51" })).status, 200);
});

test("consent withdrawal: a suppressed (STOP) number cannot start and gets no code", async () => {
  const t = setup();
  t.store.suppression.add(await t.phoneHmac());
  const r = await t.start();
  assert.equal(r.status, 409);
  assert.equal((await j(r)).error, "opted_out");
  assert.equal(t.twilio.calls.length, 0);
  assert.equal(t.store.requests.size, 0);
});

test("SMS provider failure returns a clean 502 and no secrets", async () => {
  const t = setup();
  t.twilio.startVerification = async () => ({ ok: false });
  const r = await t.start();
  assert.equal(r.status, 502);
  assert.equal((await j(r)).error, "sms_unavailable");
});

test("honeypot gets a fake success and does nothing", async () => {
  const t = setup();
  const r = await t.start({ hp: "bot" });
  assert.equal(r.status, 200);
  assert.equal(t.store.requests.size, 0);
  assert.equal(t.twilio.calls.length, 0);
});

test("cross-origin and missing-origin POSTs are refused", async () => {
  const t = setup();
  assert.equal((await t.start({}, { origin: "https://evil.example" })).status, 403);
  assert.equal((await t.start({}, { origin: null })).status, 403);
  assert.equal(t.twilio.calls.length, 0);
});

test("malformed / oversized bodies are rejected", async () => {
  const t = setup();
  assert.equal((await t.post("/api/savings/start", "not json")).status, 400);
  assert.equal((await t.post("/api/savings/start", JSON.stringify({ x: "a".repeat(5000) }))).status, 400);
});

test("Turnstile fails closed without bypass, passes with a good token", async () => {
  const noBypass = { TURNSTILE_BYPASS: "false", TURNSTILE_SECRET: "s" };
  const bad = setup({ env: noBypass, fetchFn: async () => ({ json: async () => ({ success: false }) }) });
  assert.equal((await bad.start({ turnstile_token: "t" })).status, 400);
  assert.equal(bad.twilio.calls.length, 0);
  const good = setup({ env: noBypass, fetchFn: async () => ({ json: async () => ({ success: true }) }) });
  assert.equal((await good.start({ turnstile_token: "t" })).status, 200);
  assert.equal(await verifyTurnstile({ env: { TURNSTILE_SECRET: "s" }, token: "", fetchFn: async () => ({ json: async () => ({ success: true }) }) }), false);
  assert.equal(await verifyTurnstile({ env: { TURNSTILE_SECRET: "s" }, token: "t", fetchFn: async () => { throw new Error("net"); } }), false);
});

test("non-POST and unknown routes", async () => {
  const t = setup();
  const get = await t.app(new Request("https://saverx.ai/api/savings/start", { method: "GET" }));
  assert.equal(get.status, 405);
  assert.equal((await t.post("/api/savings/other", {})).status, 404);
  const health = await t.app(new Request("https://saverx.ai/api/savings/health"));
  assert.equal(health.status, 200);
});

test("CORS headers only for allowed origins; responses are no-store", async () => {
  const t = setup();
  const r = await t.start();
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  const pre = await t.app(new Request("https://saverx.ai/api/savings/start", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), null);
});

test("live Twilio is never used unless TWILIO_LIVE=true", async () => {
  let called = false;
  const spy = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const c = createTwilioClient({ TWILIO_LIVE: "false", TWILIO_ACCOUNT_SID: "x" }, spy);
  await c.startVerification("+14155550100");
  assert.equal(called, false);
  const unset = createTwilioClient({}, spy);
  await unset.startVerification("+14155550100");
  assert.equal(called, false);
});

test("live Twilio client builds the Verify requests (mocked fetch only)", async () => {
  const seen = [];
  const fakeFetch = async (url, opts) => {
    seen.push({ url, body: opts.body.toString(), auth: opts.headers.Authorization });
    return { ok: true, json: async () => ({ status: "approved" }) };
  };
  const c = createTwilioClient({ TWILIO_LIVE: "true", TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "tok", TWILIO_VERIFY_SERVICE_SID: "VAtest" }, fakeFetch);
  assert.deepEqual(await c.startVerification("+14155550100"), { ok: true });
  assert.deepEqual(await c.checkVerification("+14155550100", "123456"), { status: "approved" });
  assert.match(seen[0].url, /Services\/VAtest\/Verifications$/);
  assert.match(seen[1].url, /VerificationCheck$/);
  assert.ok(seen[0].auth.startsWith("Basic "));
  const failing = createTwilioClient({ TWILIO_LIVE: "true", TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_VERIFY_SERVICE_SID: "c" }, async () => ({ ok: false, json: async () => ({ code: 20404 }) }));
  assert.deepEqual(await failing.checkVerification("+14155550100", "123456"), { status: "failed" });
});
