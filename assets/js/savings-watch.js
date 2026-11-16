/**
 * SaveRx.ai — Savings Watch signup (/savings-watch/ or /savings-watch/?drug=repatha)
 * Flow: medication + phone + consent -> text code -> verify -> done. Talks only to our Worker API (same origin).
 *
 * Privacy rules (do not break):
 *  - GA4 events carry CATEGORICAL values only (drug_slug, step). Phone numbers never go to gtag.
 *  - The consent wording in the page must equal saverx-savings-watch/src/consent.js (enforced by a test).
 *  - Pilot: only medications in PILOT can be submitted; the Worker enforces the same list (PILOT_SLUGS).
 */
(function () {
  "use strict";
  var cfg = window.SAVERX_SAVINGS || { api: "/api/savings", turnstileSiteKey: "" };
  var API = cfg.api;
  function $(s) { return document.querySelector(s); }
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }

  var PILOT = { repatha: "Repatha" };   // keep in sync with PILOT_SLUGS in saverx-savings-watch/wrangler.jsonc
  var state = { requestId: "", token: "", busy: false, slug: "", drugs: [] };

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

  // Match what the visitor typed to a medication: pilot list first, then the site's drug directory.
  function resolve(text) {
    var n = norm(text);
    if (!n) return null;
    for (var slug in PILOT) { if (norm(slug) === n || norm(PILOT[slug]) === n) return { slug: slug, name: PILOT[slug], url: "/drugs/" + slug + "/" }; }
    for (var i = 0; i < state.drugs.length; i++) {
      var d = state.drugs[i];
      if (norm(d.name) === n || norm(d.brand) === n || norm(d.slug) === n) return d;
    }
    return null;
  }

  // Analytics values must stay categorical: only a pilot slug, never raw URL input.
  // (A phone-number-like ?drug= value must never reach GA4 as drug_slug.)
  function analyticsSlug() { return PILOT[state.slug] ? state.slug : "none"; }

  function show(step) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-step]"), function (el) { el.hidden = el.getAttribute("data-step") !== step; });
    track("savings_watch_step", { drug_slug: analyticsSlug(), step: step });
  }
  function post(path, body) {
    return fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); });
  }
  function setBusy(btn, busy, label) { state.busy = busy; btn.disabled = busy; if (label) btn.textContent = label; }
  var NETWORK_MSG = "We couldn't reach Savings Watch. It may not be open yet. Please try again later.";

  var drugInput = $("#swDrug"), drugMsg = $("#swDrugMsg"), submit = $("#swSubmit");

  // ---- medication field ----
  function setDrugMsg(text, link, ok) {
    drugMsg.textContent = text;
    drugMsg.className = ok ? "sw-hint" : "sw-hint sw-hint-warn";
    if (link) {
      var a = document.createElement("a");
      a.href = link.href; a.textContent = link.label;
      drugMsg.appendChild(document.createTextNode(" ")); drugMsg.appendChild(a);
    }
  }
  function updateDrug() {
    var typed = drugInput.value, d = resolve(typed);
    state.slug = "";
    Array.prototype.forEach.call(document.querySelectorAll("[data-drug-name]"), function (el) { el.textContent = d ? d.name : "your medication"; });
    if (!typed.trim()) { setDrugMsg("Enter the medication you're interested in."); return; }
    if (!d) { setDrugMsg("We couldn't find that medication. Try the brand name, for example Repatha."); return; }
    if (!PILOT[d.slug]) {
      setDrugMsg("Savings Watch is open for Repatha during the pilot, so " + d.name + " isn't available yet.", { href: d.url, label: "See official savings programs for " + d.name + " ↗" });
      return;
    }
    state.slug = d.slug;
    setDrugMsg("✓ " + d.name + " is available in the pilot.", null, true);
  }

  // Prefill from ?drug= (the Repatha button links here with it); the field defaults to Repatha.
  var param = (new URLSearchParams(location.search).get("drug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (param) drugInput.value = PILOT[param] || param;
  updateDrug();
  drugInput.addEventListener("input", updateDrug);
  drugInput.addEventListener("change", updateDrug);

  // Directory for suggestions + resolving non-pilot names (optional: the page works without it)
  fetch("/data/drugs.json").then(function (r) { return r.json(); }).then(function (data) {
    state.drugs = (data && data.items) || [];
    var list = $("#swDrugList");
    state.drugs.forEach(function (d) { var o = document.createElement("option"); o.value = d.name; list.appendChild(o); });
    updateDrug();
  }).catch(function () { /* suggestions unavailable; pilot drug still works */ });

  track("savings_watch_view", { drug_slug: analyticsSlug() });

  // Consent wording is static in the page (so reviewers and users always see it). The server stores
  // its own copy of the same text by version; a test keeps the two identical.

  // Optional Turnstile (configured at launch). Siteverify tokens are single-use, so a failed
  // submission must reset the widget and clear the token, or every retry would fail the bot
  // check with the already-consumed token. An expired token is cleared the same way.
  var turnstileWidgetId = null;
  function resetTurnstile() {
    state.token = "";
    if (window.turnstile && turnstileWidgetId !== null) { try { window.turnstile.reset(turnstileWidgetId); } catch (_) {} }
  }
  if (cfg.turnstileSiteKey) {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function () {
      turnstileWidgetId = window.turnstile.render("#swTurnstile", {
        sitekey: cfg.turnstileSiteKey,
        callback: function (t) { state.token = t; },
        "expired-callback": function () { state.token = ""; }
      });
    };
    document.head.appendChild(s);
  }

  $("#swForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var msg = $("#swFormMsg"); msg.textContent = "";
    updateDrug();
    if (!state.slug) { msg.textContent = "Choose a medication that's available in the pilot (Repatha)."; drugInput.focus(); return; }
    if (!$("#swPhone").value.trim()) { msg.textContent = "Enter your mobile number."; return; }
    if (!$("#swConsent").checked) { msg.textContent = "Please check the box to agree to receive a text message."; return; }
    setBusy(submit, true, "Sending…");
    post("/start", {
      drug_slug: state.slug, phone: $("#swPhone").value, consent_transactional: true, consent_watch: $("#swWatch").checked,
      hp: $("#swHp").value, turnstile_token: state.token, source_page: document.referrer ? "referral" : "direct"
    }).then(function (res) {
      setBusy(submit, false, "Text me a code ↗");
      if (!res.ok) { resetTurnstile(); msg.textContent = res.data.message || "Please try again."; return; }
      if (res.data.already_verified) { track("savings_watch_duplicate", { drug_slug: analyticsSlug() }); show("done"); return; }
      state.requestId = res.data.request_id;
      track("savings_watch_code_sent", { drug_slug: analyticsSlug() });
      show("code"); $("#swCode").focus();
    }).catch(function () { setBusy(submit, false, "Text me a code ↗"); resetTurnstile(); msg.textContent = NETWORK_MSG; });
  });

  $("#swCodeForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var msg = $("#swCodeMsg"), btn = e.target.querySelector("button"); msg.textContent = "";
    setBusy(btn, true, "Checking…");
    post("/verify", { request_id: state.requestId, code: $("#swCode").value.trim() }).then(function (res) {
      setBusy(btn, false, "Verify ↗");
      if (!res.ok) { msg.textContent = res.data.message || "That code didn't match."; return; }
      track("savings_watch_verified", { drug_slug: analyticsSlug() });
      show("done");
    }).catch(function () { setBusy(btn, false, "Verify ↗"); msg.textContent = NETWORK_MSG; });
  });
})();
