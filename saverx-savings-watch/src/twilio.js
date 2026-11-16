// Twilio Verify clients. The handlers only see { startVerification, checkVerification }.
//
// Safety: the live client is used ONLY when TWILIO_LIVE === "true". Everything else gets the
// mock, which never touches the network, so dev/test can never send a real SMS.

const BASE = "https://verify.twilio.com/v2/Services";

export function createTwilioClient(env, fetchFn = fetch) {
  if (env.TWILIO_LIVE !== "true") return mockTwilio();
  const live = liveTwilio(env, fetchFn);
  // Dev/test only: keep the results TEXT mocked (e.g. no approved A2P campaign yet) while the signup
  // verification code is still real. The mock records the message so the dev outbox can show it.
  const mock = env.TWILIO_MESSAGES_MOCK === "true" ? mockTwilio() : null;
  const send = mock ? (p, b) => mock.sendMessage(p, b) : (p, b) => live.sendMessage(p, b);
  // Optional guard for live testing: only ever contact the listed numbers (E.164, comma-separated).
  const allow = (env.LIVE_TEST_ALLOWLIST || "").split(",").map((x) => x.trim()).filter(Boolean);
  const ok = (phone) => !allow.length || allow.includes(phone);
  return {
    calls: mock ? mock.calls : undefined, // lets the dev outbox list mocked texts
    startVerification: async (p) => (ok(p) ? live.startVerification(p) : { ok: false }),
    checkVerification: async (p, c) => (ok(p) ? live.checkVerification(p, c) : { status: "failed" }),
    sendMessage: async (p, b) => (ok(p) ? send(p, b) : { ok: false, code: "not_allowlisted" }),
  };
}

/** Mock: code "123456" is approved. Records calls so tests can assert on them. */
export function mockTwilio() {
  const calls = [];
  return {
    calls,
    async startVerification(phone) {
      calls.push({ op: "start", phone });
      return { ok: true };
    },
    async checkVerification(phone, code) {
      calls.push({ op: "check", phone });
      return { status: code === "123456" ? "approved" : "pending" };
    },
    async sendMessage(phone, body) {
      calls.push({ op: "send", phone, body });
      return { ok: true, sid: "SMmock" + calls.length, status: "queued" };
    },
  };
}

function liveTwilio(env, fetchFn) {
  // Prefer a restricted API Key (SK...) over the master Auth Token when provided.
  const auth = "Basic " + btoa(`${env.TWILIO_API_KEY_SID || env.TWILIO_ACCOUNT_SID}:${env.TWILIO_API_KEY_SECRET || env.TWILIO_AUTH_TOKEN}`);
  async function post(path, params) {
    const res = await fetchFn(`${BASE}/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error body */ }
    return { httpOk: res.ok, data };
  }
  return {
    async startVerification(phone) {
      const { httpOk } = await post("Verifications", { To: phone, Channel: "sms" });
      return { ok: httpOk };
    },
    async checkVerification(phone, code) {
      const { httpOk, data } = await post("VerificationCheck", { To: phone, Code: code });
      // 404 (expired / already approved) and 429 (too many attempts) both mean "not approved"
      return { status: httpOk ? data.status : "failed" };
    },
    /** Messaging API (results texts). Needs a Messaging Service that is A2P-registered for US delivery. */
    async sendMessage(phone, body) {
      const res = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          To: phone, Body: body, MessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
          StatusCallback: `${env.PUBLIC_BASE_URL}/api/twilio/status`,
        }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* non-JSON error body */ }
      return res.ok ? { ok: true, sid: data.sid, status: data.status || "queued" } : { ok: false, code: String(data.code || res.status) };
    },
  };
}

/** Twilio request signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
export async function twilioSignature(authToken, url, params) {
  const enc = new TextEncoder();
  let data = url;
  for (const k of [...new Set(params.keys())].sort()) data += k + params.get(k);
  const key = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig));
}

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Conservative US send window: 8am local in the westernmost zone (11am ET) until
 * 9pm local in the easternmost zone (9pm ET). Keeps every recipient inside 8am-9pm.
 */
export function withinSendWindow(nowMs) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(nowMs));
  return h >= 11 && h < 21;
}
