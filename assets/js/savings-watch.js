/**
 * SaveRx.ai — Savings Watch signup (/savings-watch/?drug=repatha)
 * Flow: phone + consent -> text code -> verify -> done. Talks only to our Worker API (same origin).
 *
 * Privacy rules (do not break):
 *  - GA4 events carry CATEGORICAL values only (drug_slug, step). Phone numbers never go to gtag.
 *  - The consent wording shown is fetched from the server (single source of truth, stored verbatim).
 */
(function () {
  "use strict";
  var cfg = window.SAVERX_SAVINGS || { api: "/api/savings", turnstileSiteKey: "" };
  var API = cfg.api;
  function $(s) { return document.querySelector(s); }
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }

  var slug = (new URLSearchParams(location.search).get("drug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  var state = { requestId: "", token: "", busy: false };
  var PILOT = { repatha: "Repatha" };

  function show(step) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-step]"), function (el) { el.hidden = el.getAttribute("data-step") !== step; });
    track("savings_watch_step", { drug_slug: slug || "none", step: step });
  }
  function post(path, body) {
    return fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); });
  }
  function setBusy(btn, busy, label) { state.busy = busy; btn.disabled = busy; if (label) btn.textContent = label; }

  if (!PILOT[slug]) { show("unsupported"); return; }
  Array.prototype.forEach.call(document.querySelectorAll("[data-drug-name]"), function (el) { el.textContent = PILOT[slug]; });
  track("savings_watch_view", { drug_slug: slug });

  // Consent wording comes from the server; the form stays disabled until it loads.
  var submit = $("#swSubmit");
  fetch(API + "/consent").then(function (r) { return r.json(); }).then(function (c) {
    $("#swConsentText").textContent = c.texts.transactional;
    $("#swWatchText").textContent = c.texts.watch;
    submit.disabled = false;
  }).catch(function () { $("#swFormMsg").textContent = "Something went wrong loading this page. Please refresh."; });

  // Optional Turnstile (configured at launch)
  if (cfg.turnstileSiteKey) {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function () { window.turnstile.render("#swTurnstile", { sitekey: cfg.turnstileSiteKey, callback: function (t) { state.token = t; } }); };
    document.head.appendChild(s);
  }

  $("#swForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var msg = $("#swFormMsg"); msg.textContent = "";
    if (!$("#swConsent").checked) { msg.textContent = "Please check the box to agree to receive a text message."; return; }
    if (!$("#swPhone").value.trim()) { msg.textContent = "Enter your mobile number."; return; }
    setBusy(submit, true, "Sending…");
    post("/start", {
      drug_slug: slug, phone: $("#swPhone").value, consent_transactional: true, consent_watch: $("#swWatch").checked,
      hp: $("#swHp").value, turnstile_token: state.token, source_page: document.referrer ? "referral" : "direct"
    }).then(function (res) {
      setBusy(submit, false, "Text me a code ↗");
      if (!res.ok) { msg.textContent = res.data.message || "Please try again."; return; }
      if (res.data.already_verified) { track("savings_watch_duplicate", { drug_slug: slug }); show("done"); return; }
      state.requestId = res.data.request_id;
      track("savings_watch_code_sent", { drug_slug: slug });
      show("code"); $("#swCode").focus();
    }).catch(function () { setBusy(submit, false, "Text me a code ↗"); msg.textContent = "Network problem. Please try again."; });
  });

  $("#swCodeForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var msg = $("#swCodeMsg"), btn = e.target.querySelector("button"); msg.textContent = "";
    setBusy(btn, true, "Checking…");
    post("/verify", { request_id: state.requestId, code: $("#swCode").value.trim() }).then(function (res) {
      setBusy(btn, false, "Verify ↗");
      if (!res.ok) { msg.textContent = res.data.message || "That code didn't match."; return; }
      track("savings_watch_verified", { drug_slug: slug });
      show("done");
    }).catch(function () { setBusy(btn, false, "Verify ↗"); msg.textContent = "Network problem. Please try again."; });
  });
})();
