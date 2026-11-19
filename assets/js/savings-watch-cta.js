/**
 * SaveRx.ai — reveals the Savings Watch card (drug pages) / strip (other pages) when the switch is on.
 * Switch file: /data/savings-watch.json  { live: boolean, open: [drug slugs] }
 * Everything ships hidden; if the file can't be read or live !== true, nothing is shown (safe default).
 * GA4 events are categorical only (drug_slug, placement). Never put phone numbers in analytics.
 */
(function () {
  "use strict";
  var blocks = document.querySelectorAll("[data-savings-watch-cta]");
  if (!blocks.length) return;
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }

  fetch("/data/savings-watch.json").then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg || cfg.live !== true) return;
    var open = Array.isArray(cfg.open) ? cfg.open : [];
    var brand = "";
    try { var p = document.getElementById("drug-page-profile"); if (p) brand = JSON.parse(p.textContent).brand || ""; } catch (_) {}

    Array.prototype.forEach.call(blocks, function (b) {
      var slug = b.getAttribute("data-sw-drug");               // drug pages only
      if (slug && open.indexOf(slug) === -1) return;            // this drug isn't open yet
      b.hidden = false; b.style.display = ""; b.removeAttribute("data-launch");
      if (brand) Array.prototype.forEach.call(b.querySelectorAll("[data-sw-brand]"), function (el) { el.textContent = brand; });
      var link = b.querySelector("a[data-sw-link]");
      if (link) link.addEventListener("click", function () { track("savings_watch_cta_click", { drug_slug: slug || "none", placement: slug ? "drug_card" : "site_strip" }); });
      track("savings_watch_cta_view", { drug_slug: slug || "none", placement: slug ? "drug_card" : "site_strip" });
    });
  }).catch(function () { /* switch unreadable: stay hidden */ });
})();
