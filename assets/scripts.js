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
  const money = (n) => {
    const f = Number(n);
    return Number.isFinite(f)
      ? `$${f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$—';
  };

  const manufacturer = d.manufacturer ? ` · ${d.manufacturer}` : '';
  const generic = d.generic || '';

  const cash = Number(d.cash_price);
  const copay = Number(d.as_low_as);
  const hasBoth = Number.isFinite(cash) && Number.isFinite(copay) && cash > 0;

  const pct = hasBoth ? Math.max(0, Math.min(100, Math.round((1 - (copay / cash)) * 100))) : null;
  const saveLine = pct != null ? `Save ${pct}%` : ``;

  const withSavings = Number.isFinite(copay)
    ? `<div class="price">${money(copay)}</div>`
    : `<div class="price">$—</div>`;

  const cashBlock = Number.isFinite(cash)
    ? `<div class="price"><s>${money(cash)}</s></div>`
    : `<div class="price">$—</div>`;

  return `
  <article class="drug-card deal-card" role="listitem" aria-label="${d.name} savings card">
    <div class="hdr">
      <h3 class="title">${d.name}</h3>
      <span class="badge-verified" title="Official program link">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 12l2 2 4-4" stroke="#065f46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="9" stroke="#065f46" stroke-width="2"/>
        </svg>
        Official link
      </span>
    </div>

    <div class="sub">${generic}${manufacturer}</div>

    <div class="deal" aria-label="Price comparison">
      <div class="cash" aria-label="Typical cash price">
        <div class="label">Typical cash price</div>
        ${cashBlock}
      </div>

      <div class="with" aria-label="Price with savings">
        <div class="label">With savings</div>
        ${withSavings}
        ${pct != null ? `<div class="save">${saveLine}</div>` : ``}
      </div>
    </div>

    <div class="deal-cta">
      <a class="btn-lg" href="${d.url}" target="_blank" rel="noopener"
         aria-label="Get savings card for ${d.name}">
         Get Your Savings Card
      </a>
      <div class="assure">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 12l2 2 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
        </svg>
        Fast, official manufacturer link
      </div>
    </div>
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
