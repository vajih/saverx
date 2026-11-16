/**
 * SaveRx.ai — "text updates" demand test on drug pages (fake-door, honest about it).
 * Shown only when data/savings-watch.json has { interest: true } AND live is not true
 * (once Savings Watch is live, its own card replaces this).
 *
 * Flow: "Yes, I'm interested" -> anonymous click counted -> "Text updates aren't live yet" + optional email signup
 *       (existing consented email list, source tagged) -> thanks.
 * NO phone numbers are collected here. Analytics carry only drug_slug + variant. Email goes only to the
 * Apps Script lead endpoint (same as the other drug-page forms), never to gtag.
 * Variant (A/B copy): "coupons" vs "updates", stored per visitor in localStorage.
 */
(function () {
  "use strict";
  var blocks = document.querySelectorAll("[data-sms-interest]");
  if (!blocks.length) return;
  var FORM_API = window.SAVERX_FORM_API ||
    "https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec";

  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }
  // PII-free beacon -> EventLog (event + slug + variant only). Clicks and email signups only; views are GA4-only.
  function beacon(ev, slug, variant) {
    try { new Image().src = FORM_API + "?mode=track&ev=" + encodeURIComponent(ev) + "&slug=" + encodeURIComponent(slug) + "&x=" + encodeURIComponent(variant) + "&t=" + Date.now(); } catch (_) {}
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
  // Count each person once per drug: repeat clicks (same browser, same drug) are not re-counted.
  function clickedBefore(slug) { try { return JSON.parse(window.localStorage.getItem("sr_si_c") || "[]").indexOf(slug) !== -1; } catch (_) { return false; } }
  function markClicked(slug) {
    try { var l = JSON.parse(window.localStorage.getItem("sr_si_c") || "[]"); if (l.indexOf(slug) === -1) l.push(slug); window.localStorage.setItem("sr_si_c", JSON.stringify(l.slice(-400))); } catch (_) {}
  }
  var HEADLINES = {
    coupons: function (b) { return "Want a text when there’s news on " + b + " manufacturer savings and coupons?"; },
    updates: function (b) { return "Want text updates about " + b + "?"; }
  };

  fetch("/data/savings-watch.json").then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg || cfg.interest !== true || cfg.live === true) return;   // off, or the real feature is live
    var brandName = "";
    try { var p = document.getElementById("drug-page-profile"); if (p) brandName = JSON.parse(p.textContent).brand || ""; } catch (_) {}
    var variant = pickVariant();

    Array.prototype.forEach.call(blocks, function (b) {
      var slug = b.getAttribute("data-sw-drug") || "none";
      var brand = brandName || "this medication";
      var head = b.querySelector("[data-si-headline]");
      if (head) head.textContent = HEADLINES[variant](brand);
      Array.prototype.forEach.call(b.querySelectorAll("[data-si-brand]"), function (el) { el.textContent = brand; });
      b.setAttribute("data-si-variant", variant);
      b.hidden = false; b.style.display = ""; b.removeAttribute("data-launch");
      track("sms_interest_view", { drug_slug: slug, variant: variant });

      var btn = b.querySelector("[data-si-btn]"), after = b.querySelector("[data-si-after]"), main = b.querySelector("[data-si-main]");
      if (btn) btn.addEventListener("click", function () {
        if (!clickedBefore(slug)) {                                   // first click for this drug in this browser
          track("sms_interest_click", { drug_slug: slug, variant: variant });
          beacon("sms_interest_click", slug, variant);
          markClicked(slug);
        }
        if (main) main.hidden = true;
        if (after) { after.hidden = false; var em = after.querySelector("input[type=email]"); if (em && em.focus) em.focus(); }
      });

      var form = b.querySelector("[data-si-form]");
      if (form) form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = form.querySelector("input[type=email]"), consent = form.querySelector("input[type=checkbox]"),
            hp = form.querySelector("input[name=website]"), msg = form.querySelector("[data-si-msg]");
        if (hp && hp.value) return;                                          // honeypot: bots get nothing
        if (!email || !email.value || email.value.indexOf("@") < 1) { if (msg) msg.textContent = "Enter a valid email address."; return; }
        if (!consent || !consent.checked) { if (msg) msg.textContent = "Please check the box to agree to receive emails."; return; }
        var body = new URLSearchParams({
          email: email.value.trim(), drug: brandName || slug, source: "SMS interest (" + variant + ")",
          useragent: navigator.userAgent || "", referrer: document.referrer || ""
        }).toString();
        try {
          if (navigator.sendBeacon) navigator.sendBeacon(FORM_API, new Blob([body], { type: "application/x-www-form-urlencoded" }));
          else fetch(FORM_API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, mode: "no-cors", body: body, keepalive: true });
        } catch (_) { /* the visitor still sees success, per site rule: capture failures are silent */ }
        track("sms_interest_email", { drug_slug: slug, variant: variant });   // categorical only, never the address
        beacon("sms_interest_email", slug, variant);
        form.hidden = true;
        var intro = b.querySelector("[data-si-intro]"); if (intro) intro.hidden = true;
        var thanks = b.querySelector("[data-si-thanks]"); if (thanks) thanks.hidden = false;
      });
    });
  }).catch(function () { /* switch unreadable: stay hidden */ });
})();
