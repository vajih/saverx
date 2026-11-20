// Input validation. Pure functions, no I/O.

/** Normalizes a US phone number to E.164 (+1XXXXXXXXXX), or returns null. */
export function normalizeUsPhone(input) {
  if (typeof input !== "string" || input.length > 30) return null;
  let d = input.replace(/[\s().-]/g, "");
  if (d.startsWith("+")) {
    if (!d.startsWith("+1")) return null;
    d = d.slice(2);
  } else if (d.length === 11 && d.startsWith("1")) {
    d = d.slice(1);
  }
  if (!/^\d{10}$/.test(d)) return null;
  // NANP: area code and exchange cannot start with 0 or 1
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return "+1" + d;
}

export function isValidSlug(s) {
  return typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(s);
}

export function isValidCode(s) {
  return typeof s === "string" && /^\d{4,10}$/.test(s);
}

// ---- UTM attribution (campaign tracking for paid tests). UTM values are not PII, but they must never become a back door for it.
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const UTM_MAX = 100;

/**
 * Normalizes one UTM value to lowercase [a-z0-9_-] (other character runs become "-"), or returns null (drop it) when it is
 * empty, longer than 100 characters after normalization, looks like an email address, or contains a phone-like run
 * (10+ digits within one run of digits and phone punctuation). KEEP IN SYNC with sanitizeUtm() in assets/js/savings-watch.js
 * (a test runs both on the same inputs).
 */
export function sanitizeUtm(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw.length > 300) return null;
  if (raw.indexOf("@") !== -1) return null;
  const runs = raw.match(/[0-9 ().+\-]+/g) || [];
  for (const run of runs) if (run.replace(/\D/g, "").length >= 10) return null;
  const v = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!v || v.length > UTM_MAX) return null;
  return v;
}

/** Picks and sanitizes the five utm_* fields from a request body. Missing or rejected values are null. */
export function readUtm(body) {
  const out = {};
  for (const k of UTM_KEYS) out[k] = sanitizeUtm(body && body[k]);
  return out;
}
