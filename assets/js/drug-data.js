/* Shared read-only drug loader for the existing static pages.
 * Only a successful live response supplies prices. Local names keep a failed API
 * from producing a blank page; cached prices are never treated as current offers.
 */
(() => {
  'use strict';
  const requests = new Map();
  async function json(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {cache:'no-cache', signal:controller.signal});
      if (!response.ok) throw new Error('Could not load medication data');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function load(api, slug) {
    try {
      const result = await json(`${api}?mode=drug&slug=${encodeURIComponent(slug)}`);
      if (result?.item && typeof result.item === 'object') return result.item;
    } catch (_) { /* Fall back to the same API's featured feed. */ }
    try {
      const featured = await json(`${api}?mode=featured`);
      const items = Array.isArray(featured) ? featured : featured.items || [];
      const match = items.find(item => (item.slug || String(item.name || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')) === slug);
      if (match) return {
        brand:match.name || match.brand, generic:match.generic,
        manufacturer:match.manufacturer, manufacturerUrl:match.url,
        cash_price:match.cash_price, copay_price:match.as_low_as,
        drug_class:match.drug_class, indication:match.indication,
        description:match.description
      };
    } catch (_) { /* Show an explicit unavailable state, not an invented offer. */ }
    let name = slug.replace(/-/g,' ').replace(/\b\w/g,c => c.toUpperCase());
    try {
      const directory = await json('/data/drugs.json');
      const item = (directory.items || []).find(m => m.slug === slug);
      name = item?.brand || item?.name || name;
    } catch (_) {}
    return {brand:name, _unavailable:true};
  }
  window.SaveRxDrugData = {
    load(api, slug) {
      const key = `${api}|${slug}`;
      if (!requests.has(key)) requests.set(key, load(api, slug));
      return requests.get(key);
    },
    amount(value) {
      return value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value);
    }
  };
})();
