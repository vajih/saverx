// Localhost preview: serves the static site AND the real Worker code on one origin (http://localhost:3002),
// backed by SQLite (same schema/SQL as D1). Mock Twilio by default: NO real texts are ever sent unless
// .dev.vars sets TWILIO_LIVE=true. Mock verification code is always 123456.
//
//   npm run dev        then open http://localhost:3002/drugs/repatha/
import http from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteD1 } from "./sqlite-d1.js";
import { createApp } from "../src/handlers.js";
import { d1Store } from "../src/store.js";
import { createTwilioClient } from "../src/twilio.js";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PORT = Number(process.env.PORT || 3002);
const base = `http://localhost:${PORT}`;

function loadDevVars() {
  const p = join(root, "saverx-savings-watch", ".dev.vars");
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
  }
  return out;
}

const env = {
  HMAC_KEY: "dev-only-change-me", TURNSTILE_BYPASS: "true", TWILIO_AUTH_TOKEN: "dev-token", ALLOW_ANY_HOUR: "true",
  PILOT_SLUGS: "repatha", ...loadDevVars(),
  ENVIRONMENT: "dev", ADMIN_DEV_EMAIL: "dev-admin@localhost", ALLOWED_ORIGINS: base, PUBLIC_BASE_URL: base,
};
const live = env.TWILIO_LIVE === "true";
mkdirSync(join(root, "saverx-savings-watch", ".dev-data"), { recursive: true });
const db = sqliteD1(join(root, "saverx-savings-watch", ".dev-data", "dev.sqlite"));
const twilio = createTwilioClient(env);
const app = createApp({ store: d1Store(db), twilio, env });

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };
// data/*.json is public on the real site (drug directory); only the leads CSVs (PII) stay blocked
const BLOCKED = /^\/(\.|data\/[^?]*\.csv|node_modules\/|saverx-savings-watch\/|scripts\/|saverx-chat-proxy\/)/;
const WORKER = /^\/(api\/(savings|admin|twilio)\/|admin\/savings|r\/)/;

function serveStatic(pathname, res) {
  let p = normalize(decodeURIComponent(pathname));
  if (BLOCKED.test(p)) { res.writeHead(404).end("Not found"); return; }
  let file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("Not found"); return; }
  let data = readFileSync(file);
  if (process.env.SW_DEV_INTEREST && p === "/data/savings-watch.json") { // local preview only: turn the demand-test card on without editing the file
    const cfg = JSON.parse(data.toString()); cfg.interest = true; data = Buffer.from(JSON.stringify(cfg));
  }
  if (process.env.NO_BANNER && p === "/assets/js/consent.js") { // screenshots only: pre-dismiss the cookie banner
    data = Buffer.concat([Buffer.from(`localStorage.setItem("saverx_consent",JSON.stringify({timestamp:Date.now(),version:2,analytics:false,advertising:false,personalization:false}));\n`), data]);
  }
  if (process.env.SW_DEV_INTEREST && extname(file) === ".html") { // local preview only: form posts + beacons go to /dev/form-capture, never the production sheet
    data = Buffer.from(data.toString().replace("<head>", '<head><script>Object.defineProperty(window,"SAVERX_FORM_API",{get:function(){return"/dev/form-capture"},set:function(){},configurable:true});</script>'));
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(data);
}
const captured = []; // dev-only: what the Apps Script endpoint would have received

http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  try {
    if (url.pathname === "/dev/form-capture") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      captured.push({ at: new Date().toISOString(), method: req.method, query: Object.fromEntries(url.searchParams), body: raw ? Object.fromEntries(new URLSearchParams(raw)) : null });
      res.writeHead(200, { "Content-Type": "text/plain" }).end("1");
      return;
    }
    if (url.pathname === "/dev/captured") { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(captured, null, 2)); return; }
    if (url.pathname === "/dev/outbox") { // dev-only: shows the texts the mock "sent"
      const sent = (twilio.calls || []).filter((c) => c.op === "send").map((c) => c.body);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ live, mock_verification_code: live ? null : "123456", sent }, null, 2));
      return;
    }
    if (WORKER.test(url.pathname)) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
      const headers = new Headers(req.headers);
      headers.set("CF-Connecting-IP", req.socket.remoteAddress || "127.0.0.1");
      const out = await app(new Request(url, { method: req.method, headers, body }));
      res.writeHead(out.status, Object.fromEntries(out.headers)).end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    serveStatic(url.pathname, res);
  } catch (e) {
    console.error(e.message);
    res.writeHead(500).end("Server error");
  }
}).listen(PORT, () => {
  console.log(`Savings Watch dev server: ${base}`);
  console.log(live ? "⚠️  LIVE TWILIO MODE: real texts can be sent" + (env.LIVE_TEST_ALLOWLIST ? ` (allowlist: ${env.LIVE_TEST_ALLOWLIST})` : " (NO allowlist set!)") : "Mock Twilio: no real texts. Verification code: 123456");
  console.log(`  Signup: ${base}/savings-watch/?drug=repatha\n  Admin:  ${base}/admin/savings\n  Outbox: ${base}/dev/outbox`);
});
