// Twilio Verify clients. The handlers only see { startVerification, checkVerification }.
//
// Safety: the live client is used ONLY when TWILIO_LIVE === "true". The mock (fixed code
// "123456", no real texts) is available ONLY in explicit dev/test environments. Anywhere
// else with live messaging disabled, messaging refuses outright instead of silently
// verifying arbitrary numbers with the mock: fail closed, never fail open.

const BASE = "https://verify.twilio.com/v2/Services";

export function createTwilioClient(env, fetchFn = fetch) {
  if (env.TWILIO_LIVE === "true") {
    const live = liveTwilio(env, fetchFn);
    // Optional guard for live testing: only ever contact the listed numbers (E.164, comma-separated).
    const allow = (env.LIVE_TEST_ALLOWLIST || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!allow.length) return live;
    const ok = (phone) => allow.includes(phone);
    return {
      startVerification: async (p) => (ok(p) ? live.startVerification(p) : { ok: false }),
      checkVerification: async (p, c) => (ok(p) ? live.checkVerification(p, c) : { status: "failed" }),
      sendMessage: async (p, b) => (ok(p) ? live.sendMessage(p, b) : { ok: false, code: "not_allowlisted" }),
    };
  }
  const environment = env.ENVIRONMENT || "production";
  if (environment === "dev" || environment === "test") return mockTwilio();
  return refusingTwilio();
}

/** Fail-closed client: every messaging operation throws. Used when live messaging is
 *  disabled outside dev/test, so no verification or send can silently succeed. */
function refusingTwilio() {
  const refuse = async () => { throw new Error("Twilio live messaging is not enabled in this environment."); };
  return { startVerification: refuse, checkVerification: refuse, sendMessage: refuse };
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
 * Conservative US send window: 8am local in the westernmost supported zone until 9pm
 * local in the easternmost zone, so every recipient stays inside 8am-9pm local. The phone
 * validator accepts Hawaii and Alaska numbers, and 8am Hawaii time is 2pm Eastern in
 * daylight time (1pm in standard time), so the window opens at 2pm ET and closes at
 * 9pm ET. (The old 11am ET opening allowed 6am texts in Hawaii and 7am in Alaska.)
 */
export function withinSendWindow(nowMs) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(nowMs));
  return h >= 14 && h < 21;
}
