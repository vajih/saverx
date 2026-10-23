/* Explicit email handoff before savings-program and pharmacy-price navigation.
 * Contact details go to the existing lead endpoint only, never to analytics.
 */
(() => {
  'use strict';
  const page = document.querySelector('.drug-options-page');
  const dialog = document.querySelector('#drug-email-gate');
  if (!page || !dialog) return;
  const $ = selector => document.querySelector(selector);
  const form = $('#drug-outbound-form');
  const status = $('#gate-status');
  const email = $('#gate-email');
  const submit = form.querySelector('button[type="submit"]');
  const api = window.SAVERX_FORM_API || window.SAVERX_API || 'https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec';
  const selector = '[data-program-link], [data-government-assistance-link], [data-drug-sources] a, #pharmacy-prices a, .js-grx-all';
  let pending = null;
  let busy = false;
  function safeUrl(value) {
    try { const u = new URL(value, location.origin); return u.protocol === 'https:' && u.origin !== location.origin ? u : null; }
    catch { return null; }
  }
  function destination(anchor) {
    const url = safeUrl(anchor.href);
    if (!url || anchor.getAttribute('aria-disabled') === 'true') return null;
    const pharmacy = anchor.matches('#pharmacy-prices a.js-grx-all, .js-grx-all') || /(^|\.)goodrx\.com$/i.test(url.hostname);
    return { url, kind: pharmacy ? 'pharmacy' : 'program', label: pharmacy ? 'Pharmacy price comparison' : 'Official program / assistance resource' };
  }
  function show(target) {
    pending = target;
    $('#gate-destination').textContent = target.label;
    $('#gate-domain').textContent = target.url.hostname.replace(/^www\./, '');
    $('#gate-title').innerHTML = target.kind === 'pharmacy' ? 'One quick step. <em>Then compare.</em>' : 'Your next step, <em>saved.</em>';
    $('#gate-description').textContent = 'Share your email before continuing. We’ll send medication-related savings emails and follow-ups. Unsubscribe anytime.';
    status.textContent = '';
    if (!dialog.open) dialog.showModal();
    email.focus();
  }
  function intercept(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const anchor = event.target.closest('a');
    if (!anchor || !anchor.matches(selector)) return;
    const target = destination(anchor);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation(); // Also blocks legacy pilot window.open handlers.
    show(target);
  }
  document.addEventListener('click', intercept, { capture: true });
  document.addEventListener('auxclick', intercept, { capture: true });
  $('[data-gate-close]').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (!busy) pending = null; });

  async function send(address, target, source) {
    if (busy) return;
    busy = true;
    submit.disabled = true;
    const footerButton = $('#footerSubmit');
    if (footerButton) footerButton.disabled = true;
    status.textContent = 'Sending your email and opening your next step…';
    const footerMessage = $('#footerMsg');
    if (source === 'Drug Page Footer' && footerMessage) footerMessage.textContent = status.textContent;
    const slug = location.pathname.split('/')[2] || '';
    const body = new URLSearchParams({
      email: address, drug: window.__drugName || slug, source,
      useragent: navigator.userAgent || '', referrer: document.referrer || '',
      consent_email: 'yes', website: ''
    }).toString();
    try {
      const queued = navigator.sendBeacon && navigator.sendBeacon(api, new Blob([body], { type: 'application/x-www-form-urlencoded' }));
      if (!queued) {
        const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, mode: 'no-cors', body, keepalive: true });
        if (response.type !== 'opaque' && !response.ok) throw new Error('Lead request failed');
      }
      try {
      if (target.kind === 'program') {
        window.__trackOfficialClick?.(slug, 'email_handoff');
        try { new Image().src = api + '?mode=track&ev=official_site_click&slug=' + encodeURIComponent(slug) + '&t=' + Date.now(); } catch {}
      }
      else if (typeof window.gtag === 'function') window.gtag('event', 'pharmacy_compare_click', { drug_slug: slug, placement: 'email_handoff' });
      } catch {} // Analytics must never prevent the requested navigation.
      window.dispatchEvent(new CustomEvent('saverx:email-queued'));
      let href = target.url.href;
      try { href = window.SaveRxTrack?.withUtm(href, target.url.searchParams.get('utm_campaign') || slug + '-savings-page') || href; } catch {}
      location.assign(href);
    } catch {
      const message = 'We couldn’t send your email. Please try again. Your next step is still here.';
      status.textContent = message;
      if (footerMessage) footerMessage.textContent = message;
      busy = false;
      submit.disabled = false;
      if (footerButton) footerButton.disabled = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!pending || busy || !form.reportValidity() || form.elements.website.value) return;
    send(email.value.trim(), pending, pending.kind === 'pharmacy' ? 'Drug Page Pharmacy Email' : 'Drug Page Program Email');
  });
  // The inline form already asks for email and consent; use the same transport
  // instead of allowing its historical handler to open an ungated destination.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'footerForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const inline = event.target;
    if (busy || !inline.reportValidity() || inline.querySelector('[name="website"]')?.value) return;
    const anchor = $('[data-program-link="self"]');
    const target = anchor && destination(anchor);
    if (!target) { $('#footerMsg').textContent = 'The program link is unavailable. Please try again later.'; return; }
    send($('#footerEmail').value.trim(), target, 'Drug Page Footer');
  }, { capture: true });
})();
