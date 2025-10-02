/* =========================================================
   SaveRx.ai — Global Scripts (CLEAN MERGE)
   - Keeps lead capture + modal logic (Repatha etc.)
   - Adds homepage featured-cards renderer for Apps Script JSON
   - No duplicates, no conflicting IIFEs
   ========================================================= */

/* -----------------------------
   Lead capture / modal (kept)
   ----------------------------- */
(function () {
  // Optional per-page config; safe to be undefined on homepage
  const { drug, manufacturerUrl, scriptUrl } = window.PAGE_CONFIG || {};

  // Only warn if some (but not all) fields are present
  if (window.PAGE_CONFIG && (!drug || !manufacturerUrl || !scriptUrl)) {
    console.warn("PAGE_CONFIG is missing required fields.");
  }

  // Serialize to x-www-form-urlencoded
  function toForm(data) {
    return Object.entries(data)
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
      .join("&");
  }

  // Post lead to Google Apps Script (writes to Sheet1)
  async function postLead(email, source) {
    if (!scriptUrl) return; // not configured on homepage; silently ignore
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

  // Modal controls (these elements exist only on drug pages)
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
      const emailEl = document.getElementById("modalEmail");
      const email = emailEl ? emailEl.value.trim() : "";
      if (!email) return;
      const submitBtn = document.getElementById("modalSubmit");
      if (submitBtn) submitBtn.disabled = true;
      await postLead(email, `${(drug || "unknown").toLowerCase()}-hero-modal`);
      if (manufacturerUrl) window.location.href = manufacturerUrl;
    });
  }

  // Handle footer form
  const footerForm = document.getElementById("footerForm");
  if (footerForm) {
    footerForm.addEventListener("submit", async e => {
      e.preventDefault();
      const emailEl = document.getElementById("footerEmail");
      const email = emailEl ? emailEl.value.trim() : "";
      if (!email) return;
      const submitBtn = document.getElementById("footerSubmit");
      if (submitBtn) submitBtn.disabled = true;
      await postLead(email, `${(drug || "unknown").toLowerCase()}-footer`);
      if (manufacturerUrl) window.location.href = manufacturerUrl;
    });
  }
})();

/* -------------------------------------------------------
   Homepage Featured Cards (Apps Script JSON -> cards)
   Exposes: window.renderFeaturedDrugs(urlOrObject)
   - Accepts a URL (fetch JSON) or a pre-fetched object
   - Supports { items: [...] } or an array directly
   - Fields expected per item:
     name, generic, manufacturer, cash_price, as_low_as, url, priority, active
   ------------------------------------------------------- */
(function () {
  const $grid = () => document.getElementById("featured-cards");
  const $loading = () => document.getElementById("cards-loading");

  const money = (n) => {
    const f = Number(n);
    return Number.isFinite(f)
      ? `$${f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "$—";
  };

  // Card template (approved design with red strike on cash price)
  function cardHTML(d) {
    const manufacturer = d.manufacturer ? ` · ${d.manufacturer}` : "";
    const generic = d.generic || "";

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
            <path d="M9 12l2 2 4-4" stroke="#065f46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="12" cy="12" r="9" stroke="#065f46" stroke-width="2"></circle>
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
            <path d="M9 12l2 2 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
          </svg>
          Fast, official manufacturer link
        </div>
      </div>
    </article>`;
  }

  async function renderFeaturedDrugs(urlOrJson) {
    const grid = $grid();
    if (!grid) return; // not on homepage

    try {
      // Accept a URL (string) OR a pre-parsed object/array
      let data = urlOrJson;
      if (typeof urlOrJson === "string") {
        const res = await fetch(urlOrJson, { cache: "no-cache" });
        data = await res.json();
      }

      // Support: array directly OR { items: [...] } (your Apps Script)
      let items = Array.isArray(data) ? data : (data && data.items) ? data.items : [];

      // Filter out inactive rows (Apps Script uses boolean where 'false' hides item)
      items = items.filter(x => String(x.active).toLowerCase() !== "false");

      // Sort by priority then name
      items.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || String(a.name).localeCompare(String(b.name)));

      grid.innerHTML = items.map(cardHTML).join("");
    } catch (err) {
      console.error("Featured load failed", err);
      grid.innerHTML = `<div class="muted">We couldn't load savings right now. Please refresh.</div>`;
    } finally {
      const loader = $loading();
      if (loader) loader.style.display = "none";
    }
  }

  // Expose for index.html
  window.renderFeaturedDrugs = renderFeaturedDrugs;
})();
