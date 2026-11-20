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
  const consents = t.q("SELECT * FROM consents ORDER BY rowid");
  assert.deepEqual(consents.map((c) => c.type), ["transactional", "watch"]); // separate watch consent
  assert.ok(consents.every((c) => c.confirmed_at === null));

  const r2 = await t.post("/api/savings/verify", { request_id, code: "123456" });
  assert.equal(r2.status, 200);
  assert.equal((await j(r2)).verified, true);
  assert.equal(t.q("SELECT status FROM requests WHERE id=?", request_id)[0].status, "verified");
  assert.ok(t.q("SELECT * FROM consents").every((c) => c.confirmed_at));
  assert.equal(t.q("SELECT count FROM events WHERE name='phone_verified' AND drug_slug='repatha'")[0].count, 1);
});

test("consent text is stored from the server, not the client", async () => {
  const t = setup();
  await t.start({ consent_text: "client-forged text" });
  const c = t.q("SELECT * FROM consents")[0];
  assert.equal(c.text_shown, CONSENT_TEXTS[CONSENT_VERSION].transactional);
  assert.equal(c.text_version, CONSENT_VERSION);
});

test("watch consent is not recorded unless explicitly given", async () => {
  const t = setup();
  await t.start();
  assert.deepEqual(t.q("SELECT type FROM consents").map((c) => c.type), ["transactional"]);
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
  assert.equal(t.q("SELECT status FROM requests")[0].status, "new");
  assert.equal((await t.post("/api/savings/verify", { request_id, code: "abc" })).status, 400);
  assert.equal((await t.post("/api/savings/verify", { request_id: "nope", code: "123456" })).status, 404);
});

test("verify attempts are capped at 5, even with the right code afterwards", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  for (let i = 0; i < 5; i++) assert.equal((await t.post("/api/savings/verify", { request_id, code: "000000" })).status, 400);
  const r = await t.post("/api/savings/verify", { request_id, code: "123456" });
  assert.equal(r.status, 429);
  assert.equal(t.q("SELECT status FROM requests")[0].status, "new");
});

