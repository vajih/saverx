/**
 * SaveRx.ai — text-alerts waitlist on drug pages (phone + drug capture; no texts are sent from here).
 * Shown only when data/savings-watch.json has { interest: true } AND live is not true
 * (once Savings Watch is live, its own card replaces this).
 *
 * Flow: enter mobile number -> consent is the button tap, with the full disclosure printed directly beneath it
 *       (the exact text on screen is saved with the row as the consent record) -> thanks.
 *       Fallback: "Prefer email instead?" -> the existing consented email list, source tagged.
 * A slim dismissible bar appears after ~12s or ~40% scroll if the card isn't in view (never a full-screen popup).
 * Analytics (GA4 + EventLog beacons) carry only drug_slug + variant. The phone number goes ONLY to the Apps Script
 * endpoint (same as the other forms), never to gtag or any beacon URL.
 * Variant (A/B headline): "coupons" vs "updates", stored per visitor in localStorage.
 */
(function () {
  "use strict";
  var blocks = document.querySelectorAll("[data-sms-interest]");
  if (!blocks.length) return;
  var FORM_API = window.SAVERX_FORM_API ||
    "https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec";
  var DONE_KEY = "sr_si_done";               // set by the homepage band right before it sends the visitor to their drug page
  var CONSENT_VERSION = "2026-11-20-v1";   // bump whenever the disclosure wording in scripts/_add-sms-interest.mjs changes

  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }
  // PII-free beacon -> EventLog (event + slug + variant only).
  function beacon(ev, slug, variant) {
    try { new Image().src = FORM_API + "?mode=track&ev=" + encodeURIComponent(ev) + "&slug=" + encodeURIComponent(slug) + "&x=" + encodeURIComponent(variant) + "&t=" + Date.now(); } catch (_) {}
  }
  function post(fields) {
    var body = new URLSearchParams(fields).toString(), sent = false;
    try { if (navigator.sendBeacon) sent = navigator.sendBeacon(FORM_API, new Blob([body], { type: "application/x-www-form-urlencoded" })); } catch (_) {}
    if (!sent) { try { fetch(FORM_API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, mode: "no-cors", body: body, keepalive: true }); } catch (_) {} }
  }
  function pickVariant() {
    var v = null;
    try { v = window.localStorage.getItem("sr_si_v"); } catch (_) {}
    if (v !== "coupons" && v !== "updates") {
      v = Math.random() < 0.5 ? "coupons" : "updates";
      try { window.localStorage.setItem("sr_si_v", v); } catch (_) {}
    }
    return v;
  }
  // Count each person once per drug as "interested" (same browser, same drug).
  function seenBefore(slug) { try { return JSON.parse(window.localStorage.getItem("sr_si_c") || "[]").indexOf(slug) !== -1; } catch (_) { return false; } }
  function markSeen(slug) {
    try { var l = JSON.parse(window.localStorage.getItem("sr_si_c") || "[]"); if (l.indexOf(slug) === -1) l.push(slug); window.localStorage.setItem("sr_si_c", JSON.stringify(l.slice(-400))); } catch (_) {}
  }
  // US mobile -> +1XXXXXXXXXX, or null. Mirrors normalizeUsPhone() in scripts/Code.gs (which re-validates server-side).
  function normalizePhone(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
    if (/^(\d)\1{9}$/.test(d)) return null;
    if (d.slice(3, 6) === "555" && /^01\d\d$/.test(d.slice(6))) return null;
    return "+1" + d;
  }
  function formatAsTyped(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    d = d.slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return "(" + d.slice(0, 3) + ") " + d.slice(3);
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }
  var HEADLINES = {
    coupons: function (b) { return "Get a text when " + b + " savings or coupons change"; },
    updates: function (b) { return "Get text alerts about " + b; }
  };
  function slugify(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50); }
  // Homepage only: medication type-ahead. Matching a listed drug gives its real slug; anything else is kept as "custom-<text>".
  var drugIndex = {};
  function loadDrugs(listEl) {
    try {
      fetch("/data/drugs.json").then(function (r) { return r.json(); }).then(function (d) {
        (d.items || []).forEach(function (it) {
          if (!it || !it.slug) return;
          [it.name, it.brand].forEach(function (n) {
            n = String(n || "").trim(); if (!n || drugIndex[n.toLowerCase()]) return;
            drugIndex[n.toLowerCase()] = { name: n, slug: it.slug, url: it.url || ("/drugs/" + it.slug + "/") };
            if (listEl && typeof document.createElement === "function") { var o = document.createElement("option"); o.value = n; listEl.appendChild(o); }
          });
        });
      }).catch(function () {});
    } catch (_) {}
  }
  // Small non-blocking confirmation shown on the drug page after a homepage signup (replaces a separate "thanks" page).
  function flash(text) {
    try {
      if (!document.createElement || !document.body) return;
      var f = document.createElement("div"); f.className = "si-flash"; f.setAttribute("role", "status"); f.textContent = text;
      f.addEventListener("click", function () { f.hidden = true; });
      document.body.appendChild(f);
      if (typeof setTimeout === "function") setTimeout(function () { f.hidden = true; }, 9000);
    } catch (_) {}
  }
  function utm(k) { try { return new URLSearchParams(window.location.search).get(k) || ""; } catch (_) { return ""; } }

  fetch("/data/savings-watch.json").then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg || cfg.interest !== true || cfg.live === true) return;   // off, or the real feature is live
    var brandName = "";
    try { var p = document.getElementById("drug-page-profile"); if (p) brandName = JSON.parse(p.textContent).brand || ""; } catch (_) {}
    var variant = pickVariant();

    Array.prototype.forEach.call(blocks, function (b) {
      var slug = b.getAttribute("data-sw-drug") || "none";
      var isHome = b.getAttribute("data-si-home") !== null;                 // homepage band: the visitor types their medication
      var vr = isHome ? "home" : variant;
      var nameAttr = b.getAttribute("data-si-name") || "";                       // guide pages (no drug profile JSON) carry the name themselves
      var pageName = brandName || nameAttr;
      var brand = isHome ? "your medication" : (pageName || "this medication");
      var consentVersion = b.getAttribute("data-si-consent-version") || CONSENT_VERSION;
      var q = function (s) { return b.querySelector(s); };
      var head = q("[data-si-headline]");
      if (head && !isHome) head.textContent = HEADLINES[vr](brand);
      Array.prototype.forEach.call(b.querySelectorAll("[data-si-brand]"), function (el) { el.textContent = brand; });
      b.setAttribute("data-si-variant", vr);
      b.hidden = false; b.style.display = ""; b.removeAttribute("data-launch");
      if (isHome) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-si-home-link]"), function (a) { a.hidden = false; a.style.display = ""; });
        loadDrugs(q("[data-si-drug-list]"));
      }
      track("sms_interest_view", { drug_slug: slug, variant: vr });

      var main = q("[data-si-main]"), thanks = q("[data-si-thanks]"), emailBox = q("[data-si-email]"),
          bar = q("[data-si-bar]"), done = false;
      // Arrived from the homepage band right after signing up for this drug: show "you're on the list" instead of asking again.
      if (!isHome) {
        var arrived = null;
        try { arrived = JSON.parse(window.sessionStorage.getItem(DONE_KEY) || "null"); } catch (_) {}
        if (arrived && arrived.slug === slug && (Date.now() - (arrived.t || 0)) < 600000) {
          try { window.sessionStorage.removeItem(DONE_KEY); } catch (_) {}
          done = true;
          Array.prototype.forEach.call(b.querySelectorAll("[data-si-brand]"), function (el) { el.textContent = arrived.name || brand; });
          if (main) main.hidden = true;
          if (thanks) thanks.hidden = false;
          flash("✓ You’re on the list for " + (arrived.name || brand) + " text alerts. Your savings options are below.");
        }
      }

      // ---- Phone waitlist
      var form = q("[data-si-phone-form]");
      if (form) {
        var phoneIn = form.querySelector("input[name=phone]");
        if (phoneIn && phoneIn.addEventListener) phoneIn.addEventListener("input", function () {
          var f = formatAsTyped(phoneIn.value); if (f !== phoneIn.value) phoneIn.value = f;
        });
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var hp = form.querySelector("input[name=website]"), msg = form.querySelector("[data-si-msg]");
          if (hp && hp.value) return;                                         // honeypot: bots get nothing
          var drugText = pageName || slug, drugSlug = slug, evSlug = slug;
          if (isHome) {
            var dIn = form.querySelector("input[name=drug]");
            var typed = String((dIn && dIn.value) || "").replace(/\s+/g, " ").trim();
            if (typed.length < 2) { if (msg) msg.textContent = "Please enter your medication."; return; }
            var hit = drugIndex[typed.toLowerCase()];
            drugText = hit ? hit.name : typed.slice(0, 80);
            drugSlug = hit ? hit.slug : "custom-" + (slugify(typed) || "other");
            evSlug = hit ? hit.slug : "custom";                              // typed medication names never go to analytics
          }
          var phone = normalizePhone(phoneIn && phoneIn.value);
          if (!phone) { if (msg) msg.textContent = "Please enter a valid 10-digit US mobile number."; return; }
          if (msg) msg.textContent = "";
          var consentEl = form.querySelector("[data-si-consent]");
          var consentText = consentEl ? String(consentEl.textContent || "").replace(/\s+/g, " ").trim() : "";   // exactly what was on screen
          post({
            form_type: "text_waitlist", phone: phone, drug: drugText, drug_slug: drugSlug, variant: vr,
            consent_version: consentVersion, consent_text: consentText,
            source_page: (window.location && window.location.pathname) || "",
            utm_source: utm("utm_source"), utm_medium: utm("utm_medium"), utm_campaign: utm("utm_campaign"),
            useragent: navigator.userAgent || ""
          });
          track("sms_waitlist_signup", { drug_slug: evSlug, variant: vr });   // categorical only, never the number
          if (!seenBefore(evSlug)) { beacon("sms_interest_click", evSlug, vr); markSeen(evSlug); }
          done = true;
          if (isHome) {
            Array.prototype.forEach.call(b.querySelectorAll("[data-si-brand]"), function (el) { el.textContent = drugText; });
            if (hit && hit.url) {                                              // listed drug: straight to its page, no separate confirmation step
              try { window.sessionStorage.setItem(DONE_KEY, JSON.stringify({ slug: hit.slug, name: hit.name, t: Date.now() })); } catch (_) {}
              var go = function () { try { window.location.assign(hit.url); } catch (_) {} };
              if (typeof setTimeout === "function") setTimeout(go, 250); else go();   // brief delay so the beacon request is queued first
            }
          }
          if (main) main.hidden = true;
          if (emailBox) emailBox.hidden = true;
          if (bar) bar.hidden = true;
          if (thanks) thanks.hidden = false;
        });
      }

      // ---- Homepage quick-pick chips
      Array.prototype.forEach.call(b.querySelectorAll("[data-si-chip]"), function (c) {
        c.addEventListener("click", function () {
          var dIn = form && form.querySelector("input[name=drug]"); if (dIn) dIn.value = c.getAttribute("data-si-chip") || "";
          var ph = form && form.querySelector("input[name=phone]"); if (ph && ph.focus) ph.focus();
        });
      });

      // ---- Email fallback (existing consented list)
      var toggle = q("[data-si-email-toggle]");
      if (toggle) toggle.addEventListener("click", function () {
        if (!seenBefore(slug)) { track("sms_interest_click", { drug_slug: slug, variant: vr }); beacon("sms_interest_click", slug, vr); markSeen(slug); }
        if (main) main.hidden = true;
        if (emailBox) { emailBox.hidden = false; var em = emailBox.querySelector("input[type=email]"); if (em && em.focus) em.focus(); }
      });
      var eform = q("[data-si-email-form]");
      if (eform) eform.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = eform.querySelector("input[type=email]"), consent = eform.querySelector("input[type=checkbox]"),
            hp = eform.querySelector("input[name=website]"), msg = eform.querySelector("[data-si-email-msg]");
        if (hp && hp.value) return;
        if (!email || !email.value || email.value.indexOf("@") < 1) { if (msg) msg.textContent = "Enter a valid email address."; return; }
        if (!consent || !consent.checked) { if (msg) msg.textContent = "Please check the box to agree to receive emails."; return; }
        post({ email: email.value.trim(), drug: pageName || slug, source: "SMS interest (" + vr + ")", useragent: navigator.userAgent || "", referrer: document.referrer || "" });
        track("sms_interest_email", { drug_slug: slug, variant: vr });
        beacon("sms_interest_email", slug, vr);
        eform.hidden = true;
        var t = q("[data-si-email-thanks]"); if (t) t.hidden = false;
      });

      // ---- Slim bottom bar: appears once, only if the card isn't in view; dismissible; never blocks the page
      if (bar) {
        var dismissed = false;
        try { dismissed = window.sessionStorage.getItem("sr_si_bx") === "1"; } catch (_) {}
        var cardInView = function () {
          try { var r = b.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; } catch (_) { return false; }
        };
        var showBar = function () {
          if (done || dismissed || !bar.hidden || cardInView()) return;
          bar.hidden = false; track("sms_bar_view", { drug_slug: slug, variant: vr });
        };
        if (typeof setTimeout === "function") setTimeout(showBar, 12000);
        // Some page layouts scroll <body> instead of the window, so listen in the capture phase and measure whichever element scrolled.
        var progress = function (ev) {
          var t = ev && ev.target, el = (t && t.nodeType === 1) ? t : (document.scrollingElement || document.documentElement) || {};
          var max = (el.scrollHeight || 0) - (el.clientHeight || window.innerHeight || 0);
          return max > 0 ? (el.scrollTop || window.scrollY || 0) / max : 0;
        };
        if (typeof window.addEventListener === "function") window.addEventListener("scroll", function (ev) {
          if (progress(ev) >= 0.4) showBar();
        }, { passive: true, capture: true });
        var go = q("[data-si-bar-go]"), x = q("[data-si-bar-x]");
        if (go) go.addEventListener("click", function () {
          track("sms_bar_click", { drug_slug: slug, variant: vr });
          bar.hidden = true;
          try { b.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
          var ph = form && form.querySelector("input[name=phone]"); if (ph && ph.focus) ph.focus();
        });
        if (x) x.addEventListener("click", function () {
          bar.hidden = true; dismissed = true;
          try { window.sessionStorage.setItem("sr_si_bx", "1"); } catch (_) {}
        });
      }
    });
  }).catch(function () { /* switch unreadable: stay hidden */ });
})();
