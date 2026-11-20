/**
 * SaveRx.ai — Savings Watch signup (/savings-watch/ or /savings-watch/?drug=repatha)
 * Flow: medication + phone + consent -> text code -> verify -> done. Talks only to our Worker API (same origin).
 *
 * Privacy rules (do not break):
 *  - GA4 events carry CATEGORICAL values only (drug_slug, step). Phone numbers never go to gtag.
 *  - The consent wording in the page must equal saverx-savings-watch/src/consent.js (enforced by a test).
 *  - Only drugs in data/savings-watch.json "open" can be submitted; the Worker enforces the same list (PILOT_SLUGS).
 *  - Campaign tags (utm_*) go to our Worker only (stored on the request row), never to GA4 events; values that look like a
 *    phone number or email are dropped. No ad pixel or third-party tracker here, by design.
 */
(function () {
  "use strict";
  var cfg = window.SAVERX_SAVINGS || { api: "/api/savings", turnstileSiteKey: "" };
  var API = cfg.api;
  function $(s) { return document.querySelector(s); }
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }

  // Fallbacks keep the page working for Repatha even if the data files can't be read.
  var FALLBACK = { slug: "repatha", name: "Repatha", brand: "Repatha", url: "/drugs/repatha/" };
  var state = { requestId: "", token: "", busy: false, slug: "", drugs: [], open: ["repatha"] };

  // --- utm-sanitizer:start (KEEP IN SYNC with sanitizeUtm() in saverx-savings-watch/src/validate.js; a test runs both) ---
  function sanitizeUtm(value) {
    if (typeof value !== "string") return null;
    var raw = value.trim().toLowerCase();
    if (!raw || raw.length > 300) return null;
    if (raw.indexOf("@") !== -1) return null;
    var runs = raw.match(/[0-9 ().+\-]+/g) || [];
    for (var i = 0; i < runs.length; i++) if (runs[i].replace(/\D/g, "").length >= 10) return null;
    var v = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!v || v.length > 100) return null;
    return v;
  }
  // --- utm-sanitizer:end ---
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  function readUtm() {
    var out = {};
    try { var q = new URLSearchParams(location.search); UTM_KEYS.forEach(function (k) { var v = sanitizeUtm(q.get(k)); if (v) out[k] = v; }); } catch (_) {}
    return out;
  }
  var UTM = readUtm();   // read once on landing: the visitor stays on this page through start -> verify

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function isOpen(slug) { return state.open.indexOf(slug) !== -1; }
  function nameOf(slug) {
    for (var i = 0; i < state.drugs.length; i++) if (state.drugs[i].slug === slug) return state.drugs[i].name;
    return slug === FALLBACK.slug ? FALLBACK.name : slug;
  }
  function openNames() { return state.open.map(nameOf).join(", "); }

  // Match what the visitor typed to a medication: the site's drug directory (plus the Repatha fallback).
  function resolve(text) {
    var n = norm(text);
    if (!n) return null;
    var list = state.drugs.length ? state.drugs : [FALLBACK];
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (norm(d.name) === n || norm(d.brand) === n || norm(d.slug) === n) return d;
    }
    return null;
  }

  function show(step) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-step]"), function (el) { el.hidden = el.getAttribute("data-step") !== step; });
    track("savings_watch_step", { drug_slug: state.slug || "none", step: step });
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
    if (!isOpen(d.slug)) {
      setDrugMsg("Savings Watch is open for " + openNames() + " right now, so " + d.name + " isn't available yet.", { href: d.url, label: "See official savings programs for " + d.name + " ↗" });
      return;
    }
    state.slug = d.slug;
    setDrugMsg("✓ " + d.name + " is available now.", null, true);
  }

  // Prefill from ?drug= (the Repatha button links here with it); the field defaults to Repatha.
  var param = (new URLSearchParams(location.search).get("drug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (param) drugInput.value = param === FALLBACK.slug ? FALLBACK.name : param;
  updateDrug();
  drugInput.addEventListener("input", updateDrug);
  drugInput.addEventListener("change", updateDrug);

  // Which drugs are open (rollout switch file shared with the cards/strips)
  fetch("/data/savings-watch.json").then(function (r) { return r.json(); }).then(function (cfg) {
    if (cfg && Array.isArray(cfg.open) && cfg.open.length) { state.open = cfg.open; updateDrug(); }
  }).catch(function () { /* keep the Repatha fallback */ });

  // Directory for suggestions + resolving names (optional: the page works without it)
  fetch("/data/drugs.json").then(function (r) { return r.json(); }).then(function (data) {
    state.drugs = (data && data.items) || [];
    var list = $("#swDrugList");
    state.drugs.forEach(function (d) { var o = document.createElement("option"); o.value = d.name; list.appendChild(o); });
    updateDrug();
  }).catch(function () { /* suggestions unavailable; pilot drug still works */ });

  track("savings_watch_view", { drug_slug: state.slug || "none" });

  // Consent wording is static in the page (so reviewers and users always see it). The server stores
  // its own copy of the same text by version; a test keeps the two identical.

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
    updateDrug();
    if (!state.slug) { msg.textContent = "Choose a medication that's available now (" + openNames() + ")."; drugInput.focus(); return; }
    if (!$("#swPhone").value.trim()) { msg.textContent = "Enter your mobile number."; return; }
    if (!$("#swConsent").checked) { msg.textContent = "Please check the box to agree to receive a text message."; return; }
    setBusy(submit, true, "Sending…");
    var startBody = {
      drug_slug: state.slug, phone: $("#swPhone").value, consent_transactional: true, consent_watch: $("#swWatch").checked,
      hp: $("#swHp").value, turnstile_token: state.token, source_page: document.referrer ? "referral" : "direct"
    };
    UTM_KEYS.forEach(function (k) { if (UTM[k]) startBody[k] = UTM[k]; });
    post("/start", startBody).then(function (res) {
      setBusy(submit, false, "Text me a code ↗");
      if (!res.ok) { msg.textContent = res.data.message || "Please try again."; return; }
      if (res.data.already_verified) { track("savings_watch_duplicate", { drug_slug: state.slug }); show("done"); return; }
      state.requestId = res.data.request_id;
      track("savings_watch_code_sent", { drug_slug: state.slug });
      show("code"); $("#swCode").focus();
    }).catch(function () { setBusy(submit, false, "Text me a code ↗"); msg.textContent = NETWORK_MSG; });
  });

  $("#swCodeForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var msg = $("#swCodeMsg"), btn = e.target.querySelector("button"); msg.textContent = "";
    setBusy(btn, true, "Checking…");
    post("/verify", { request_id: state.requestId, code: $("#swCode").value.trim() }).then(function (res) {
      setBusy(btn, false, "Verify ↗");
      if (!res.ok) { msg.textContent = res.data.message || "That code didn't match."; return; }
      track("savings_watch_verified", { drug_slug: state.slug });
      show("done");
    }).catch(function () { setBusy(btn, false, "Verify ↗"); msg.textContent = NETWORK_MSG; });
  });
})();
