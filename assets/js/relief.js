/* Keep emoji-capable arrows as monochrome text, including dynamically added UI.
 * U+FE0E explicitly requests text presentation on iOS and other platforms.
 */
(() => {
  'use strict';
  const arrows = /([↖↗↘↙↔↕⬅⬆⬇➡])[\uFE0E\uFE0F]?/gu;
  const excluded = 'script,style,textarea,input,pre,code,svg,[contenteditable]:not([contenteditable="false"])';
  function normalize(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const text = node.data.replace(arrows, '$1\uFE0E');
    if (text !== node.data) node.data = text;
  }
  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) { normalize(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) normalize(walker.currentNode);
  }
  function init() {
    scan(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') normalize(record.target);
        else for (const node of record.addedNodes) scan(node);
      }
    }).observe(document.body, {subtree:true, childList:true, characterData:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

/* SaveRx relief UI: local medication search and progressive catalog filtering.
 * No search text or insurance selection is sent to analytics or external services.
 */
(() => {
  'use strict';
  const menu = document.querySelector('.relief-menu');
  const nav = document.querySelector('#relief-navigation');
  function closeMenu() {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      closeMenu(); menu.focus();
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.relief-header')) closeMenu();
  });
  nav?.querySelectorAll('a').forEach(a => {
    if (a.pathname === location.pathname && a.hash === '') a.setAttribute('aria-current', 'page');
    a.addEventListener('click', closeMenu);
  });

  const q = document.querySelector('#q');
  if (q) {
    const cards = [...document.querySelectorAll('.drug[data-name]')];
    const count = document.querySelector('#count');
    const empty = document.querySelector('#empty');
    let category = 'all';
    function filter() {
      let n = 0;
      const value = q.value.trim().toLocaleLowerCase();
      cards.forEach(card => {
        const show = card.dataset.name.includes(value) &&
          (category === 'all' || card.dataset.categories.split(' ').includes(category));
        card.hidden = !show;
        if (show) n++;
      });
      count.textContent = `${n} medication${n === 1 ? '' : 's'}`;
      empty.hidden = n !== 0;
    }
    q.addEventListener('input', filter);
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        category = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(other => {
          other.classList.toggle('active', other === button);
          other.setAttribute('aria-pressed', String(other === button));
        });
        filter();
      });
    });
    q.value = new URLSearchParams(location.search).get('q') || '';
    filter();
  }

  const input = document.querySelector('#medication');
  const results = document.querySelector('#results');
  if (!input || !results) return;
  let medications = [];
  const ready = fetch('/data/drugs.json', {cache: 'no-cache'})
    .then(response => { if (!response.ok) throw new Error('Directory unavailable'); return response.json(); })
    .then(data => { medications = Array.isArray(data.items) ? data.items : []; })
    .catch(() => {}); // The directory link always works, including offline fallback.
  function closeResults() { results.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function addLink(label, href) {
    const a = document.createElement('a'); a.textContent = label; a.href = href; results.append(a);
  }
  function search() {
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) { closeResults(); return; }
    const matches = medications.filter(m => `${m.name || ''} ${m.brand || ''} ${m.generic || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 6);
    matches.forEach(m => {
      if (/^[a-z0-9-]+$/.test(m.slug)) addLink(`${m.brand || m.name} ↗`, `/drugs/${m.slug}/`);
    });
    if (!results.children.length) {
      const p = document.createElement('p');
      p.textContent = 'Explore the medication directory for more options.'; results.append(p);
    }
    addLink('Search the full directory ↗', `/drugs/?q=${encodeURIComponent(query)}`);
    results.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  input.addEventListener('input', search);
  ready.then(() => { if (document.activeElement === input) search(); });
  document.querySelector('#search-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) { input.focus(); return; }
    location.assign(`/drugs/?q=${encodeURIComponent(query)}`);
  });
  document.querySelectorAll('[data-med]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.med; input.focus(); search();
  }));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeResults();
    if (e.key === 'ArrowDown' && !results.hidden) { e.preventDefault(); results.querySelector('a')?.focus(); }
  });
  results.addEventListener('keydown', e => {
    const links = [...results.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    if (e.key === 'Escape') { closeResults(); input.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(index + 1, links.length - 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (index <= 0) input.focus(); else links[index - 1].focus(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) closeResults(); });
})();

// Preserve category alerts with their original backend field names and segmentation.
(() => {
  const form = document.querySelector('#catEmailForm');
  if (!form) return;
  const api = window.SAVERX_FORM_API || window.SAVERX_API;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(form);
    if (values.get('website') || !form.reportValidity()) return;
    const status = form.querySelector('.form-msg');
    const button = form.querySelector('button[type=submit]');
    if (!api) { status.textContent = 'Please try again or contact help@saverx.ai.'; return; }
    button.disabled = true; status.textContent = 'Saving…';
    try {
      const response = await fetch(api, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(values).toString()});
      if (!response.ok) throw new Error('Request failed');
      status.textContent = 'Thanks! Your request has been received.'; form.reset();
    } catch (_) {
      status.textContent = 'We couldn’t confirm your request. Please try again or email help@saverx.ai.';
    } finally { button.disabled = false; }
  });
})();
