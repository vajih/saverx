// Router + shared context. Feature modules each return a Response for routes they own, else null.
//
// Rules enforced across the Worker (see docs/SAVINGS_WATCH_PLAN.md):
//  - Server-side consent text; abuse controls before any Twilio call; origin checks on browser POSTs.
//  - Responses never echo phone numbers; errors log messages only, never bodies or phones.

import { hmacHex, randomId } from "./crypto.js";
import { publicApi } from "./public-api.js";
import { resultRoutes } from "./results.js";
import { webhooks } from "./webhooks.js";
import { adminRoutes } from "./admin.js";

const MAX_BODY = 8192;

export function createApp({ store, twilio, env, now = () => Date.now(), fetchFn = fetch, certCache = new Map() }) {
  const origins = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

  const ctx = {
    store, twilio, env, now, fetchFn, certCache, origins,
    pilot: (env.PILOT_SLUGS || "repatha").split(",").map((s) => s.trim()),
    iso: () => new Date(now()).toISOString(),
    hash: (ns, value) => hmacHex(env.HMAC_KEY, ns + ":" + value),
    id: randomId,
    baseUrl: (env.PUBLIC_BASE_URL || "https://saverx.ai").replace(/\/$/, ""),

    cors(request) {
      const o = request.headers.get("Origin");
      const h = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      if (o && origins.includes(o)) {
        h["Access-Control-Allow-Origin"] = o;
        h["Vary"] = "Origin";
        h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        h["Access-Control-Allow-Headers"] = "Content-Type";
      }
      return h;
    },
    reply(request, status, body) {
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...ctx.cors(request) } });
    },
    fail: (request, status, error, message) => ctx.reply(request, status, { error, message }),
    originOk(request) {
      const o = request.headers.get("Origin");
      return !!o && origins.includes(o);
    },
    async readJson(request) {
      const text = await request.text();
      if (text.length > MAX_BODY) return null;
      try { const v = JSON.parse(text); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
    },
    /** Fixed-window counter. Returns true when `max` is exceeded. */
    async limited(name, id, max, seconds) {
      return (await store.hit(`${name}:${id}:${Math.floor(now() / 1000 / seconds)}`)) > max;
    },
    ipOf: (request) => request.headers.get("CF-Connecting-IP") || "unknown",
  };

  return async function handle(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: ctx.cors(request) });
    try {
      for (const route of [publicApi, resultRoutes, webhooks, adminRoutes]) {
        const res = await route(ctx, request, url);
        if (res) return res;
      }
    } catch (err) {
      console.error("savings error", err && err.message);
      return ctx.fail(request, 500, "server_error", "Something went wrong. Please try again.");
    }
    return ctx.fail(request, 404, "not_found", "Not found.");
  };
}
