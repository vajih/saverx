/* =========================================================
   SaveRx.ai — Global Scripts
   - Featured cards loader (AI banner + skeletons)
   - Email modal lead capture for Featured CTAs (new-tab flow)
   - Newsletter + Request-a-med handlers
   - Sticky header & mobile drawer
   - A11y: scroll-lock, focus restore, focus trap
   ========================================================= */

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const SCRIPT_URL = (window.PAGE_CONFIG && window.PAGE_CONFIG.scriptUrl) || "";
  const IS_V2 = document.body?.classList?.contains("design-v2");

  // -----------------------------
  // Small utilities
  // -----------------------------
  const $  = (sel, root = document) => root.querySelector(sel);
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

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // Scroll lock helpers (for modals/drawers)
  const lockScroll = () => { document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden"; };
  const unlockScroll = () => { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; };

  // -----------------------------
  // Sticky header shadow + mobile drawer
  // -----------------------------
  (function headerAndDrawer() {
    const header = $(".site-header") || $(".header"); // v1 or v2
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 2);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const btn = $(".menu-btn");
    const drawer = $("#mobile-drawer");
    if (btn && drawer) {
      const closeDrawer = () => {
        if (!drawer.hasAttribute("hidden")) {
          drawer.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", "false");
          unlockScroll();
        }
      };

      btn.addEventListener("click", () => {
        const isOpen = !drawer.hasAttribute("hidden");
        drawer.toggleAttribute("hidden");
        btn.setAttribute("aria-expanded", String(!isOpen));
        if (isOpen) unlockScroll(); else lockScroll();
      });

      drawer.addEventListener("click", (e) => {
        if (e.target.matches("[data-close], .drawer-backdrop, .drawer-nav a")) closeDrawer();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
      });
    }
  })();

  // -----------------------------
  // Featured cards rendering
  // Exposed as window.renderFeaturedDrugs(urlOrObject)
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
    const wrapper = $("#featured");
    const grid = $("#featured-cards");
    const textLoader = $("#cards-loading");
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
      $("#skeleton-cards")?.remove();
      $("#ai-loader")?.remove();
      if (textLoader) textLoader.style.display = "none";
      wrapper.classList.remove("loading");
      wrapper.classList.add("loaded");
      wrapper.setAttribute("aria-busy", "false");
    }
  }

  // Expose for the helper in index.html
  window.renderFeaturedDrugs = renderFeaturedDrugs;

  // -----------------------------
  // Email capture modal for Featured CTAs
  // (opens on click of any .get-card; posts then opens new tab)
  // -----------------------------
  (function featuredEmailModal() {
    let lastTrigger = null; // For focus restoration

    function init() {
      const modal   = $("#email-modal");
      const form    = $("#modal-lead-form");
      const emailEl = $("#modal-email");
      const drugEl  = $("#modal-drug");
      const uaEl    = $("#modal-ua");
      const refEl   = $("#modal-ref");
      const status  = $("#modal-status");
      const submit  = $("#modal-submit");

      if (!modal || !form) return;

      // Avoid double-binding
      if (form.dataset.bound === "email-modal") return;
      form.dataset.bound = "email-modal";

      let redirectUrl = "/";

      // ---------- Focus trap helpers ----------
      const FOCUSABLE_SEL = [
        'a[href]', 'area[href]',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(',');

      const getFocusable = (container) =>
        Array.from(container.querySelectorAll(FOCUSABLE_SEL))
          .filter(el => el.offsetParent !== null || el.getClientRects().length);

      function trapFocus(e) {
        if (e.key !== "Tab") return;
        const nodes = getFocusable(modal);
        if (!nodes.length) return;
        const first = nodes[0];
        const last  = nodes[nodes.length - 1];
        if (!modal.contains(document.activeElement)) { first.focus(); e.preventDefault(); return; }
        if (e.shiftKey) {
          if (document.activeElement === first) { last.focus(); e.preventDefault(); }
        } else {
          if (document.activeElement === last) { first.focus(); e.preventDefault(); }
        }
      }
      // ----------------------------------------

      function openModal(drugName, url, triggerEl) {
        if (drugEl) drugEl.value = drugName || "";
        redirectUrl = url || "/";
        if (uaEl)  uaEl.value  = navigator.userAgent || "";
        if (refEl) refEl.value = document.referrer || "";

        lastTrigger = triggerEl || document.activeElement || null;

        // v2 display
        modal.classList.add("open");                 // <-- NEW for v2 CSS
        modal.setAttribute("aria-hidden", "false");
        lockScroll();

        // Start trapping focus
        modal.addEventListener("keydown", trapFocus);

        // Initial focus
        setTimeout(() => emailEl?.focus(), 10);
      }

      function closeModal() {
        modal.classList.remove("open");              // <-- NEW for v2 CSS
        modal.setAttribute("aria-hidden", "true");
        if (status) status.textContent = "";
        if (submit) submit.disabled = false;
        form.reset();
        unlockScroll();

        modal.removeEventListener("keydown", trapFocus);

        if (lastTrigger && typeof lastTrigger.focus === "function") {
          lastTrigger.focus();
        }
      }

      // Open on any Featured CTA click (delegated)
      document.addEventListener("click", (e) => {
        const a = e.target.closest("a.get-card");
        if (!a) return;

        // Allow user-initiated new-tab behavior (Cmd/Ctrl/Middle)
        if (e.metaKey || e.ctrlKey || e.button === 1) return;

        e.preventDefault();
        openModal(
          a.getAttribute("data-drug") || "",
          a.getAttribute("data-url") || a.getAttribute("href") || "/",
          a
        );
      });

      // Close interactions
      modal.addEventListener("click", (e) => {
        if (e.target.matches("[data-close], .modal-backdrop")) closeModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
      });

      // Submit → post → delay → close → navigate new tab
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (form.dataset.submitting === "1") return;   // prevent double submit
        form.dataset.submitting = "1";

        if (status) status.textContent = "";
        if (submit) submit.disabled = true;

        const email = (emailEl?.value || "").trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          if (status) status.textContent = "Please enter a valid email.";
          if (submit) submit.disabled = false;
          form.dataset.submitting = "";
          emailEl?.focus();
          return;
        }

        try { localStorage.setItem("saverx_email", email); } catch {}

        // OPEN A TAB IMMEDIATELY to avoid popup blockers.
        let pendingWin = null;
        try { pendingWin = window.open("about:blank", "_blank"); } catch (_) {}

        const body = new URLSearchParams(new FormData(form)).toString();

        // Fail-fast timeout so we don't block UX
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
          // non-fatal; still continue to redirect
        } finally {
          clearTimeout(t);

          if (status) status.textContent = "Opening the official savings site…";
          await sleep(1200);

          // Add UTM tagging to the outbound manufacturer URL
          let outbound = redirectUrl || "/";
          try {
            const u = new URL(redirectUrl, location.href);
            u.searchParams.set("utm_source", "saverx.ai");
            u.searchParams.set("utm_medium", "referral");
            u.searchParams.set("utm_campaign", "manufacturer_savings");
            outbound = u.toString();
          } catch { /* keep fallback */ }

          // Close the modal (and restore focus/scroll)
          closeModal();

          // Navigate the previously opened tab, or fall back if blocked
          if (pendingWin && !pendingWin.closed) {
            try { pendingWin.location = outbound; }
            catch { window.open(outbound, "_blank", "noopener,noreferrer"); }
          } else {
            window.open(outbound, "_blank", "noopener,noreferrer");
          }

          form.dataset.submitting = "";
        }
      }, { passive: false });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  })();

  // -----------------------------
  // Newsletter form handler (IDs: #newsletter-form, #newsEmail, #newsMsg)
  // -----------------------------
  (function newsletterHandler() {
    const form = $("#newsletter-form");
    if (!form) return;

    const emailInput = $("#newsEmail");
    const submitBtn  = form.querySelector('button[type="submit"]');
    const msgEl      = $("#newsMsg");

    form.setAttribute("action", "");
    form.setAttribute("method", "post");

    const showMessage = (msg) => { if (msgEl) msgEl.textContent = msg; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (emailInput?.value || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { showMessage("Please enter a valid email."); emailInput?.focus(); return; }

      const originalText = submitBtn?.textContent || "Subscribe";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

      try {
        if (SCRIPT_URL) {
          const body = toForm({
            email,
            drug: "",
            source: "newsletter_home",
            ua: navigator.userAgent || ""
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
  // Request-a-med handler (IDs: #med-alert-form, #drugName, #alertEmail, #alertMsg)
  // -----------------------------
  (function requestMedHandler() {
    const form = $("#med-alert-form");
    if (!form) return;
    if (form.dataset.bound === "request") return;
    form.dataset.bound = "request";

    const drugInput  = $("#drugName");
    const emailInput = $("#alertEmail");
    const hint       = $("#alertMsg");
    const submitBtn  = form.querySelector('button[type="submit"]');

    const show = (msg) => { if (hint) hint.textContent = msg; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (form.dataset.submitting === "1") return;
      form.dataset.submitting = "1";

      const drug  = (drugInput?.value  || "").trim();
      const email = (emailInput?.value || "").trim();

      if (!drug)  { show("Please enter a medication name."); drugInput?.focus();  form.dataset.submitting = ""; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { show("Please enter a valid email."); emailInput?.focus(); form.dataset.submitting = ""; return; }

      const original = submitBtn?.textContent || "Notify me";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }
      show("");

      try {
        if (SCRIPT_URL) {
          const body = new URLSearchParams({
            email, drug, source: "request_med", ua: navigator.userAgent || ""
          }).toString();

          await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            mode: "no-cors",
            body
          }).catch(()=>{});
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
  // (Optional) Preload Featured here (you already trigger from HTML)
  // -----------------------------
  // document.addEventListener("DOMContentLoaded", () => {
  //   const url = SCRIPT_URL ? `${SCRIPT_URL}?mode=featured` : "";
  //   if (url) renderFeaturedDrugs(url);
  // });

})(); // end IIFE
