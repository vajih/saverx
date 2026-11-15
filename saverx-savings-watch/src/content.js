// Validation + normalization for admin-verified result content. Only known fields survive,
// links must be https, and everything is HTML-escaped at render time (result-page.js).

const httpsUrl = (u) => {
  if (typeof u !== "string" || u.length > 500) return false;
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};
const str = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

export function validateContent(c) {
  if (!c || typeof c !== "object") return { error: "Missing content." };
  if (!str(c.headline, 1, 120)) return { error: "Headline is required (max 120 characters)." };
  if (c.summary != null && c.summary !== "" && !str(c.summary, 1, 600)) return { error: "Summary is too long (max 600)." };
  if (c.eligibility != null && c.eligibility !== "" && !str(c.eligibility, 1, 600)) return { error: "Eligibility note is too long (max 600)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checked_at || "")) return { error: "Checked date must be YYYY-MM-DD." };
  if (!Array.isArray(c.items) || c.items.length < 1 || c.items.length > 6) return { error: "Add 1 to 6 savings options." };
  const items = [];
  for (const it of c.items) {
    if (!it || !str(it.title, 1, 100) || !str(it.text, 1, 500)) return { error: "Each option needs a title and description." };
    if (!httpsUrl(it.url)) return { error: "Each option needs an https link." };
    if (it.terms_url && !httpsUrl(it.terms_url)) return { error: "Terms link must be https." };
    items.push({ title: it.title.trim(), text: it.text.trim(), url: it.url, ...(it.terms_url ? { terms_url: it.terms_url } : {}) });
  }
  const sources = [];
  for (const sRow of c.sources || []) {
    if (!sRow || !str(sRow.label, 1, 100) || !httpsUrl(sRow.url)) return { error: "Each source needs a label and an https link." };
    sources.push({ label: sRow.label.trim(), url: sRow.url });
  }
  if (sources.length > 6) return { error: "Too many sources (max 6)." };
  return {
    value: {
      headline: c.headline.trim(), summary: (c.summary || "").trim(), eligibility: (c.eligibility || "").trim(),
      checked_at: c.checked_at, items, sources,
    },
  };
}
