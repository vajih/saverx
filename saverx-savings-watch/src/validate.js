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
