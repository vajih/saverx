/* =========================================================
   SaveRx.ai — Global Scripts (Homepage)
   - Featured cards loader (AI banner + skeletons)
   - Email modal lead capture for Featured CTAs
   - Newsletter + Request-a-med handlers
   - Sticky header & mobile drawer
   ========================================================= */

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const SCRIPT_URL = (window.PAGE_CONFIG && window.PAGE_CONFIG.scriptUrl) || "";

  // -----------------------------
  // Small utilities
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHTML = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));

  const toForm = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v ?? ""))
      .join("&");

  const money = (n) => {
    const f = Number(n);
    return Number.isFinite(f)
      ? `$${f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "$—";
  };

  // -----------------------------
  // Sticky header shadow + mobile drawer
  // -----------------------------
  (function headerAndDrawer() {
    const header = $(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 2);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const btn = $(".menu-btn");
    const drawer = $("#mobile-drawer");
    if (btn && drawer) {
      btn.addEventListener("click", () => {
        const isOpen = !drawer.hasAttribute("hidden");
        drawer.toggleAttribute("hidden");
        btn.setAttribute("aria-expanded", String(!isOpen));
        document.body.style.overflow = isOpen ? "" : "hidden";
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !drawer.hasAttribute("hidden")) {
          drawer.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        }
      });
    }
  })();

  // -----------------------------
  // Featured cards rendering
  // Exposed as window.renderFeaturedDrugs(urlOrObject)
  // Supports:
  //  - URL returning { items: [...] }
  //  - URL returning [...]
  //  - Array/object passed directly
  // Fields per item:
  //  name, generic, manufacturer, cash_price, as_low_as, url, priority, active
  // -----------------------------
  function cardHTML(d) {
    const name = escapeHTML(d.name);
    const generic = d.generic ? `(${escapeHTML(d.generic)})` : "";
    const manufacturer = d.manufacturer ? ` - ${escapeHTML(d.manufacturer)}` : "";

    const cash = Number(d.cash_price);
    const copay = Number(d.as_low_as);

    const hasBoth = Number.isFinite(cash) && Number.isFinite(copay) && cash > 0 && copay >= 0;
    const pct = hasBoth ? Math.max(0, Math.min(100, Math.round((1 - (copay / cash)) * 100))) : null;

    const cashBlock = Number.isFinite(cash)
      ? `<div class="price"><s>${money(cash)}</s></div>`
      : `<div class="price">$—</div>`;

    const withSavings = Number.isFinite(copay)
      ? `<div class="price">${money(copay)}</div>`
      : `<div class="price">$—</div>`;

    return `
    <article class="drug-card deal-card" role="listitem" aria-label="${name} savings card">
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
          ${pct != null ? `<div class="save">Save ${pct}%</div>` : ``}
        </div>
      </div>

      <div class="deal-cta">
        <a class="btn-lg get-card"
           href="${d.url || "#"}"
           data-drug="${escapeHTML(d.name)}"
           data-url="${d.url || "#"}"
           aria-label="Get savings card for ${escapeHTML(d.name)}">
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
    const wrapper = $("#featured");                 // section wrapper
    const grid = $("#featured-cards");              // injected cards go here
    const textLoader = $("#cards-loading");         // small text loader
    if (!grid || !wrapper) return;

    try {
      let data = urlOrJson;
      if (typeof urlOrJson === "string") {
        const res = await fetch(urlOrJson, { cache: "no-cache" });
        data = await res.json();
      }

      let items = Array.isArray(data) ? data : (data && data.items) ? data.items : [];
      // Filter inactive rows
      items = items.filter((x) => String(x.active).toLowerCase() !== "false");
      // Sort by priority then name
      items.sort(
        (a, b) =>
          (a.priority ?? 999) - (b.priority ?? 999) ||
          String(a.name).localeCompare(String(b.name))
      );

      grid.innerHTML = items.map(cardHTML).join("");

    } catch (err) {
      console.error("Featured load failed", err);
      grid.innerHTML = `<div class="muted">We couldn't load savings right now. Please refresh.</div>`;
    } finally {
      // Remove skeletons/AI loader, hide text loader, flip aria-busy
      $("#skeleton-cards")?.remove();
      $("#ai-loader")?.remove();
      if (textLoader) textLoader.style.display = "none";
      wrapper.classList.remove("loading");
      wrapper.classList.add("loaded");
      wrapper.setAttribute("aria-busy", "false");
    }
  }

  // Expose for the tiny helper in index.html
  window.renderFeaturedDrugs = renderFeaturedDrugs;

 // -----------------------------
