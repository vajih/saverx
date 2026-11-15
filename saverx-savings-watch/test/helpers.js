import { createApp } from "../src/handlers.js";
import { mockTwilio } from "../src/twilio.js";
import { hmacHex } from "../src/crypto.js";

export const ORIGIN = "https://saverx.ai";
export const ENV = { HMAC_KEY: "test-key", TURNSTILE_BYPASS: "true", ALLOWED_ORIGINS: ORIGIN, PILOT_SLUGS: "repatha" };
// Synthetic number only
export const PHONE = "(415) 555-0100";

/** In-memory twin of src/store.js (same method names). */
export function memoryStore() {
  const requests = new Map(), consents = [], suppression = new Set(), counters = new Map(), events = new Map();
  return {
    requests, consents, suppression, events,
    async findRecentRequest(phoneHmac, slug, sinceIso) {
      return [...requests.values()].filter((r) => r.phone_hmac === phoneHmac && r.drug_slug === slug && r.created_at >= sinceIso).pop() || null;
    },
    async createRequest(r) { requests.set(r.id, { ...r, verify_attempts: 0, verified_at: null }); },
    async getRequest(id) { return requests.get(id) || null; },
    async bumpVerifyAttempts(id) { const r = requests.get(id); r.verify_attempts++; return r.verify_attempts; },
    async markVerified(id, at) {
      Object.assign(requests.get(id), { status: "verified", verified_at: at });
      consents.filter((c) => c.request_id === id).forEach((c) => (c.confirmed_at = at));
    },
    async addConsent(c) { consents.push({ ...c, confirmed_at: null }); },
    async isSuppressed(h) { return suppression.has(h); },
    async hit(key) { counters.set(key, (counters.get(key) || 0) + 1); return counters.get(key); },
    async addEvent(day, name, slug) { const k = `${day}|${name}|${slug}`; events.set(k, (events.get(k) || 0) + 1); },
  };
}

export function setup({ env = {}, fetchFn, ip = "203.0.113.5", clock } = {}) {
  const store = memoryStore();
  const twilio = mockTwilio();
  const e = { ...ENV, ...env };
  const app = createApp({ store, twilio, env: e, fetchFn, now: clock });
  const post = (path, body, { origin = ORIGIN, ipAddr = ip } = {}) =>
    app(new Request("https://saverx.ai" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));
  const start = (over = {}, opts) =>
    post("/api/savings/start", { drug_slug: "repatha", phone: PHONE, consent_transactional: true, ...over }, opts);
  const phoneHmac = (p = "+14155550100") => hmacHex(e.HMAC_KEY, "phone:" + p);
  return { store, twilio, app, post, start, phoneHmac };
}
