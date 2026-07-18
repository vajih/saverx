/**
 * SaveRx.ai — Central outbound link tracking utility
 * Implements docs/UTM_TRACKING_RULES.md (Rule 5: centralized logic).
 *
 * - Standardizes utm_source=saverx / utm_medium=referral on external links
 * - Fires the `official_site_click` GA4 event (drug_slug + placement only —
 *   never PII, never free text)
 * - Safe no-op if gtag/analytics is unavailable or consent was denied
 */
(function () {
  "use strict";

  var STANDARD = { utm_source: "saverx", utm_medium: "referral" };

  function slugFromPath() {
    var m = location.pathname.match(/\/drugs\/([^\/]+)/);
    return m ? m[1] : (location.pathname.replace(/\/+$/, "").split("/").pop() || "unknown");
  }

  /** Append standard UTMs to an external URL. Returns original URL on any failure (Rule 6). */
  function withUtm(url, campaign) {
    try {
      var u = new URL(url, location.origin);
      if (u.hostname && u.hostname !== location.hostname) {
        Object.keys(STANDARD).forEach(function (k) { u.searchParams.set(k, STANDARD[k]); });
        if (campaign) u.searchParams.set("utm_campaign", campaign);
      }
      return u.toString();
    } catch (_) {
      return url;
    }
  }

  /** Fire a GA4 event if gtag exists. Categorical params only. */
  function track(eventName, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", eventName, params || {});
    } catch (_) { /* analytics must never break UX */ }
  }

  window.SaveRxTrack = {
    withUtm: withUtm,
    event: track,
    officialClick: function (slug, placement) {
      track("official_site_click", {
        drug_slug: (slug || slugFromPath()).toLowerCase(),
        placement: placement || "unknown"
      });
    }
  };

  // Global hook used by per-page injected snippets (works across script closures)
  window.__trackOfficialClick = window.SaveRxTrack.officialClick;
})();
