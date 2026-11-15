// Cloudflare Access JWT verification (RS256). Access sits in front of /admin/savings* and
// /api/admin/*; the Worker still verifies the assertion so a mis-configured route can't expose admin.

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
const certCache = new Map();

export async function verifyAccessJwt(token, { teamDomain, aud, allowedEmails, fetchFn = fetch, nowMs = Date.now(), cache = certCache }) {
  try {
    const [h, p, sig] = String(token || "").split(".");
    if (!h || !p || !sig) return null;
    const header = b64urlToJson(h);
    const payload = b64urlToJson(p);
    if (header.alg !== "RS256") return null;

    let entry = cache.get(teamDomain);
    if (!entry || nowMs - entry.at > 3600_000 || !entry.keys.some((k) => k.kid === header.kid)) {
      const res = await fetchFn(`https://${teamDomain}/cdn-cgi/access/certs`);
      entry = { at: nowMs, keys: (await res.json()).keys || [] };
      cache.set(teamDomain, entry);
    }
    const jwk = entry.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;

    if (payload.iss !== `https://${teamDomain}`) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return null;
    if (typeof payload.nbf === "number" && payload.nbf * 1000 > nowMs + 60_000) return null;
    const email = String(payload.email || "").toLowerCase();
    if (!email || !allowedEmails.includes(email)) return null;
    return email;
  } catch {
    return null;
  }
}

/** Returns the admin's email, or null. Dev bypass works only when ENVIRONMENT=dev. */
export async function adminEmail(ctx, request) {
  const { env } = ctx;
  if (env.ENVIRONMENT === "dev" && env.ADMIN_DEV_EMAIL) return env.ADMIN_DEV_EMAIL.toLowerCase();
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) return null;
  return verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD,
    allowedEmails: env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    fetchFn: ctx.fetchFn,
    nowMs: ctx.now(),
    cache: ctx.certCache,
  });
}
