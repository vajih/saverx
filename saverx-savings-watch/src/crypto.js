const enc = new TextEncoder();

/** HMAC-SHA256 hex digest. Used so phones/IPs can be matched without storing a reversible value. */
export async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId() {
  return crypto.randomUUID();
}
