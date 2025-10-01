/* =========================================================
   SaveRx shared script (keeps your existing functionality)
   ========================================================= */

// ---- Existing config (kept) ----
const { drug, manufacturerUrl, scriptUrl } = window.PAGE_CONFIG || {};
if (!drug || !manufacturerUrl || !scriptUrl) {
  console.warn("PAGE_CONFIG is missing required fields.");
}

// ---- Existing helpers (kept) ----
// Serialize to x-www-form-urlencoded
function toForm(data) {
  return Object.entries(data)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");
}

// Post lead to Google Apps Script (writes to Sheet1)
async function postLead(email, source) {
  const payload = {
    email,
    drug: drug || "Unknown",
    source,
    useragent: navigator.userAgent || "unknown"
  };

  try {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm(payload),
      mode: "no-cors" // simple, reliable for Apps Script web apps
    });
  } catch (e) {
    console.warn("Lead post failed (continuing redirect):", e);
  }
}

// ---- Existing modal code (kept) ----
const modal = document.getElementById("emailModal");
if (modal) {
  document.querySelectorAll("[data-open-modal]").forEach(btn =>
    btn.addEventListener("click", () => {
      modal.setAttribute("open", "");
      const box = document.getElementById("modalEmail");
      if (box) box.focus();
    })
  );
  document
    .querySelectorAll("[data-close-modal]")
    .forEach(btn => btn.addEventListener("click", () => modal.removeAttribute("open")));
}

// Handle modal form
const modalForm = document.getElementById("modalForm");
if (modalForm) {
  modalForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("modalEmail").value.trim();
    if (!email) return;
    document.getElementById("modalSubmit").disabled = true;
    await postLead(email, `${(drug || 'unknown').toLowerCase()}-hero-modal`);
    window.location.href = manufacturerUrl;
  });
}

// Handle footer form
const footerForm = document.getElementById("footerForm");
if (footerForm) {
  footerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("footerEmail").value.trim();
    if (!email) return;
    document.getElementById("footerSubmit").disabled = true;
    await postLead(email, `${(drug || 'unknown').toLowerCase()}-footer`);
    window.location.href = manufacturerUrl;
  });
}

/* =========================================================
   NEW: Homepage “Featured Drugs” renderer
   - Exposes window.renderFeaturedDrugs(jsonPath)
   - You already call this in index.html
   ========================================================= */
(function(){
  const $grid = () => document.getElementById('featured-cards');
  const $loading = () => document.getElementById('cards-loading');

  const money = (n) => {
    const f = Number(n);
    return Number.isFinite(f)
      ? `$${f.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
      : '$—';
  };

  function cardHTML(d) {
    const asLow = (d.as_low_as === 0 || d.as_low_as === 0.0)
      ? '<strong>As low as $0.00</strong>'
      : `<strong>As low as ${money(d.as_low_as)}</strong>`;

    const manu = d.manufacturer ? ` · ${d.manufacturer}` : '';
    const generic = d.generic || '';

    return `
      <article class="drug-card" role="listitem">
        <h3>${d.name}</h3>
        <div class="drug-meta">${generic}${manu}</div>
        <div class="price-row">
          <div>
            <div class="price-large">${money(d.cash_price)}</div>
            <div class="muted" style="font-size:12px;">Typical monthly cash price</div>
          </div>
          <div class="price-note">
            <div>${asLow}</div>
            <div>with savings</div>
          </div>
        </div>
        <a class="btn-primary" href="${d.url}" target="_blank" rel="noopener">Get coupon</a>
      </article>`;
  }

  async function renderFeaturedDrugs(jsonPath) {
    const grid = $grid();
    if (!grid) return; // not on homepage

    try {
      const res = await fetch(jsonPath, { cache: 'no-cache' });
      const data = await res.json();

      // Support either an array or {items:[...]}
      const items = Array.isArray(data) ? data : (data.items || []);
      items.sort((a,b) => (a.priority ?? 999) - (b.priority ?? 999) || a.name.localeCompare(b.name));

      grid.innerHTML = items.map(cardHTML).join('');
    } catch (err) {
      console.error('Failed to load featured-drugs.json', err);
      grid.innerHTML = `<div class="muted">We couldn't load savings right now. Please refresh.</div>`;
    } finally {
      const loader = $loading();
      if (loader) loader.style.display = 'none';
    }
  }

  // expose
  window.renderFeaturedDrugs = renderFeaturedDrugs;
})();
