/* Supporting-page interactions. Search terms and form contents stay out of analytics. */
(() => {
  'use strict';
  const search = document.querySelector('#guide-search');
  if (search) {
    const cards = [...document.querySelectorAll('[data-guide-category]')];
    const filters = [...document.querySelectorAll('[data-guide-filter]')];
    let category = 'all';
    function update() {
      let count = 0;
      const query = search.value.trim().toLocaleLowerCase();
      cards.forEach(card => {
        const show = (category === 'all' || card.dataset.guideCategory === category) && card.dataset.guideTitle.includes(query);
        card.hidden = !show;
        if (show) count++;
      });
      document.querySelector('#guide-count').textContent = `${count} guide${count === 1 ? '' : 's'}`;
      document.querySelector('#guide-empty').hidden = count !== 0;
    }
    search.addEventListener('input', update);
    filters.forEach(button => button.addEventListener('click', () => {
      category = button.dataset.guideFilter;
      filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      update();
    }));
    document.querySelector('#guide-reset')?.addEventListener('click', () => {
      category = 'all'; search.value = '';
      filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.guideFilter === 'all')));
      update(); search.focus();
    });
  }
  document.querySelectorAll('[data-contact-topic]').forEach(button => button.addEventListener('click', () => {
    const topic = document.querySelector('#topic');
    if (!topic) return;
    topic.value = button.dataset.contactTopic;
    document.querySelector('#form')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    topic.focus({preventScroll:true});
  }));

  // Same endpoint/field contract as the existing request_med form. Confirm a
  // readable backend acknowledgement rather than claiming an opaque POST saved.
  async function submitRequest(api, fields, fetcher = fetch) {
    if (!api || !/^https:\/\//.test(api)) throw new Error('unavailable');
    const response = await fetcher(api, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(fields).toString()
    });
    if (!response.ok) throw new Error('unconfirmed');
    const result = await response.json();
    if (result.status !== 'ok' || result.sheetError) throw new Error('unconfirmed');
    return true;
  }
  window.SaveRxRequest = {submitRequest};
  const form = document.querySelector('#medication-request-form');
  if (!form) return;
  let pending = false;
  const status = document.querySelector('#request-status');
  const button = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const values = new FormData(form);
    if (String(values.get('website') || '').trim()) return;
    const drug = String(values.get('drug') || '').trim();
    if (!drug) { document.querySelector('#request-drug').focus(); return; }
    pending = true; button.disabled = true;
    form.setAttribute('aria-busy','true');
    button.textContent = 'Sending…'; status.className = 'status'; status.textContent = 'Sending your request…';
    try {
      await submitRequest(window.SAVERX_FORM_API || window.SAVERX_API, {
        email:String(values.get('email') || '').trim(), drug, source:'request_med', ua:navigator.userAgent || ''
      });
      form.reset();
      status.textContent = 'Thanks! Your medication request has been received. You can unsubscribe from savings emails anytime.';
    } catch (_) {
      status.className = 'status error';
      status.textContent = 'We couldn’t confirm your request. Please try again later or email help@saverx.ai. Your entries are still here.';
    } finally {
      pending = false; button.disabled = false; button.textContent = 'Send my request ↗';
      form.removeAttribute('aria-busy');
    }
  });
})();
