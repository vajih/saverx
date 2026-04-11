/**
 * SaveRx.ai — Cookie Consent Manager
 * Google Consent Mode v2 compliant. No external dependencies.
 * Version: 1
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'saverx_consent';
  var CONSENT_VERSION = 1;
  var CONSENT_TTL = 365 * 24 * 60 * 60 * 1000; // 365 days in ms

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (
        !obj ||
        typeof obj.timestamp !== 'number' ||
        typeof obj.version !== 'number' ||
        Date.now() - obj.timestamp > CONSENT_TTL
      ) {
        return null;
      }
      return obj;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(prefs) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          version: CONSENT_VERSION,
          analytics: !!prefs.analytics,
          advertising: !!prefs.advertising,
          personalization: !!prefs.personalization,
        })
      );
    } catch (e) {}
  }

  function applyConsent(prefs) {
    gtag('consent', 'update', {
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
      ad_storage: prefs.advertising ? 'granted' : 'denied',
      ad_user_data: prefs.advertising ? 'granted' : 'denied',
      ad_personalization: prefs.advertising ? 'granted' : 'denied',
      personalization_storage: prefs.personalization ? 'granted' : 'denied',
    });
  }

  // ─── GPC check ───────────────────────────────────────────────────────────

  function checkGPC() {
    if (navigator.globalPrivacyControl === true) {
      rejectAll(true);
      gtag('event', 'consent_gpc_honored');
      return true;
    }
    return false;
  }

  // ─── Show / hide ─────────────────────────────────────────────────────────

  var banner = null;
  var _openerEl = null;

  function hideBanner() {
    if (!banner) return;
    banner.style.transform = 'translateY(110%)';
    setTimeout(function () {
      if (banner) {
        banner.hidden = true;
        banner.style.transform = '';
      }
    }, 300);
    if (_openerEl) {
      try { _openerEl.focus(); } catch (e) {}
      _openerEl = null;
    }
  }

  // ─── Consent handlers ────────────────────────────────────────────────────

  function acceptAll() {
    var prefs = { analytics: true, advertising: true, personalization: true };
    applyConsent(prefs);
    saveConsent(prefs);
    hideBanner();
    gtag('event', 'consent_accept_all');
  }

  function rejectAll(silent) {
    var prefs = { analytics: false, advertising: false, personalization: false };
    applyConsent(prefs);
    saveConsent(prefs);
    hideBanner();
    if (!silent) gtag('event', 'consent_reject_all');
  }

  function savePreferences(prefs) {
    applyConsent(prefs);
    saveConsent(prefs);
    hideBanner();
    gtag('event', 'consent_custom', {
      analytics: prefs.analytics,
      advertising: prefs.advertising,
      personalization: prefs.personalization,
    });
  }

  // ─── Focus trap ──────────────────────────────────────────────────────────

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) { return !el.closest('[hidden]'); });
  }

  function trapFocus(e) {
    if (!banner || banner.hidden) return;
    var focusable = getFocusable(banner);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      rejectAll(false);
    }
  }

  // ─── Preferences modal content ───────────────────────────────────────────

  function buildPrefsContent(currentPrefs) {
    var wrap = document.createElement('div');
    wrap.className = 'srxcb__prefs';

    var title = document.createElement('p');
    title.className = 'srxcb__title';
    title.textContent = 'Cookie preferences';
    wrap.appendChild(title);

    var cats = [
      {
        key: 'essential',
        label: 'Essential',
        desc: 'Required for the site to function: session continuity and security. Always active.',
        locked: true,
        checked: true,
      },
      {
        key: 'analytics',
        label: 'Analytics',
        desc: 'Google Analytics 4 and event tracking help us understand which pages are useful.',
        locked: false,
        checked: currentPrefs ? !!currentPrefs.analytics : false,
      },
      {
        key: 'advertising',
        label: 'Advertising',
        desc: 'Google Ads, AdSense, and future retargeting partners. Used only if approved.',
        locked: false,
        checked: currentPrefs ? !!currentPrefs.advertising : false,
      },
      {
        key: 'personalization',
        label: 'Personalization',
        desc: 'Remembers your preferences for a better return visit.',
        locked: false,
        checked: currentPrefs ? !!currentPrefs.personalization : false,
      },
    ];

    cats.forEach(function (cat) {
      var row = document.createElement('div');
      row.className = 'srxcb__toggle-row';

      var info = document.createElement('div');
      info.className = 'srxcb__toggle-info';

      var lbl = document.createElement('strong');
      lbl.textContent = cat.label;
      info.appendChild(lbl);

      var desc = document.createElement('span');
      desc.textContent = cat.desc;
      info.appendChild(desc);

      row.appendChild(info);

      var toggleWrap = document.createElement('label');
      toggleWrap.className = 'srxcb__toggle' + (cat.locked ? ' srxcb__toggle--locked' : '');
      toggleWrap.setAttribute('aria-label', cat.label + ' cookies ' + (cat.locked ? '(always active)' : ''));

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = cat.key;
      input.checked = cat.checked;
      input.disabled = cat.locked;
      if (cat.locked) input.setAttribute('aria-disabled', 'true');

      var slider = document.createElement('span');
      slider.className = 'srxcb__slider';

      toggleWrap.appendChild(input);
      toggleWrap.appendChild(slider);
      row.appendChild(toggleWrap);
      wrap.appendChild(row);
    });

    var actions = document.createElement('div');
    actions.className = 'srxcb__actions';

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'srxcb__btn srxcb__btn--outline';
    saveBtn.textContent = 'Save preferences';
    saveBtn.addEventListener('click', function () {
      var prefs = {
        analytics: wrap.querySelector('[name="analytics"]').checked,
        advertising: wrap.querySelector('[name="advertising"]').checked,
        personalization: wrap.querySelector('[name="personalization"]').checked,
      };
      savePreferences(prefs);
    });

    var acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'srxcb__btn srxcb__btn--primary';
    acceptBtn.textContent = 'Accept all';
    acceptBtn.addEventListener('click', acceptAll);

    actions.appendChild(saveBtn);
    actions.appendChild(acceptBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  // ─── Main banner content ─────────────────────────────────────────────────

  function buildBannerContent() {
    var wrap = document.createElement('div');
    wrap.className = 'srxcb__inner';

    var text = document.createElement('p');
    text.className = 'srxcb__text';
    text.innerHTML =
      'We use cookies to analyze site usage and improve your experience. See our <a href="/privacy.html#cookies">Privacy Policy</a> for details.';
    wrap.appendChild(text);

    var actions = document.createElement('div');
    actions.className = 'srxcb__actions';

    var rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'srxcb__btn srxcb__btn--outline';
    rejectBtn.textContent = 'Reject all';
    rejectBtn.addEventListener('click', function () { rejectAll(false); });

    var prefsBtn = document.createElement('button');
    prefsBtn.type = 'button';
    prefsBtn.className = 'srxcb__btn srxcb__btn--ghost';
    prefsBtn.textContent = 'Preferences';
    prefsBtn.addEventListener('click', function () { showPrefs(); });

    var acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'srxcb__btn srxcb__btn--primary';
    acceptBtn.textContent = 'Accept all';
    acceptBtn.addEventListener('click', acceptAll);

    actions.appendChild(rejectBtn);
    actions.appendChild(prefsBtn);
    actions.appendChild(acceptBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  function showPrefs() {
    if (!banner) return;
    var stored = readStored();
    banner.innerHTML = '';
    var closeBtn = makeCloseBtn();
    banner.appendChild(closeBtn);
    banner.appendChild(buildPrefsContent(stored));
    getFocusable(banner)[0] && getFocusable(banner)[0].focus();
  }

  function makeCloseBtn() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'srxcb__close';
    btn.setAttribute('aria-label', 'Close — reject all non-essential cookies');
    btn.textContent = '×';
    btn.addEventListener('click', function () { rejectAll(false); });
    return btn;
  }

  // ─── Inject banner ───────────────────────────────────────────────────────

  function showBanner() {
    if (banner) { banner.hidden = false; return; }

    banner = document.createElement('div');
    banner.className = 'srxcb';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.style.transform = 'translateY(110%)';

    banner.appendChild(makeCloseBtn());
    banner.appendChild(buildBannerContent());

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translateY(0)';
      });
    });

    document.addEventListener('keydown', trapFocus);

    // Focus first button
    setTimeout(function () {
      var focusable = getFocusable(banner);
      if (focusable.length) focusable[0].focus();
    }, 350);
  }

  // ─── Re-open affordance (data-consent-toggle) ────────────────────────────

  function handleToggleTriggers() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-consent-toggle]');
      if (!el) return;
      e.preventDefault();
      _openerEl = el;
      if (!banner) showBanner();
      else { banner.hidden = false; }
      showPrefs();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    // GPC check first — auto reject, no banner
    if (checkGPC()) return;

    var stored = readStored();
    if (stored) {
      // Valid stored consent — apply and skip banner
      applyConsent(stored);
      handleToggleTriggers();
      return;
    }

    // No valid consent — show banner on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        showBanner();
        handleToggleTriggers();
      });
    } else {
      showBanner();
      handleToggleTriggers();
    }
  }

  init();
})();
