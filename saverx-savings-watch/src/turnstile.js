const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verifies a Cloudflare Turnstile token. Fails closed unless TURNSTILE_BYPASS=true (dev only). */
export async function verifyTurnstile({ env, token, ip, fetchFn = fetch }) {
  if (env.TURNSTILE_BYPASS === "true") return true;
  if (!env.TURNSTILE_SECRET || typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetchFn(VERIFY_URL, { method: "POST", body });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
