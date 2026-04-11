/**
 * SaveRx.ai — Cookie Consent Manager
 * Google Consent Mode v2 compliant. Self-contained (injects own CSS).
 * Design: centered modal with backdrop overlay.
 * Version: 2
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'saverx_consent';
  var CONSENT_VERSION = 2;
  var CONSENT_TTL = 365 * 24 * 60 * 60 * 1000;

  // ─── Inject styles (self-contained — no external CSS needed) ─────────────
  (function () {
    if (document.getElementById('srxcb-styles')) return;
    var s = document.createElement('style');
    s.id = 'srxcb-styles';
    s.textContent = [
      /* backdrop */
      '.srxcb-bd{position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s ease;}',
      '.srxcb-bd.srxcb-in{opacity:1;}',
      /* modal card */
      '.srxcb{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.18),0 4px 16px rgba(0,0,0,.1);padding:32px 28px 24px;width:100%;max-width:420px;position:relative;transform:translateY(24px) scale(.97);transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .25s ease;opacity:0;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;font-size:15px;color:#1e293b;}',
      '.srxcb-bd.srxcb-in .srxcb{transform:translateY(0) scale(1);opacity:1;}',
      /* close button */
      '.srxcb__close{position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:22px;line-height:1;color:#64748b;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;padding:0;transition:background .15s,color .15s;}',
      '.srxcb__close:hover{background:#f1f5f9;color:#0f172a;}',
      /* heading + text */
      '.srxcb__heading{font-size:19px;font-weight:700;margin:0 0 12px;padding-right:32px;color:#0f172a;line-height:1.25;}',
      '.srxcb__text{margin:0 0 22px;color:#475569;line-height:1.6;font-size:14px;}',
      '.srxcb__text a{color:#1d4ed8;text-decoration:underline;}',
      /* action buttons */
      '.srxcb__actions{display:flex;gap:10px;flex-wrap:wrap;}',
      '.srxcb__btn{flex:1;min-width:110px;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:2px solid transparent;transition:background .15s,color .15s,border-color .15s;text-align:center;line-height:1;font-family:inherit;}',
      '.srxcb__btn--primary{background:#0f172a;color:#fff;border-color:#0f172a;}',
      '.srxcb__btn--primary:hover{background:#1e293b;border-color:#1e293b;}',
      '.srxcb__btn--outline{background:#fff;color:#0f172a;border-color:#cbd5e1;}',
      '.srxcb__btn--outline:hover{border-color:#94a3b8;background:#f8fafc;}',
      /* reject link */
      '.srxcb__reject{display:block;text-align:center;margin-top:14px;font-size:12px;color:#94a3b8;cursor:pointer;background:none;border:none;font-family:inherit;text-decoration:underline;padding:0;width:100%;}',
      '.srxcb__reject:hover{color:#475569;}',
      /* preferences panel */
      '.srxcb__prefs-title{font-size:17px;font-weight:700;margin:0 0 4px;padding-right:32px;color:#0f172a;}',
      '.srxcb__prefs-sub{font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.5;}',
      '.srxcb__toggle-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #f1f5f9;}',
      '.srxcb__toggle-row:last-of-type{border-bottom:none;}',
      '.srxcb__toggle-info{flex:1;}',
      '.srxcb__toggle-info strong{display:block;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:2px;}',
      '.srxcb__toggle-info span{font-size:12px;color:#64748b;line-height:1.4;}',
      /* toggle switch */
      '.srxcb__toggle{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0;margin-top:2px;cursor:pointer;}',
      '.srxcb__toggle--locked{cursor:not-allowed;opacity:.55;}',
      '.srxcb__toggle input{opacity:0;width:0;height:0;position:absolute;}',
      '.srxcb__slider{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;transition:background .2s;}',
      '.srxcb__slider::before{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}',
      '.srxcb__toggle input:checked + .srxcb__slider{background:#1d4ed8;}',
      '.srxcb__toggle input:checked + .srxcb__slider::before{transform:translateX(18px);}',
      '.srxcb__toggle input:focus-visible + .srxcb__slider{outline:2px solid #1d4ed8;outline-offset:2px;}',
      '.srxcb__prefs-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}',
      /* mobile */
      '@media(max-width:480px){.srxcb{padding:24px 20px 20px;}.srxcb__btn,.srxcb__prefs-actions .srxcb__btn{min-width:0;flex:1;}}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  })();

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

  // ─── DOM refs ─────────────────────────────────────────────────────────────

  var backdrop = null;
  var modal    = null;
  var _openerEl = null;

  function hideModal() {
    if (!backdrop) return;
    backdrop.classList.remove('srxcb-in');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', trapFocus);
    setTimeout(function () { if (backdrop) backdrop.hidden = true; }, 280);
    if (_openerEl) { try { _openerEl.focus(); } catch (e) {} _openerEl = null; }
  }

  function revealModal() {
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { backdrop.classList.add('srxcb-in'); });
    });
    document.addEventListener('keydown', trapFocus);
    setTimeout(function () {
      var els = getFocusable(); if (els.length) els[0].focus();
    }, 300);
  }

  // ─── Consent handlers ────────────────────────────────────────────────────

  function acceptAll() {
    var prefs = { analytics: true, advertising: true, personalization: true };
    applyConsent(prefs); saveConsent(prefs); hideModal();
    gtag('event', 'consent_accept_all');
  }

  function rejectAll(silent) {
    var prefs = { analytics: false, advertising: false, personalization: false };
    applyConsent(prefs); saveConsent(prefs); hideModal();
    if (!silent) gtag('event', 'consent_reject_all');
  }

  function savePreferences(prefs) {
    applyConsent(prefs); saveConsent(prefs); hideModal();
    gtag('event', 'consent_custom', prefs);
  }

  // ─── Focus trap ──────────────────────────────────────────────────────────

  function getFocusable() {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll(
      'button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
    ));
  }

  function trapFocus(e) {
    if (!backdrop || backdrop.hidden) return;
    var els = getFocusable();
    if (!els.length) return;
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault(); els[els.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault(); els[0].focus();
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); rejectAll(false); }
  }

  // ─── Close button ─────────────────────────────────────────────────────────

  function makeClose() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'srxcb__close';
    btn.setAttribute('aria-label', 'Close — reject non-essential cookies');
    btn.innerHTML = '×';
    btn.addEventListener('click', function () { rejectAll(false); });
    return btn;
  }

  // ─── Main screen ──────────────────────────────────────────────────────────

  function renderMain() {
    modal.innerHTML = '';
    modal.appendChild(makeClose());

    var h = document.createElement('h2');
    h.className = 'srxcb__heading';
    h.textContent = 'Cookies Settings';
    modal.appendChild(h);

    var p = document.createElement('p');
    p.className = 'srxcb__text';
    p.innerHTML = 'We use cookies and similar technologies to help personalize content, tailor and measure ads, and provide a better experience. By clicking accept, you agree to this, as outlined in our <a href="/privacy.html#cookies">Cookie Policy</a>.';
    modal.appendChild(p);

    var actions = document.createElement('div');
    actions.className = 'srxcb__actions';

    var acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'srxcb__btn srxcb__btn--primary';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', acceptAll);

    var prefsBtn = document.createElement('button');
    prefsBtn.type = 'button';
    prefsBtn.className = 'srxcb__btn srxcb__btn--outline';
    prefsBtn.textContent = 'Preferences';
    prefsBtn.addEventListener('click', renderPrefs);

    actions.appendChild(acceptBtn);
    actions.appendChild(prefsBtn);
    modal.appendChild(actions);

    var rejectLink = document.createElement('button');
    rejectLink.type = 'button';
    rejectLink.className = 'srxcb__reject';
    rejectLink.textContent = 'Reject all non-essential cookies';
    rejectLink.addEventListener('click', function () { rejectAll(false); });
    modal.appendChild(rejectLink);
  }

  // ─── Preferences screen ───────────────────────────────────────────────────

  function renderPrefs() {
    var stored = readStored();
    modal.innerHTML = '';
    modal.appendChild(makeClose());

    var h = document.createElement('p');
    h.className = 'srxcb__prefs-title';
    h.textContent = 'Cookie Preferences';
    modal.appendChild(h);

    var sub = document.createElement('p');
    sub.className = 'srxcb__prefs-sub';
    sub.textContent = 'Choose which cookies you allow. Essential cookies are always active.';
    modal.appendChild(sub);

    var cats = [
      { key: 'essential',       label: 'Essential',       desc: 'Required for the site to work. Cannot be disabled.',           locked: true,  on: true },
      { key: 'analytics',       label: 'Analytics',       desc: 'Google Analytics 4 — helps us understand how pages are used.', locked: false, on: stored ? !!stored.analytics       : false },
      { key: 'advertising',     label: 'Advertising',     desc: 'Google AdSense — enables ads and improves ad relevance.',      locked: false, on: stored ? !!stored.advertising     : false },
      { key: 'personalization', label: 'Personalization', desc: 'Remembers your preferences for a better return visit.',        locked: false, on: stored ? !!stored.personalization : false },
    ];

    cats.forEach(function (cat) {
      var row = document.createElement('div');
      row.className = 'srxcb__toggle-row';

      var info = document.createElement('div');
      info.className = 'srxcb__toggle-info';
      var strong = document.createElement('strong'); strong.textContent = cat.label;
      var span   = document.createElement('span');   span.textContent   = cat.desc;
      info.appendChild(strong); info.appendChild(span);
      row.appendChild(info);

      var lbl = document.createElement('label');
      lbl.className = 'srxcb__toggle' + (cat.locked ? ' srxcb__toggle--locked' : '');
      lbl.setAttribute('aria-label', cat.label + (cat.locked ? ' (always active)' : ''));
      var inp = document.createElement('input');
      inp.type = 'checkbox'; inp.name = cat.key; inp.checked = cat.on; inp.disabled = cat.locked;
      var slider = document.createElement('span'); slider.className = 'srxcb__slider';
      lbl.appendChild(inp); lbl.appendChild(slider);
      row.appendChild(lbl);
      modal.appendChild(row);
    });

    var pa = document.createElement('div');
    pa.className = 'srxcb__prefs-actions';

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'srxcb__btn srxcb__btn--primary';
    saveBtn.textContent = 'Save preferences';
    saveBtn.addEventListener('click', function () {
      savePreferences({
        analytics:       modal.querySelector('[name="analytics"]').checked,
        advertising:     modal.querySelector('[name="advertising"]').checked,
        personalization: modal.querySelector('[name="personalization"]').checked,
      });
    });

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'srxcb__btn srxcb__btn--outline';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', renderMain);

    pa.appendChild(saveBtn); pa.appendChild(backBtn);
    modal.appendChild(pa);
  }

  // ─── Build backdrop + modal shell ─────────────────────────────────────────

  function createModal() {
    backdrop = document.createElement('div');
    backdrop.className = 'srxcb-bd';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Cookie consent');
    backdrop.hidden = true;
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) rejectAll(false);
    });
    modal = document.createElement('div');
    modal.className = 'srxcb';
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  // ─── Public show functions ─────────────────────────────────────────────────

  function showBanner() {
    if (!backdrop) createModal();
    renderMain(); revealModal();
  }

  function showPrefsModal() {
    if (!backdrop) createModal();
    renderPrefs(); revealModal();
  }

  // ─── Re-open affordance (data-consent-toggle) ────────────────────────────

  function handleToggleTriggers() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-consent-toggle]');
      if (!el) return;
      e.preventDefault();
      _openerEl = el;
      showPrefsModal();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    if (checkGPC()) { handleToggleTriggers(); return; }

    var stored = readStored();
    if (stored) { applyConsent(stored); handleToggleTriggers(); return; }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        showBanner(); handleToggleTriggers();
      });
    } else {
      showBanner(); handleToggleTriggers();
    }
  }

  init();
})();