// Email capture modal for Featured CTAs
// (opens on click of any .get-card; posts then redirects)
// -----------------------------
(function featuredEmailModal() {
  function init() {
    const modal   = document.querySelector("#email-modal");
    const form    = document.querySelector("#modal-lead-form");
    const emailEl = document.querySelector("#modal-email");
    const drugEl  = document.querySelector("#modal-drug");
    const uaEl    = document.querySelector("#modal-ua");
    const refEl   = document.querySelector("#modal-ref");
    const status  = document.querySelector("#modal-status");
    const submit  = document.querySelector("#modal-submit");

    // If modal isn't in the DOM yet, try again once the DOM is ready
    if (!modal || !form) return;

    let redirectUrl = "/";

    function openModal(drugName, url) {
      if (drugEl) drugEl.value = drugName || "";
      redirectUrl = url || "/";
      if (uaEl)  uaEl.value  = navigator.userAgent || "";
      if (refEl) refEl.value = document.referrer || "";
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => emailEl?.focus(), 10);
    }

    function closeModal() {
      modal.setAttribute("aria-hidden", "true");
      if (status) status.textContent = "";
      if (submit) submit.disabled = false;
      form.reset();
    }

    // Open on any Featured CTA click (delegated)
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a.get-card");
      if (!a) return;

      // allow new-tab behavior
      if (e.metaKey || e.ctrlKey || e.button === 1) return;

      e.preventDefault();
      openModal(
        a.getAttribute("data-drug") || "",
        a.getAttribute("data-url") || a.getAttribute("href") || "/"
      );
    });

    // Close interactions
    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close], .modal-backdrop")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
    });

    // Submit → post → redirect
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (status) status.textContent = "";
      if (submit) submit.disabled = true;

      const email = (emailEl?.value || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (status) status.textContent = "Please enter a valid email.";
        if (submit) submit.disabled = false;
        emailEl?.focus();
        return;
      }

      // cache email locally (optional)
      try { localStorage.setItem("saverx_email", email); } catch {}

      const body = new URLSearchParams(new FormData(form)).toString();

      // Fail-fast timeout so we don't block redirect
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);

      try {
        if (SCRIPT_URL) {
          await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            mode: "no-cors",
            body,
            signal: controller.signal
          });
        }
      } catch (_) {
        // non-fatal; still redirect
      } finally {
        clearTimeout(t);
        if (status) status.textContent = "Opening the official savings site...";
        // Small delay so they see the status
        window.open(redirectUrl, "_blank", "noopener,noreferrer");
        }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    // DOM already ready — initialize now
    init();
  }
})();

  // -----------------------------
  // Newsletter form handler
  // -----------------------------
  (function newsletterHandler() {
    const form = $(".newsletter-form");
    if (!form) return;

    const emailInput = form.querySelector('input[type="email"]');
    const submitBtn  = form.querySelector('button[type="submit"]');

    // Ensure static-page safe defaults
    form.setAttribute("action", "");
    form.setAttribute("method", "get");

    function showMessage(msg) {
      let hint = form.querySelector(".form-hint");
      if (!hint) {
        hint = document.createElement("p");
        hint.className = "form-hint";
        form.appendChild(hint);
      }
      hint.textContent = msg;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const email = (emailInput?.value || "").trim();
      if (!email) { showMessage("Please enter a valid email."); emailInput?.focus(); return; }

      const originalText = submitBtn?.textContent || "Subscribe";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

      try {
        if (SCRIPT_URL) {
          const body = toForm({
            email,
            drug: "",
            source: "newsletter_home",
            useragent: navigator.userAgent || ""
          });

          await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            mode: "no-cors",
            body
          });
        }

        form.reset();
        showMessage("Thanks! You’re subscribed.");
        if (submitBtn) submitBtn.textContent = "Subscribed";
      } catch (err) {
        console.error(err);
        showMessage("Sorry—couldn’t save right now. Please try again.");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      }
    }, { passive: false });
  })();

 // -----------------------------
// Request-a-med handler (guarded)
// -----------------------------
(function requestMedHandler() {
  const form = document.querySelector("#request-form");
  if (!form) return;

  // Prevent double-binding
  if (form.dataset.bound === "request") return;
  form.dataset.bound = "request";

  const drugInput  = document.querySelector("#request-drug");
  const emailInput = document.querySelector("#request-email");
  const hint       = document.querySelector("#request-hint");
  const submitBtn  = form.querySelector('button[type="submit"]');

  const show = (msg) => { if (hint) hint.textContent = msg; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double-submit (re-entrancy)
    if (form.dataset.submitting === "1") return;
    form.dataset.submitting = "1";

    const drug  = (drugInput?.value  || "").trim();
    const email = (emailInput?.value || "").trim();

    if (!drug)  { show("Please enter a medication name."); drugInput?.focus();  form.dataset.submitting = ""; return; }
    if (!email) { show("Please enter a valid email.");     emailInput?.focus(); form.dataset.submitting = ""; return; }

    const original = submitBtn?.textContent || "Notify me";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }
    show("");

    try {
      if (SCRIPT_URL) {
        const body = new URLSearchParams({
          email, drug, source: "request_med", useragent: navigator.userAgent || ""
        }).toString();

        await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          mode: "no-cors",
          body
        }).catch(()=>{ /* swallow network/no-cors */ });
      }

      form.reset();
      show("Got it! We’ll email you when this medication is available.");
      if (submitBtn) submitBtn.textContent = "Request saved";
    } catch (err) {
      console.error(err);
      show("Sorry—couldn’t save right now. Please try again.");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
    } finally {
      form.dataset.submitting = "";
    }
  }, { passive: false });
})();

  // -----------------------------
  // (Optional) Preload: if you want to fire renderFeaturedDrugs
  // here instead of from index.html’s tiny helper, uncomment:
  //
  // document.addEventListener("DOMContentLoaded", () => {
  //   const url = SCRIPT_URL ? `${SCRIPT_URL}?mode=featured` : "";
  //   if (url) renderFeaturedDrugs(url);
  // });
  // -----------------------------

})();
