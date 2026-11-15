// Twilio Verify clients. The handlers only see { startVerification, checkVerification }.
//
// Safety: the live client is used ONLY when TWILIO_LIVE === "true". Everything else gets the
// mock, which never touches the network, so dev/test can never send a real SMS.

const BASE = "https://verify.twilio.com/v2/Services";

export function createTwilioClient(env, fetchFn = fetch) {
  return env.TWILIO_LIVE === "true" ? liveTwilio(env, fetchFn) : mockTwilio();
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
  };
}

function liveTwilio(env, fetchFn) {
  const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
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
  };
}
