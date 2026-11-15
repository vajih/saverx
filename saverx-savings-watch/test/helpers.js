import { createApp } from "../src/handlers.js";
import { mockTwilio } from "../src/twilio.js";
import { d1Store } from "../src/store.js";
import { hmacHex } from "../src/crypto.js";
import { sqliteD1 } from "../dev/sqlite-d1.js";

export const ORIGIN = "https://saverx.ai";
export const ENV = {
  HMAC_KEY: "test-key", TURNSTILE_BYPASS: "true", ALLOWED_ORIGINS: ORIGIN, PILOT_SLUGS: "repatha",
  PUBLIC_BASE_URL: "https://saverx.ai", TWILIO_AUTH_TOKEN: "test-auth-token",
  ADMIN_DEV_EMAIL: "admin@example.test", ENVIRONMENT: "dev", ALLOW_ANY_HOUR: "true",
};
// Synthetic number only
export const PHONE = "(415) 555-0100";
export const E164 = "+14155550100";

/** Real SQL (schema.sql + src/store.js) on in-memory SQLite. */
export function setup({ env = {}, fetchFn, ip = "203.0.113.5", clock } = {}) {
  const db = sqliteD1();
  const store = d1Store(db);
  const twilio = mockTwilio();
  const e = { ...ENV, ...env };
  const app = createApp({ store, twilio, env: e, fetchFn, now: clock });
  const q = (sql, ...args) => db.raw.prepare(sql).all(...args);
  const call = (method, path, body, { origin = ORIGIN, ipAddr = ip, headers = {} } = {}) =>
    app(new Request("https://saverx.ai" + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr, ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }));
  const post = (path, body, opts) => call("POST", path, body, opts);
  const start = (over = {}, opts) =>
    post("/api/savings/start", { drug_slug: "repatha", phone: PHONE, consent_transactional: true, ...over }, opts);
  const phoneHmac = (p = E164) => hmacHex(e.HMAC_KEY, "phone:" + p);
  /** start + verify, returns request_id */
  const verified = async (over) => {
    const { request_id } = await (await start(over)).json();
    await post("/api/savings/verify", { request_id, code: "123456" });
    return request_id;
  };
  return { db, store, twilio, app, call, post, start, q, phoneHmac, verified, env: e };
}
