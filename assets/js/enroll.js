/**
 * SaveRx.ai — Enrollment Help intake (demand-validation test)
 * Drives /get-help/ : quiz-style intake, GA4 funnel events, POST to Apps Script.
 *
 * Privacy rules (do not break):
 *  - GA4 events carry CATEGORICAL values only (drug_slug, step ids, tier).
 *  - email / phone / free text go ONLY to the Apps Script backend, never to gtag.
 */
(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  var FORM_API = window.SAVERX_FORM_API ||
    "https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec";

  // Stripe Payment Links — paste live links here once created in the Stripe
  // dashboard. While empty, paid tiers fall back to a no-charge reservation
  // (tier selection + intake are still recorded; checkout events are skipped).
  var STRIPE_LINKS = {
    paid_999: "",   // e.g. "https://buy.stripe.com/XXXX"  ($9.99 guided enrollment)
    paid_1999: ""   // e.g. "https://buy.stripe.com/YYYY"  ($19.99 guided + follow-up)
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {}
  }

  function uuid() {
    try { return crypto.randomUUID(); }
    catch (_) {
      var s = ""; for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
  }

  var qs = new URLSearchParams(location.search);
  var state = {
    intake_id: uuid(),
    drug_slug: (qs.get("drug") || "").toLowerCase().replace(/[^a-z0-9-]/g, ""),
    drug_brand: "",
    insurance_category: "",
    prescription_status: "",
    primary_difficulty: "",
    difficulty_text: "",
    service_preference: "",
    checkout_result: "not_offered",
    started: false,
    submitted: false
  };

  function prettyName(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Resolve brand name from the static drug index (best effort, silent fallback)
  function resolveDrugName() {
    if (!state.drug_slug) return;
    state.drug_brand = prettyName(state.drug_slug);
    updateDrugLabels();
    fetch("/data/drugs.json", { cache: "force-cache" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var m = (j.items || []).filter(function (i) { return i.slug === state.drug_slug; })[0];
        if (m && (m.brand || m.name)) { state.drug_brand = m.brand || m.name; updateDrugLabels(); }
      })
      .catch(function () {});
  }

  function updateDrugLabels() {
    $$("[data-drug-name]").forEach(function (el) {
      el.textContent = state.drug_brand || "your medication";
    });
  }

  // ── Step navigation ───────────────────────────────────────────────────────
  var STEP_ORDER = ["drug", "insurance", "prescription", "difficulty", "preference", "contact", "checkout", "done"];
  var current = null;

  function stepEl(id) { return $('[data-step="' + id + '"]'); }

  function show(id) {
    $$("[data-step]").forEach(function (el) { el.hidden = el.getAttribute("data-step") !== id; });
    current = id;
    var idx = STEP_ORDER.indexOf(id);
    var visibleSteps = state.drug_slug ? 5 : 6; // question steps before checkout/done
    var qIdx = state.drug_slug ? idx - 1 : idx; // drug step skipped when prefilled
    var bar = $("#progressBar");
    if (bar) {
      var pct = Math.max(0, Math.min(100, Math.round((qIdx / visibleSteps) * 100)));
      if (id === "done" || id === "checkout") pct = 100;
      bar.style.width = pct + "%";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next(fromId) {
    var idx = STEP_ORDER.indexOf(fromId);
    var nextId = STEP_ORDER[idx + 1];
    if (nextId === "checkout" && state.service_preference.indexOf("paid") !== 0) nextId = "done";
    show(nextId);
  }

  function firstStep() { return state.drug_slug ? "insurance" : "drug"; }

  function markStarted() {
    if (state.started) return;
    state.started = true;
    track("intake_start", { drug_slug: state.drug_slug || "none" });
  }

  function stepComplete(id) {
    markStarted();
    track("intake_step", { step_id: id, drug_slug: state.drug_slug || "none" });
  }

  // ── Option buttons ────────────────────────────────────────────────────────
  function wireOptions(stepId, field, onSelect) {
    var root = stepEl(stepId);
    if (!root) return;
    $$(".opt", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".opt", root).forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        state[field] = btn.getAttribute("data-value");
        if (onSelect) onSelect(btn.getAttribute("data-value"));
        setTimeout(function () { stepComplete(stepId); next(stepId); }, 220);
      });
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function postIntake() {
    var body = new URLSearchParams({
      form_type: "enroll_intake",
      intake_id: state.intake_id,
      email: state.email || "",
      phone: state.phone || "",
      drug: state.drug_brand || prettyName(state.drug_slug || "") || "N/A",
      drug_slug: state.drug_slug || "",
      insurance_category: state.insurance_category,
      prescription_status: state.prescription_status,
      primary_difficulty: state.primary_difficulty,
      difficulty_text: state.difficulty_text || "",
      service_preference: state.service_preference,
      checkout_result: state.checkout_result,
      consent_contact: state.consent_contact ? "yes" : "no",
      consent_sms: state.consent_sms ? "yes" : "no",
      visitor_id: (function () { try { return localStorage.getItem("saverx_visitor_id") || ""; } catch (_) { return ""; } })(),
      source: "Enrollment Intake",
      source_page: document.referrer || "",
      utm_source: qs.get("utm_source") || "",
      utm_medium: qs.get("utm_medium") || "",
      utm_campaign: qs.get("utm_campaign") || "",
      useragent: navigator.userAgent || "",
      website: $("#hp") ? $("#hp").value : "" // honeypot
    }).toString();

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(FORM_API, new Blob([body], { type: "application/x-www-form-urlencoded" }));
      } else {
        fetch(FORM_API, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          mode: "no-cors",
          body: body,
          keepalive: true
        });
      }
    } catch (_) { /* backend write must never block the user */ }
  }

  // ── Checkout step ─────────────────────────────────────────────────────────
  function setupCheckout() {
    var link = STRIPE_LINKS[state.service_preference] || "";
    var payWrap = $("#checkoutPay");
    var reserveWrap = $("#checkoutReserve");
    var tierLabel = state.service_preference === "paid_1999" ? "$19.99 — guided enrollment + follow-up & renewal" : "$9.99 — guided enrollment";
    $$("[data-tier-label]").forEach(function (el) { el.textContent = tierLabel; });

    if (link) {
      payWrap.hidden = false; reserveWrap.hidden = true;
      var btn = $("#checkoutBtn");
      btn.addEventListener("click", function () {
        state.checkout_result = "started";
        track("checkout_started", { tier: state.service_preference, drug_slug: state.drug_slug || "none" });
        postIntake(); // re-post with updated checkout_result
        window.open(link + (link.indexOf("?") === -1 ? "?" : "&") + "client_reference_id=" + state.intake_id, "_blank");
      });
      $("#checkoutSkip").addEventListener("click", function (e) {
        e.preventDefault();
        state.checkout_result = "abandoned";
        postIntake();
        show("done");
      });
    } else {
      payWrap.hidden = true; reserveWrap.hidden = false;
      $("#reserveContinue").addEventListener("click", function () { show("done"); });
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    resolveDrugName();
    track("enroll_intake_view", { drug_slug: state.drug_slug || "none" });

    // Returning from a Stripe success redirect
    if (qs.get("checkout") === "success") {
      track("checkout_completed", { tier: qs.get("tier") || "unknown", drug_slug: state.drug_slug || "none" });
      show("done");
      var doneMsg = $("#doneCheckoutMsg");
      if (doneMsg) doneMsg.hidden = false;
      return;
    }

    // Step 0 — drug picker (only when not prefilled)
    var drugInput = $("#drugInput");
    if (drugInput) {
      fetch("/data/drugs.json", { cache: "force-cache" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var dl = $("#drugList");
          (j.items || []).forEach(function (i) {
            var o = document.createElement("option");
            o.value = i.brand || i.name;
            o.setAttribute("data-slug", i.slug);
            dl.appendChild(o);
          });
          drugInput._items = j.items || [];
        })
        .catch(function () {});
      $("#drugContinue").addEventListener("click", function () {
        var v = (drugInput.value || "").trim();
        if (!v) { $("#drugMsg").textContent = "Please enter your medication name."; return; }
        state.drug_brand = v;
        var items = drugInput._items || [];
        var m = items.filter(function (i) { return (i.brand || i.name).toLowerCase() === v.toLowerCase(); })[0];
        state.drug_slug = m ? m.slug : v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        updateDrugLabels();
        stepComplete("drug");
        next("drug");
      });
    }

    // Steps 1–4
    wireOptions("insurance", "insurance_category", function (v) {
      var notice = $("#govNotice");
      if (notice) notice.hidden = !(v === "medicare" || v === "medicaid");
    });
    wireOptions("prescription", "prescription_status");
    wireOptions("difficulty", "primary_difficulty");
    wireOptions("preference", "service_preference", function (v) {
      track("price_tier_selected", { tier: v, drug_slug: state.drug_slug || "none" });
    });

    // Government-insurance notice: informational, user still continues (PAP-help demand is a finding)

    // Step 5 — contact
    var phoneInput = $("#phoneInput");
    if (phoneInput) {
      phoneInput.addEventListener("input", function () {
        $("#smsConsentRow").hidden = !phoneInput.value.trim();
      });
    }
    $("#contactForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = ($("#emailInput").value || "").trim();
      var msg = $("#contactMsg");
      if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Please enter a valid email address."; return; }
      if (!$("#consentCheck").checked) { msg.textContent = "Please check the consent box so we're allowed to contact you."; return; }
      state.email = email;
      state.phone = (phoneInput && phoneInput.value.trim()) || "";
      state.consent_contact = true;
      state.consent_sms = !!(state.phone && $("#smsConsent") && $("#smsConsent").checked);
      state.difficulty_text = ($("#difficultyText") && $("#difficultyText").value.trim().slice(0, 500)) || "";

      state.submitted = true;
      stepComplete("contact");
      track("intake_complete", {
        drug_slug: state.drug_slug || "none",
        insurance_category: state.insurance_category,
        tier: state.service_preference
      });
      postIntake();

      if (state.service_preference.indexOf("paid") === 0) { setupCheckout(); show("checkout"); }
      else { show("done"); }
    });

    // Back buttons
    $$("[data-back]").forEach(function (b) {
      b.addEventListener("click", function () {
        var idx = STEP_ORDER.indexOf(current);
        var prev = STEP_ORDER[idx - 1];
        if (prev === "drug" && state.drug_slug && qs.get("drug")) prev = null; // can't go before prefilled start
        if (prev === "checkout") prev = "contact";
        if (prev) show(prev);
      });
    });

    show(firstStep());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