test("duplicate request within 30 days reuses the same request and consent rows", async () => {
  const t = setup();
  const a = await j(await t.start());
  const b = await j(await t.start());
  assert.equal(a.request_id, b.request_id);
  assert.equal(t.q("SELECT * FROM requests").length, 1);
  assert.equal(t.q("SELECT * FROM consents").length, 1);
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
  await t.store.addSuppression(await t.phoneHmac(), "stop", new Date().toISOString());
  const r = await t.start();
  assert.equal(r.status, 409);
  assert.equal((await j(r)).error, "opted_out");
  assert.equal(t.twilio.calls.length, 0);
  assert.equal(t.q("SELECT * FROM requests").length, 0);
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
  assert.equal(t.q("SELECT * FROM requests").length, 0);
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

test("LIVE_TEST_ALLOWLIST: live client refuses numbers that are not listed", async () => {
  const seen = [];
  const fakeFetch = async (url) => { seen.push(url); return { ok: true, json: async () => ({ status: "approved", sid: "SM1" }) }; };
  const env = { TWILIO_LIVE: "true", TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_VERIFY_SERVICE_SID: "c", TWILIO_MESSAGING_SERVICE_SID: "d", PUBLIC_BASE_URL: "https://x.test", LIVE_TEST_ALLOWLIST: "+14155550100" };
  const c = createTwilioClient(env, fakeFetch);
  assert.deepEqual(await c.startVerification("+14155550111"), { ok: false });
  assert.equal((await c.sendMessage("+14155550111", "hi")).ok, false);
  assert.equal(seen.length, 0);
  assert.equal((await c.sendMessage("+14155550100", "hi")).ok, true);
  assert.equal(seen.length, 1);
});

test("live client authenticates with an API key when provided, else the auth token", async () => {
  const auths = [];
  const f = async (url, opts) => { auths.push(opts.headers.Authorization); return { ok: true, json: async () => ({}) }; };
  const dec = (h) => Buffer.from(h.replace("Basic ", ""), "base64").toString();
  const base = { TWILIO_LIVE: "true", TWILIO_ACCOUNT_SID: "ACx", TWILIO_VERIFY_SERVICE_SID: "VAx" };
  await createTwilioClient({ ...base, TWILIO_API_KEY_SID: "SKx", TWILIO_API_KEY_SECRET: "sec" }, f).startVerification("+14155550100");
  await createTwilioClient({ ...base, TWILIO_AUTH_TOKEN: "tok" }, f).startVerification("+14155550100");
  assert.equal(dec(auths[0]), "SKx:sec");
  assert.equal(dec(auths[1]), "ACx:tok");
});

// ---------------- UTM attribution (paid-test reporting) ----------------
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { sanitizeUtm, readUtm } from "../src/validate.js";
const UTM = { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "smoke-test", utm_content: "ad-a", utm_term: "repatha-cost" };
const row = (t, id) => t.q("SELECT * FROM requests WHERE id=?", id)[0];
const ipN = (n) => ({ ipAddr: `203.0.113.${100 + n}` });

test("UTMs from the landing page are stored on the created request and survive verification", async () => {
  const t = setup();
  const { request_id } = await j(await t.start({ source_page: "referral", ...UTM }));
  const r = row(t, request_id);
  assert.deepEqual({ s: r.utm_source, m: r.utm_medium, c: r.utm_campaign, ct: r.utm_content, tm: r.utm_term }, { s: "facebook", m: "paid_social", c: "smoke-test", ct: "ad-a", tm: "repatha-cost" });
  assert.equal(r.source_page, "referral", "source_page is unchanged");
  await t.post("/api/savings/verify", { request_id, code: "123456" });
  const after = row(t, request_id);
  assert.equal(after.status, "verified");assert.equal(after.utm_campaign, "smoke-test");
});

test("UTM values are normalized server-side (lowercase, [a-z0-9_-]) even if the client did not", async () => {
  const t = setup();
  const { request_id } = await j(await t.start({ utm_source: " Facebook ", utm_campaign: "Spring Sale!! 2026", utm_content: "Ad_Set-B", utm_medium: "paid social" }));
  const r = row(t, request_id);
  assert.equal(r.utm_source, "facebook");assert.equal(r.utm_campaign, "spring-sale-2026");assert.equal(r.utm_content, "ad_set-b");assert.equal(r.utm_medium, "paid-social");
});

test("PII-like and overlong UTM values are dropped, never stored; the signup itself still succeeds", async () => {
  const t = setup();
  const bad = {
    utm_source: "415-555-0100", utm_medium: "4155550100", utm_campaign: "call+1 (415) 555 0100", utm_content: "someone@example.com", utm_term: "x".repeat(101),
  };
  const res = await t.start(bad);
  assert.equal(res.status, 200);
  const { request_id } = await j(res);
  const r = row(t, request_id);
  for (const k of Object.keys(bad)) assert.equal(r[k], null, `${k} must be dropped`);
  assert.equal(t.q("SELECT utm_source||utm_medium||utm_campaign||utm_content||utm_term AS x FROM requests")[0].x, null, "all five columns are NULL");
  assert.equal(sanitizeUtm("x".repeat(100)), "x".repeat(100), "exactly 100 characters is allowed");
  assert.equal(sanitizeUtm("q4-2026-nov-20-v2"), "q4-2026-nov-20-v2", "dates and short ids are not mistaken for phone numbers");
  assert.equal(sanitizeUtm(12345), null);assert.equal(sanitizeUtm(["a"]), null);assert.equal(sanitizeUtm({ a: 1 }), null);assert.equal(sanitizeUtm("   "), null);assert.equal(sanitizeUtm("!!!"), null);
});

test("missing UTMs are stored as NULL", async () => {
  const t = setup();
  const { request_id } = await j(await t.start());
  const r = row(t, request_id);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) assert.equal(r[k], null, k);
  assert.deepEqual(Object.values(readUtm({})), [null, null, null, null, null]);assert.deepEqual(Object.values(readUtm(null)), [null, null, null, null, null]);
});

test("a duplicate /start keeps the original (first-touch) UTMs", async () => {
  const t = setup();
  const first = await j(await t.start({ ...UTM }));
  const second = await j(await t.start({ utm_source: "google", utm_campaign: "other-campaign", utm_content: "ad-z" }));
  assert.equal(second.request_id, first.request_id, "same request reused");
  assert.equal(t.q("SELECT COUNT(*) AS n FROM requests")[0].n, 1);
  const r = row(t, first.request_id);
  assert.equal(r.utm_source, "facebook");assert.equal(r.utm_campaign, "smoke-test");assert.equal(r.utm_content, "ad-a");
});

test("honeypot, consent and drug checks are unchanged by UTMs", async () => {
  const t = setup();
  assert.equal(t.q("SELECT COUNT(*) AS n FROM requests")[0].n, 0);
  await t.start({ hp: "bot", ...UTM });assert.equal(t.q("SELECT COUNT(*) AS n FROM requests")[0].n, 0, "honeypot still stops it");
  assert.equal((await t.start({ consent_transactional: false, ...UTM })).status, 400);
  assert.equal((await t.start({ drug_slug: "ozempic", ...UTM })).status, 400);
});

test("admin request list returns utm_campaign (and utm_content); detail carries them too", async () => {
  const t = setup();
  const id = await t.verified({ ...UTM });
  const list = (await j(await t.call("GET", "/api/admin/requests"))).requests;
  assert.equal(list[0].utm_campaign, "smoke-test");assert.equal(list[0].utm_content, "ad-a");assert.equal(list[0].utm_source, "facebook");
  const detail = await j(await t.call("GET", `/api/admin/requests/${id}`));
  assert.equal(detail.request.utm_campaign, "smoke-test");
});

test("verifiedByCampaign counts verified phones per campaign, keeps counting after the admin moves them on, honors the window, and reports (none)", async () => {
  const t = setup();
  const mk = async (n, utm) => { const { request_id } = await j(await t.start({ phone: `(415) 555-01${String(n).padStart(2, "0")}`, ...utm }, ipN(n))); await t.post("/api/savings/verify", { request_id, code: "123456" }, ipN(n)); return request_id; };
  const a1 = await mk(1, { utm_campaign: "campaign-a" }), a2 = await mk(2, { utm_campaign: "campaign-a" }), b1 = await mk(3, { utm_campaign: "campaign-b" }), n1 = await mk(4, {});
  // a started-but-unverified request must not count
  await t.start({ phone: "(415) 555-0105", utm_campaign: "campaign-a" }, ipN(5));
  // admin progress: verified -> ready -> sent -> closed are all still verified phones
  await t.store.setRequestStatus(a1, "ready");await t.store.setRequestStatus(a2, "sent");await t.store.setRequestStatus(b1, "closed");
  const since = new Date(Date.now() - 86400000).toISOString();
  const plain = (x) => JSON.parse(JSON.stringify(x));   // D1/SQLite rows are null-prototype objects
  assert.deepEqual(plain(await t.store.verifiedByCampaign(since)), [{ campaign: "campaign-a", verified: 2 }, { campaign: "(none)", verified: 1 }, { campaign: "campaign-b", verified: 1 }]);   // by count, ties by name
  // window: push one verification into the past
  t.db.raw.prepare("UPDATE requests SET verified_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(a2);
  assert.deepEqual(plain((await t.store.verifiedByCampaign(since)).find((x) => x.campaign === "campaign-a")), { campaign: "campaign-a", verified: 1 });
  assert.equal(n1 != null, true);
});

test("admin stats endpoint exposes by_campaign (30-day window) and the admin page shows it", async () => {
  const t = setup();
  await t.verified({ utm_campaign: "smoke-test" });
  const s = await j(await t.call("GET", "/api/admin/stats"));
  assert.deepEqual(JSON.parse(JSON.stringify(s.by_campaign)), [{ campaign: "smoke-test", verified: 1 }]);assert.ok(s.totals && s.daily, "existing stats keep their shape");
  const html = await (await t.call("GET", "/admin/savings")).text();
  assert.match(html, /Verified phones by campaign/);assert.match(html, /id="campaigns"/);assert.match(html, /<th>Campaign<\/th>/);
});

test("migration 0002 upgrades an existing database and matches schema.sql; schema.sql already has the columns", () => {
  const cols = (db) => db.prepare("SELECT name FROM pragma_table_info('requests')").all().map((c) => c.name);
  const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  const old = new DatabaseSync(":memory:");
  old.exec(schema.split("\n").filter((l) => !/^\s*utm_(source|medium|campaign|content|term)\s/.test(l)).join("\n"));   // the pre-UTM schema
  assert(!cols(old).includes("utm_campaign"), "old schema has no UTM columns");
  old.exec(readFileSync(new URL("../migrations/0002_utm_attribution.sql", import.meta.url), "utf8"));
  const fresh = new DatabaseSync(":memory:");fresh.exec(schema);
  assert.deepEqual([...cols(old)].sort(), [...cols(fresh)].sort(), "upgraded and fresh databases have the same columns");
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) assert(cols(fresh).includes(k), k);
});
