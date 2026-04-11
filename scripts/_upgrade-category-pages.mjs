#!/usr/bin/env node
/**
 * _upgrade-category-pages.mjs
 *
 * Upgrades the 6 remaining category pages (diabetes, heart-cholesterol,
 * autoimmune, migraine, respiratory, mental-health) to match the new
 * weight-loss design: body class, stats bar, card grid, email capture,
 * cleaned CTA band, cat-about, accordion FAQ, related strip, JS block.
 *
 * Run: node scripts/_upgrade-category-pages.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec';

const ALL_CATS = [
  { slug: 'weight-loss',       icon: '⚖️', name: 'Weight Loss &amp; GLP-1',    color: '#10b981', bg: '#ecfdf5', count: 8  },
  { slug: 'diabetes',          icon: '💉', name: 'Diabetes',                   color: '#3b82f6', bg: '#eff6ff', count: 32 },
  { slug: 'heart-cholesterol', icon: '❤️', name: 'Heart &amp; Cholesterol',    color: '#ef4444', bg: '#fef2f2', count: 15 },
  { slug: 'autoimmune',        icon: '🛡️', name: 'Autoimmune &amp; Inflammation', color: '#8b5cf6', bg: '#f5f3ff', count: 25 },
  { slug: 'migraine',          icon: '⚡', name: 'Migraine',                   color: '#f59e0b', bg: '#fffbeb', count: 9  },
  { slug: 'respiratory',       icon: '🫁', name: 'Asthma &amp; Respiratory',  color: '#06b6d4', bg: '#ecfeff', count: 12 },
  { slug: 'mental-health',     icon: '🧠', name: 'Mental Health',              color: '#ec4899', bg: '#fdf2f8', count: 13 },
];

const STATS = {
  'weight-loss':       { savings: '$800/mo', note: 'Telehealth starting at', noteVal: '$145/mo' },
  'diabetes':          { savings: '$600/mo', note: 'Insulin caps at',        noteVal: '$35/mo'  },
  'heart-cholesterol': { savings: '$500/mo', note: 'PCSK9 as low as',        noteVal: '$5/mo'   },
  'autoimmune':        { savings: '$4,500/mo', note: 'Many $0 copay programs', noteVal: null    },
  'migraine':          { savings: '$700/mo', note: 'CGRP preventives from',  noteVal: '$0/mo'   },
  'respiratory':       { savings: '$450/mo', note: 'Inhaler programs from',  noteVal: '$0/mo'   },
  'mental-health':     { savings: '$350/mo', note: 'Copay programs from',    noteVal: '$0/mo'   },
};

const DRUGS = {
  'diabetes':          ['jardiance','farxiga','freestylelibre','januvia','basaglar','lantus','humalog','tresiba','toujeo','tradjenta','invokana','glyxambi','synjardy','xigduo-xr','invokamet-xr','trijardy-xr','janumet-xr','xultophy','steglujan','segluromet','onglyza','qternmet-xr','nesina','oseni','kazano','novolog','fiasp','apidra','lyumjev','afrezza','ryzodeg-70-30','baqsimi'],
  'heart-cholesterol': ['repatha','praluent','leqvio','nexletol','nexlizet','vascepa','entresto','eliquis','xarelto','brilinta','pradaxa','savaysa','corlanor','evkeeza','camzyos'],
  'autoimmune':        ['dupixent','enbrel','rinvoq','tremfya','taltz','cimzia','otezla','xeljanz','actemra','orencia','kevzara','remicade','adbry','vtama','briumvi','mavenclad','kesimpta','ocrevus','tecfidera','tysabri','aubagio','bafiertam','mayzent','zeposia','lemtrada'],
  'migraine':          ['nurtec','aimovig','emgality','ajovy','ubrelvy','qulipta','reyvow','vyepti','treximet'],
  'respiratory':       ['dupixent','fasenra','nucala','cinqair','tezspire','breo-ellipta','advair-diskus','symbicort','trelegy-ellipta','bevespi-aerosphere','breztri-aerosphere','daliresp'],
  'mental-health':     ['vyvanse','adzenys-xr-odt','trintellix','rexulti','auvelity','abilify-mycite','spravato','waklert','aplenzin','wellbutrin-xl'],
};

const NAV_DROPDOWN = `        <div class="nav-dropdown" id="catDropdown">
          <button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="catDropdownMenu">Categories <span class="caret">▾</span></button>
          <div class="nav-dropdown-menu" id="catDropdownMenu" role="menu">
            <a href="/categories/weight-loss/" role="menuitem">⚖️ Weight Loss &amp; GLP-1</a>
            <a href="/categories/diabetes/" role="menuitem">💉 Diabetes</a>
            <a href="/categories/heart-cholesterol/" role="menuitem">❤️ Heart &amp; Cholesterol</a>
            <a href="/categories/autoimmune/" role="menuitem">🛡️ Autoimmune &amp; Inflammation</a>
            <a href="/categories/migraine/" role="menuitem">⚡ Migraine</a>
            <a href="/categories/respiratory/" role="menuitem">🫁 Asthma &amp; Respiratory</a>
            <a href="/categories/mental-health/" role="menuitem">🧠 Mental Health</a>
            <hr>
            <a href="/categories/" role="menuitem"><strong>View all categories →</strong></a>
          </div>
        </div>`;

function relatedStrip(currentSlug) {
  return ALL_CATS
    .filter(c => c.slug !== currentSlug)
    .map(c => `      <a class="cat-related-item" href="/categories/${c.slug}/" style="--item-accent-color:${c.color};--item-accent-bg:${c.bg}">
        <span class="cat-related-icon">${c.icon}</span>
        <span class="cat-related-name">${c.name}</span>
        <span class="cat-related-count">${c.count} medications</span>
      </a>`)
    .join('\n');
}

function statsBarHtml(slug, count) {
  const s = STATS[slug];
  const thirdStat = s.noteVal
    ? `\n      <div class="cat-stat"><span class="cat-stat-label">${s.note}</span><span class="cat-stat-value">${s.noteVal}</span></div>`
    : '';
  return `    <div class="cat-stats-bar">
      <div class="cat-stat"><span class="cat-stat-label">Medications</span><span class="cat-stat-value">${count}</span></div>
      <div class="cat-stat"><span class="cat-stat-label">Avg savings up to</span><span class="cat-stat-value">${s.savings}</span></div>${thirdStat}
    </div>`;
}

function chipsFallbackHtml(slug) {
  const drugs = DRUGS[slug] || [];
  const chips = drugs.map(d => {
    const label = d.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `      <a href="/drugs/${d}/" class="chip">💊 ${label}</a>`;
  }).join('\n');
  return chips;
}

function drugGridSection(slug, catDisplayName) {
  const slugsArray = (DRUGS[slug] || []).map(s => `'${s}'`).join(',');
  const chipsFallback = chipsFallbackHtml(slug);
  const catName = catDisplayName.replace(/&amp;/g, '&');
  return `  <!-- Medications in this category -->
  <section class="cat-drug-grid">
    <h2>All ${catDisplayName} Medications</h2>
    <div id="cat-skeleton" class="cat-skeletons" aria-hidden="true">
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
    </div>
    <div id="cat-drug-cards" class="cards" role="list"></div>
    <div id="cat-chip-fallback" class="chip-grid" style="display:none" aria-label="Medications in this category">
      <p class="cat-fallback-label">Browse medications in this category:</p>
${chipsFallback}
    </div>
  </section>

  <!-- Email savings alerts -->
  <section class="cat-email-capture">
    <h2>Get savings alerts for ${catDisplayName}</h2>
    <p>We'll email you when new manufacturer programs, coupons, or savings cards become available for your medications.</p>
    <form id="catEmailForm" class="cat-signup-form" novalidate>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="email" id="catEmail" name="email" required placeholder="your@email.com"
             inputmode="email" autocomplete="email" aria-label="Email address">
      <input type="hidden" name="drug" value="${catName}">
      <input type="hidden" name="source" value="SaveRx Category - ${slug}">
      <button type="submit" class="cat-submit-btn">Get Savings Alerts</button>
      <p class="form-msg" id="catFormMsg" role="status" aria-live="polite"></p>
    </form>
    <p class="microcopy">No spam. Unsubscribe anytime.</p>
  </section>`;
}

function jsBlock(slug) {
  const slugsArray = (DRUGS[slug] || []).map(s => `'${s}'`).join(',');
  return `  <script>
  /* ---- view_category GA4 ---- */
  if (typeof gtag !== 'undefined') gtag('event','view_category',{category:'${slug}'});
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof gtag !== 'undefined') gtag('event','view_category',{category:'${slug}'});
  });

  /* ---- Nav dropdown ---- */
  (function(){
    var dd = document.getElementById('catDropdown');
    if (!dd) return;
    var btn = dd.querySelector('.nav-dropdown-toggle');
    var menu = dd.querySelector('.nav-dropdown-menu');
    function open() { dd.setAttribute('data-open',''); btn.setAttribute('aria-expanded','true'); }
    function close() { dd.removeAttribute('data-open'); btn.setAttribute('aria-expanded','false'); }
    btn.addEventListener('click', function(e){ e.stopPropagation(); dd.hasAttribute('data-open') ? close() : open(); });
    document.addEventListener('click', close);
    menu.addEventListener('click', function(e){ e.stopPropagation(); });
  })();

  /* ---- Drug card grid fetch ---- */
  (function(){
    var SLUGS = [${slugsArray}];
    var SCRIPT_URL = '${SCRIPT_URL}';
    var skeleton = document.getElementById('cat-skeleton');
    var cardsEl = document.getElementById('cat-drug-cards');
    var fallback = document.getElementById('cat-chip-fallback');
    function esc(s) { return String(s||'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
    fetch(SCRIPT_URL + '?mode=featured', {cache:'no-cache'})
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = Array.isArray(data) ? data : (data.items || []);
        var matched = items.filter(function(item){
          var slug = (item.url||'').replace(/^\\/drugs\\//,'').replace(/\\/$/,'');
          return SLUGS.indexOf(slug) !== -1;
        });
        if (skeleton) skeleton.remove();
        if (!matched.length) { if (fallback) fallback.style.display = ''; return; }
        cardsEl.innerHTML = matched.map(function(item){
          var brand = esc(item.name||'');
          var generic = esc(item.generic||'');
          var url = item.url || '#';
          var cashPrice = (item.cash_price != null && !isNaN(+item.cash_price)) ? '$'+Number(item.cash_price).toLocaleString() : '';
          var asLow = (item.as_low_as != null && !isNaN(+item.as_low_as)) ? 'As low as $'+Number(item.as_low_as).toLocaleString() : '';
          return '<article class="card" role="listitem" style="text-align:left">'
            +'<div style="padding:20px">'
            +'<h3 style="margin:0 0 4px;font-size:18px">'+brand+'</h3>'
            +(generic ? '<p style="margin:0 0 8px;font-size:13px;color:#64748b">'+generic+'</p>' : '')
            +(cashPrice||asLow ? '<p style="margin:0 0 12px;font-size:14px">'+(cashPrice?'Cash price: <strong>'+cashPrice+'</strong>':'')+( cashPrice&&asLow?' &middot; ':'')+( asLow?'<strong style=\\'color:#16a34a\\'>'+asLow+'</strong>':'')+'</p>' : '')
            +'<a class="btn btn-primary" href="'+url+'">View savings &rarr;</a>'
            +'</div></article>';
        }).join('');
        var matchedSlugs = matched.map(function(item){ return (item.url||'').replace(/^\\/drugs\\//,'').replace(/\\/$/,''); });
        var unmatched = SLUGS.filter(function(s){ return matchedSlugs.indexOf(s) === -1; });
        if (unmatched.length && fallback) {
          var chipHtml = unmatched.map(function(s){
            var label = s.charAt(0).toUpperCase()+s.slice(1).replace(/-/g,' ');
            return '<a href="/drugs/'+s+'/" class="chip">💊 '+label+'</a>';
          }).join('');
          fallback.innerHTML = '<p class="cat-fallback-label">Also in this category:</p>' + chipHtml;
          fallback.style.display = '';
        }
      })
      .catch(function(){
        if (skeleton) skeleton.remove();
        if (fallback) fallback.style.display = '';
      });
  })();

  /* ---- Email capture ---- */
  (function(){
    var form = document.getElementById('catEmailForm');
    var msg = document.getElementById('catFormMsg');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (form.querySelector('[name="website"]').value) return;
      var email = form.querySelector('[name="email"]').value.trim();
      if (!email) return;
      var submitBtn = form.querySelector('.cat-submit-btn');
      var orig = submitBtn.textContent;
      submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
      fetch('${SCRIPT_URL}', {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ email: email,
          drug: form.querySelector('[name="drug"]').value,
          source: form.querySelector('[name="source"]').value })
      })
      .then(function(){
        msg.textContent = '✓ Got it! Check your inbox.';
        form.reset();
        if (typeof gtag !== 'undefined') gtag('event','email_signup',{category:'${slug}',source:'category-page-form'});
      })
      .catch(function(){ msg.textContent = 'Something went wrong. Please try again.'; })
      .finally(function(){ submitBtn.disabled = false; submitBtn.textContent = orig; });
    });
  })();
  </script>`;
}

function transformPage(slug) {
  const filePath = resolve(ROOT, 'categories', slug, 'index.html');
  let html = readFileSync(filePath, 'utf8');

  const cat = ALL_CATS.find(c => c.slug === slug);
  if (!cat) { console.error(`Unknown slug: ${slug}`); return; }

  // 1. Remove inline <style> :root block
  html = html.replace(/<style>\s*:root\s*\{[^}]+\}\s*<\/style>/, '');

  // 2. Add body class
  html = html.replace(
    /(<body class="design-v2 theme-light")/,
    `<body class="design-v2 theme-light cat-page-${slug}"`
  );

  // 3. Replace nav Categories link with dropdown (both variations)
  html = html.replace(
    /\s*<a href="\/categories\/"(\s+aria-current="page")?>Categories<\/a>/,
    `\n${NAV_DROPDOWN}`
  );

  // 4. Replace cat-hero-meta with stats bar
  const statsBar = statsBarHtml(slug, cat.count);
  html = html.replace(
    /<div class="cat-hero-meta">[\s\S]*?<\/div>/,
    statsBar
  );

  // 5. Replace drug-chips section with drug grid + email capture
  const gridHtml = drugGridSection(slug, cat.name);
  html = html.replace(
    /<section class="drug-chips">[\s\S]*?<\/section>/,
    gridHtml
  );

  // 6. Strip inline style from CTA band action div
  html = html.replace(
    /<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px;">/g,
    '<div class="cat-cta-band-actions">'
  );

  // 7. Replace about section inline styles
  html = html.replace(
    /<section style="padding:40px 24px;max-width:900px;margin:0 auto;">/,
    '<section class="cat-about">'
  );
  html = html.replace(
    /<h2 style="font-size:22px;font-weight:700;color:#0b2a4e;margin-bottom:16px;letter-spacing:-.3px;">/g,
    '<h2>'
  );
  html = html.replace(
    /<p style="color:#64748b;font-size:16px;line-height:1.7;">/g,
    '<p>'
  );
  html = html.replace(
    /<p style="color:#64748b;font-size:16px;line-height:1.7;margin-top:12px;">/g,
    '<p>'
  );

  // 8. Convert FAQ faq-item divs to details/summary accordion
  //    Change section class
  html = html.replace(
    /<section class="cat-faq" aria-labelledby="faqTitle">/,
    '<section class="cat-faq cat-faq-accordion" aria-labelledby="faqTitle">'
  );
  //    Convert each faq-item div
  html = html.replace(
    /<div class="faq-item">\s*<p class="faq-q">([\s\S]*?)<\/p>\s*<p class="faq-a">([\s\S]*?)<\/p>\s*<\/div>/g,
    (_, q, a) => `    <details>\n      <summary>${q.trim()}</summary>\n      <p>${a.trim()}</p>\n    </details>`
  );

  // 9. Remove CTA band inline style disclosures (<p style="font-size:13px;color:#9ca3af...">)
  html = html.replace(
    /<p style="font-size:13px;color:#9ca3af;margin-top:12px;">/g,
    '<p class="cat-disclosure">'
  );

  // 10. Remove muted footer inline
  html = html.replace(
    /<p class="muted" style="color:#cbd5e1;max-width:52ch;margin-top:var\(--s-4\)">/g,
    '<p class="muted">'
  );

  // 11. Add related categories strip before <footer>
  const relatedHtml = `\n  <!-- Related categories -->\n  <section class="cat-related">\n    <h2>Explore other savings categories</h2>\n    <div class="cat-related-strip">\n${relatedStrip(slug)}\n    </div>\n  </section>\n\n  `;
  html = html.replace(/\n  <footer class="footer">/, relatedHtml + '<footer class="footer">');

  // 12. Add JS block before <script defer
  const js = jsBlock(slug);
  html = html.replace(/  <script defer src="\/assets\/scripts\.js/, js + '\n  <script defer src="/assets/scripts.js');

  return html;
}

const SLUGS_TO_PROCESS = ['diabetes', 'heart-cholesterol', 'autoimmune', 'migraine', 'respiratory', 'mental-health'];

let updated = 0;
for (const slug of SLUGS_TO_PROCESS) {
  const filePath = resolve(ROOT, 'categories', slug, 'index.html');
  console.log(`Processing: ${slug}`);
  const newHtml = transformPage(slug);
  if (!newHtml) continue;
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would update ${filePath}`);
  } else {
    writeFileSync(filePath, newHtml, 'utf8');
    console.log(`  [OK] Updated ${filePath}`);
    updated++;
  }
}
console.log(`\n✅ Done. Updated ${updated}/${SLUGS_TO_PROCESS.length} pages.`);
