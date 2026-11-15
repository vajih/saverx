// Server-rendered, escaped results page. Served at /r/<token>: noindex, no-store, no-referrer.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Outbound manufacturer links carry the standard SaveRx UTMs (see docs/UTM_TRACKING_RULES.md). */
function outbound(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "saverx");
    u.searchParams.set("utm_medium", "sms");
    u.searchParams.set("utm_campaign", "savings_watch");
    return u.toString();
  } catch { return url; }
}

export const pageHeaders = (nonce) => ({
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    `default-src 'none'; style-src 'self' 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
});

function shell(nonce, title, body, script = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} | SaveRx.ai</title>
<link rel="stylesheet" href="/assets/css/tokens.css">
<style nonce="${nonce}">body{margin:0;background:var(--bg,#f8f7f2);color:var(--text,#26362f);font:16px/1.55 system-ui,sans-serif}
main{max-width:620px;margin:0 auto;padding:28px 18px 60px}.brand{font-weight:700;margin-bottom:20px}
h1{font-size:1.6rem;line-height:1.25;margin:0 0 8px}.card{background:var(--surface,#fffefa);border:1px solid var(--border,#ddd);border-radius:14px;padding:18px;margin:14px 0}
.card h2{font-size:1.05rem;margin:0 0 6px}.btn{display:inline-block;background:var(--teal,#313dc5);color:#fff;border-radius:100px;padding:11px 20px;text-decoration:none;font-weight:600;margin-top:8px}
.btn.alt{background:transparent;color:var(--text,#26362f);border:1px solid var(--border-strong,#aaa);font:inherit;cursor:pointer;margin:6px 6px 0 0}
small,.fine{color:var(--text-2,#6b716a);font-size:.82rem}ul{padding-left:18px}</style></head>
<body><main><div class="brand">SaveRx<small>.ai</small></div>${body}</main>${script}</body></html>`;
}

export function renderResult({ content, expiresAt, nonce, preview = false, outcome = null }) {
  const items = content.items.map((it) =>
    `<div class="card"><h2>${esc(it.title)}</h2><p>${esc(it.text)}</p>` +
    `<a class="btn" href="${esc(outbound(it.url))}" target="_blank" rel="noopener noreferrer nofollow">Go to official program ↗</a>` +
    (it.terms_url ? `<p><a href="${esc(it.terms_url)}" target="_blank" rel="noopener noreferrer nofollow">Program terms ↗</a></p>` : "") + `</div>`).join("");
  const sources = content.sources.length
    ? `<h2>Sources</h2><ul>${content.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(s.label)} ↗</a></li>`).join("")}</ul>` : "";
  const expiry = preview ? "<small>ADMIN PREVIEW. This link has not been sent.</small>"
    : `<small>This private link expires on ${esc(new Date(expiresAt).toUTCString().slice(0, 16))}.</small>`;
  const feedback = preview ? "" :
    `<div class="card" id="fb"><h2>Did this help?</h2><button class="btn alt" data-o="worked">Yes, it worked</button><button class="btn alt" data-o="not_worked">Not for me</button><button class="btn alt" data-o="need_help">I need help</button><p class="fine" id="fbmsg" role="status">${outcome ? "Thanks for your feedback." : ""}</p></div>`;
  const body = `<h1>${esc(content.headline)}</h1>${content.summary ? `<p>${esc(content.summary)}</p>` : ""}${expiry}${items}` +
    (content.eligibility ? `<p><strong>Eligibility:</strong> ${esc(content.eligibility)}</p>` : "") +
    `<p class="fine">Last checked ${esc(content.checked_at)}. Programs change; confirm current terms on the official site. Savings and eligibility are not guaranteed.</p>${sources}${feedback}` +
    `<p class="fine">SaveRx.ai is independent and is not a pharmacy, insurer or the manufacturer. This is not medical advice. Reply STOP to our text messages to opt out. <a href="/privacy.html">Privacy</a></p>`;
  const script = preview ? "" : `<script nonce="${nonce}">document.getElementById("fb").addEventListener("click",function(e){var o=e.target.getAttribute("data-o");if(!o)return;
fetch("/api/savings/outcome",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:location.pathname.split("/").pop(),outcome:o})}).then(function(r){document.getElementById("fbmsg").textContent=r.ok?"Thanks for your feedback.":"Sorry, that didn't save."});});</script>`;
  return shell(nonce, content.headline, body, script);
}

export function renderNotice(nonce, title, message) {
  return shell(nonce, title, `<h1>${esc(title)}</h1><p>${esc(message)}</p><a class="btn" href="/">Go to SaveRx.ai</a>`);
}
