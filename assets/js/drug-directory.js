/* Enrich the compact directory from its existing read-only feed.
 * Display metadata only: cached prices never become live savings claims.
 * Searches remain entirely in the browser.
 */
(() => {
  'use strict';
  if (!document.querySelector('.directory-compact')) return;
  const api = window.SAVERX_FORM_API || window.SAVERX_API;
  if (!api) return;
  const cards = new Map([...document.querySelectorAll('.drug[data-name]')].map(card => [card.querySelector('h3').textContent.trim().toLowerCase(), card]));
  const text = value => typeof value === 'string' ? value.trim().slice(0, 160) : '';
  fetch(api + (api.includes('?') ? '&' : '?') + 'mode=featured', { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Directory metadata unavailable'); return response.json(); })
    .then(data => {
      const records = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(records)) return;
      for (const record of records) {
        const card = cards.get(text(record.name || record.brand).toLowerCase());
        if (!card) continue;
        const generic = text(record.generic), manufacturer = text(record.manufacturer);
        if (generic) card.querySelector('.drug-card-generic').textContent = generic;
        if (manufacturer) {
          let maker = card.querySelector('.drug-card-maker');
          if (!maker) { maker = document.createElement('span'); maker.className = 'drug-card-maker'; card.insertBefore(maker, card.querySelector('.drug-card-paths')); }
          maker.textContent = manufacturer;
        }
        card.dataset.name += ' ' + [generic, manufacturer].filter(Boolean).join(' ').toLowerCase();
      }
      document.querySelector('#q')?.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(() => {}); // Static names, categories and payment routes remain usable.
})();
