/**
 * generate-condition-pages.mjs
 *
 * Fetches all 361 drugs from the live SaveRx API, normalises indication
 * strings (merging synonyms and pipe-delimited combos), then generates
 * static HTML pages at /conditions/{slug}/index.html for every condition
 * that has ≥ 3 matching drugs.
 *
 * Usage:
 *   node scripts/generate-condition-pages.mjs [--dry-run]
 *
 * Output: conditions/{slug}/index.html  (one per condition)
 *         conditions/index.html          (hub page)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_URL = 'https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec?mode=featured';
const MIN_DRUGS = 3; // minimum drugs a condition needs for its own page
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Indication normalisation map ───────────────────────────────────────────
// Maps raw indication strings (or substrings) → canonical condition name + slug
// Order matters: more specific patterns first.
const INDICATION_NORM = [
  // Diabetes / Obesity
  { match: /\bdiabetes\b/i,           slug: 'diabetes',            name: 'Diabetes',                    icon: '💉', color: '#3b82f6', bg: '#eff6ff' },
  { match: /\bobesity\b|\bweight (loss|management)\b/i, slug: 'obesity', name: 'Obesity & Weight Loss', icon: '⚖️', color: '#10b981', bg: '#ecfdf5' },
  // Cardiology
  { match: /\bheart failure\b/i,      slug: 'heart-failure',       name: 'Heart Failure',               icon: '❤️', color: '#ef4444', bg: '#fef2f2' },
  { match: /\bafib\b|\batrial fib/i,  slug: 'atrial-fibrillation', name: 'Atrial Fibrillation',         icon: '💓', color: '#f97316', bg: '#fff7ed' },
  { match: /\bdvt|pe\b|\banticoag/i,  slug: 'blood-clots',         name: 'Blood Clots (DVT/PE)',         icon: '🩸', color: '#dc2626', bg: '#fef2f2' },
  { match: /\bhypercholesterol|cholesterol|pcsk9|lipid|triglycer/i, slug: 'high-cholesterol', name: 'High Cholesterol', icon: '🫀', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\bacs\b|\bacs\b|\bantiplatelet\b/i, slug: 'acute-coronary-syndrome', name: 'Acute Coronary Syndrome', icon: '💔', color: '#ef4444', bg: '#fef2f2' },
  { match: /\bpulmonary (arterial )?hypertension|pah\b/i, slug: 'pulmonary-hypertension', name: 'Pulmonary Arterial Hypertension', icon: '🫁', color: '#06b6d4', bg: '#ecfeff' },
  // Respiratory
  { match: /\bcopd\b/i,               slug: 'copd',                name: 'COPD',                        icon: '🫁', color: '#0ea5e9', bg: '#f0f9ff' },
  { match: /\basthma\b/i,             slug: 'asthma',              name: 'Asthma',                      icon: '💨', color: '#06b6d4', bg: '#ecfeff' },
  { match: /\bcystic fibrosis\b/i,    slug: 'cystic-fibrosis',     name: 'Cystic Fibrosis',             icon: '🧬', color: '#8b5cf6', bg: '#f5f3ff' },
  { match: /\bpulmonary fibrosis|ipf\b/i, slug: 'pulmonary-fibrosis', name: 'Idiopathic Pulmonary Fibrosis', icon: '🫁', color: '#64748b', bg: '#f8fafc' },
  // Autoimmune / Inflammatory
  { match: /\brheumatoid arthritis\b|\bra\b/i, slug: 'rheumatoid-arthritis', name: 'Rheumatoid Arthritis', icon: '🦴', color: '#8b5cf6', bg: '#f5f3ff' },
  { match: /\bpsoriatic arthritis\b|\bpsa\b/i, slug: 'psoriatic-arthritis', name: 'Psoriatic Arthritis', icon: '🦴', color: '#7c3aed', bg: '#f5f3ff' },
  { match: /\bpsoriasis\b/i,          slug: 'psoriasis',           name: 'Psoriasis',                   icon: '🛡️', color: '#7c3aed', bg: '#f5f3ff' },
  { match: /\batopic dermatitis|eczema\b/i, slug: 'atopic-dermatitis', name: 'Atopic Dermatitis / Eczema', icon: '🧴', color: '#a78bfa', bg: '#f5f3ff' },
  { match: /\bulcerative colitis\b|\buc\b/i, slug: 'ulcerative-colitis', name: 'Ulcerative Colitis',    icon: '🛡️', color: '#10b981', bg: '#ecfdf5' },
  { match: /\bcrohn/i,                slug: 'crohns-disease',      name: "Crohn's Disease",              icon: '🛡️', color: '#10b981', bg: '#ecfdf5' },
  { match: /\balopecia areata\b/i,    slug: 'alopecia-areata',     name: 'Alopecia Areata',             icon: '💆', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\blupus\b|\bsle\b/i,      slug: 'lupus',               name: 'Lupus (SLE)',                 icon: '🦋', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bosteoporosis\b/i,       slug: 'osteoporosis',        name: 'Osteoporosis',                icon: '🦷', color: '#64748b', bg: '#f8fafc' },
  { match: /\bgout\b/i,               slug: 'gout',                name: 'Gout',                        icon: '🦶', color: '#f97316', bg: '#fff7ed' },
  { match: /\bhereditary angioedema\b|\bhae\b/i, slug: 'hereditary-angioedema', name: 'Hereditary Angioedema', icon: '🧬', color: '#8b5cf6', bg: '#f5f3ff' },
  // CNS / Neurology
  { match: /\bmultiple sclerosis\b|\bms\b/i, slug: 'multiple-sclerosis', name: 'Multiple Sclerosis',     icon: '🧠', color: '#6366f1', bg: '#eef2ff' },
  { match: /\bmigraine\b/i,           slug: 'migraine',            name: 'Migraine',                    icon: '⚡', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\bparkinson/i,            slug: 'parkinsons-disease',  name: "Parkinson's Disease",          icon: '🧠', color: '#6366f1', bg: '#eef2ff' },
  { match: /\bseizure|epilepsy|anticonvulsant|lennox|dravet/i, slug: 'epilepsy-seizures', name: 'Epilepsy & Seizures', icon: '⚡', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\bals\b|\bamyotrophic/i,  slug: 'als',                 name: 'ALS (Amyotrophic Lateral Sclerosis)', icon: '🧬', color: '#64748b', bg: '#f8fafc' },
  { match: /\binsomnia\b/i,           slug: 'insomnia',            name: 'Insomnia',                    icon: '🌙', color: '#6366f1', bg: '#eef2ff' },
  // Mental Health
  { match: /\bschizophrenia\b/i,      slug: 'schizophrenia',       name: 'Schizophrenia',               icon: '🧠', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bbipolar\b/i,            slug: 'bipolar-disorder',    name: 'Bipolar Disorder',            icon: '🧠', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bmajor depressive|depression\b/i, slug: 'depression', name: 'Depression (MDD)',             icon: '🧠', color: '#8b5cf6', bg: '#f5f3ff' },
  { match: /\badhd\b|\battention deficit\b/i, slug: 'adhd',        name: 'ADHD',                        icon: '🧠', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\btreatment.resistant depression\b/i, slug: 'treatment-resistant-depression', name: 'Treatment-Resistant Depression', icon: '🧠', color: '#8b5cf6', bg: '#f5f3ff' },
  // Infectious Disease
  { match: /\bhiv\b/i,                slug: 'hiv',                 name: 'HIV',                         icon: '🧬', color: '#dc2626', bg: '#fef2f2' },
  { match: /\bhepatitis c\b/i,        slug: 'hepatitis-c',         name: 'Hepatitis C',                 icon: '🧬', color: '#f97316', bg: '#fff7ed' },
  // Oncology
  { match: /\bbreast cancer\b/i,      slug: 'breast-cancer',       name: 'Breast Cancer',               icon: '🎗️', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bprostate cancer\b/i,    slug: 'prostate-cancer',     name: 'Prostate Cancer',             icon: '🩺', color: '#3b82f6', bg: '#eff6ff' },
  { match: /\b(b-cell|blood cancer|myelofibrosis|cll|cml|leuk)/i, slug: 'blood-cancers', name: 'Blood Cancers', icon: '🩸', color: '#dc2626', bg: '#fef2f2' },
  { match: /\bnsclc\b|\blung cancer\b/i, slug: 'lung-cancer',      name: 'Lung Cancer (NSCLC)',          icon: '🫁', color: '#64748b', bg: '#f8fafc' },
  { match: /\bimmune thrombocytopenia|thrombocytopenia|aplastic anemia|sickle cell/i, slug: 'blood-disorders', name: 'Blood Disorders', icon: '🩸', color: '#ef4444', bg: '#fef2f2' },
  // Dermatology
  { match: /\bacne\b/i,               slug: 'acne',                name: 'Acne',                        icon: '🧴', color: '#f97316', bg: '#fff7ed' },
  { match: /\brosacea\b/i,            slug: 'rosacea',             name: 'Rosacea',                     icon: '🧴', color: '#f97316', bg: '#fff7ed' },
  { match: /\bvitiligo\b/i,           slug: 'vitiligo',            name: 'Vitiligo',                    icon: '🧴', color: '#a78bfa', bg: '#f5f3ff' },
  // Ophthalmology
  { match: /\bdry eye\b/i,            slug: 'dry-eye-disease',     name: 'Dry Eye Disease',             icon: '👁️', color: '#06b6d4', bg: '#ecfeff' },
  { match: /\bretinal|macular|vegf/i, slug: 'retinal-disease',     name: 'Retinal Disease',             icon: '👁️', color: '#3b82f6', bg: '#eff6ff' },
  { match: /\bglaucoma\b|\bocular hyper/i, slug: 'glaucoma',       name: 'Glaucoma',                    icon: '👁️', color: '#64748b', bg: '#f8fafc' },
  // Urology / GI
  { match: /\boveractive bladder\b|\boab\b/i, slug: 'overactive-bladder', name: 'Overactive Bladder',   icon: '🚿', color: '#06b6d4', bg: '#ecfeff' },
  { match: /\bibs\b|\birritable bowel\b|\bcic\b|\bchronic (idiopathic )?constipation\b/i, slug: 'ibs-constipation', name: 'IBS & Constipation', icon: '🫃', color: '#10b981', bg: '#ecfdf5' },
  { match: /\bgerd\b|\bacid reflux\b/i, slug: 'gerd',              name: 'GERD / Acid Reflux',          icon: '🫃', color: '#f59e0b', bg: '#fffbeb' },
  { match: /\bpancreatic insufficiency\b|\bepi\b/i, slug: 'pancreatic-insufficiency', name: 'Exocrine Pancreatic Insufficiency', icon: '🫃', color: '#64748b', bg: '#f8fafc' },
  // Reproductive / Hormonal
  { match: /\binfertility\b|\bfertility\b/i, slug: 'infertility', name: 'Infertility',                  icon: '🧬', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bendometriosis\b/i,      slug: 'endometriosis',       name: 'Endometriosis',               icon: '🩺', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\buterine fibroid\b/i,    slug: 'uterine-fibroids',    name: 'Uterine Fibroids',            icon: '🩺', color: '#ec4899', bg: '#fdf2f8' },
  { match: /\bcontraception\b|\bbirth control\b/i, slug: 'contraception', name: 'Contraception',        icon: '💊', color: '#6366f1', bg: '#eef2ff' },
  { match: /\bgrowth hormone\b/i,     slug: 'growth-hormone-deficiency', name: 'Growth Hormone Deficiency', icon: '📏', color: '#3b82f6', bg: '#eff6ff' },
  { match: /\bhyperkalemia\b/i,       slug: 'hyperkalemia',        name: 'Hyperkalemia',                icon: '⚗️', color: '#f59e0b', bg: '#fffbeb' },
  // Rare / SMA / other
  { match: /\bspinal muscular atrophy\b|\bsma\b/i, slug: 'spinal-muscular-atrophy', name: 'Spinal Muscular Atrophy', icon: '🧬', color: '#8b5cf6', bg: '#f5f3ff' },
  { match: /\bopioid use disorder\b|\bpartial opioid\b/i, slug: 'opioid-use-disorder', name: 'Opioid Use Disorder', icon: '💊', color: '#ef4444', bg: '#fef2f2' },
  { match: /\bnarcolepsy\b|\bidiopathic hypersomnia\b/i, slug: 'narcolepsy', name: 'Narcolepsy / Hypersomnia', icon: '😴', color: '#6366f1', bg: '#eef2ff' },
  { match: /\balzheimer/i,            slug: 'alzheimers-disease',  name: "Alzheimer's Disease",          icon: '🧠', color: '#6366f1', bg: '#eef2ff' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

function drugSlugFromItem(item) {
  const name = item.name || '';
  return slugify(name);
}

/** Return the canonical condition(s) an indication string maps to */
function normaliseIndication(raw) {
  if (!raw || raw.trim() === '') return [];
  const matched = new Set();
  for (const rule of INDICATION_NORM) {
    if (rule.match.test(raw)) {
      matched.add(rule.slug);
    }
  }
  return [...matched];
}

function getMeta(slug) {
  return INDICATION_NORM.find(r => r.slug === slug);
}

// ─── Page generation ─────────────────────────────────────────────────────────

function renderDrugCard(item) {
  const brand = esc(item.name || '');
  const generic = esc(item.generic || '');
  const drugSlug = drugSlugFromItem(item);
  const cash = item.cash_price != null ? `$${Number(item.cash_price).toLocaleString()}` : '';
  const asLow = item.as_low_as != null ? `As low as $${Number(item.as_low_as).toLocaleString()}` : '';
  return `<a class="cond-drug-card" href="/drugs/${drugSlug}/" aria-label="${brand} savings">
  <h3>${brand}</h3>
  ${generic ? `<p class="cond-drug-generic">${generic}</p>` : ''}
  ${cash || asLow ? `<p class="cond-drug-price">${cash ? `<span class="cond-cash">${cash}</span>` : ''}${cash && asLow ? ' &middot; ' : ''}${asLow ? `<strong class="cond-low">${asLow}</strong>` : ''}</p>` : ''}
  <span class="cond-card-cta">View savings &rarr;</span>
</a>`;
}

function renderPage(meta, drugs) {
  const drugCount = drugs.length;
  const cheapest = drugs.reduce((min, d) => {
    const p = d.as_low_as;
    return (p != null && (min == null || p < min)) ? p : min;
  }, null);
  const mostExpensive = drugs.reduce((max, d) => {
    const p = d.cash_price;
    return (p != null && (max == null || p > max)) ? p : max;
  }, null);

  const chipList = drugs.map(d => {
    const s = drugSlugFromItem(d);
    return `<a href="/drugs/${s}/" class="chip">💊 ${esc(d.name)}</a>`;
  }).join('\n      ');

  const cardList = drugs.map(d => renderDrugCard(d)).join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(meta.name)} Medication Savings — Copay Cards & Patient Assistance | SaveRx.ai</title>
  <meta name="description" content="Find official manufacturer savings programs, copay cards, and patient assistance for ${esc(meta.name)} medications. ${drugCount} medications with verified savings links.">
  <link rel="canonical" href="https://saverx.ai/conditions/${meta.slug}/">
  <meta property="og:title" content="${esc(meta.name)} Medication Savings | SaveRx.ai">
  <meta property="og:description" content="Official manufacturer savings programs for ${esc(meta.name)} medications. Compare copay cards and patient assistance options.">
  <meta property="og:url" content="https://saverx.ai/conditions/${meta.slug}/">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#0b6e5c">

  <!-- Google Consent Mode v2 -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
      personalization_storage: 'denied', wait_for_update: 500
    });
  <\/script>
  <script src="/assets/js/consent.js"><\/script>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MVZBBF7R');<\/script>
  <!-- GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-FCKENS1BWB"><\/script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FCKENS1BWB');<\/script>
  <!-- AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2243579953209623" crossorigin="anonymous"><\/script>

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/components.css">

  <style>
    /* Condition page styles */
    .cond-hero { background: linear-gradient(180deg, var(--brand-50, #e1f5ee) 0%, var(--bg, #f1efe8) 100%); border-bottom: 1px solid var(--border); padding: 48px 0 40px; text-align: center; }
    .cond-hero-inner { max-width: 720px; margin: 0 auto; padding: 0 16px; }
    .cond-icon { font-size: 3rem; display: block; margin-bottom: 12px; }
    .cond-hero h1 { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 700; color: var(--text); margin: 0 0 12px; }
    .cond-hero p { font-size: 1.05rem; color: var(--text-2); max-width: 56ch; margin: 0 auto 24px; }
    .cond-stats { display: flex; justify-content: center; gap: 32px; flex-wrap: wrap; }
    .cond-stat { text-align: center; }
    .cond-stat-label { display: block; font-size: 0.78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-3, #94a3b8); font-weight: 600; }
    .cond-stat-value { display: block; font-size: 1.4rem; font-weight: 700; color: var(--teal, #0b6e5c); }

    .cond-section { max-width: 960px; margin: 0 auto; padding: 40px 16px; }
    .cond-section h2 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0 0 20px; }

    /* Drug cards grid */
    .cond-drug-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-bottom: 12px; }
    .cond-drug-card { display: flex; flex-direction: column; gap: 6px; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px 14px; text-decoration: none; transition: border-color .12s, box-shadow .12s; }
    .cond-drug-card:hover { border-color: var(--teal, #0b6e5c); box-shadow: 0 4px 16px rgba(11,110,92,.10); }
    .cond-drug-card h3 { font-size: 1rem; font-weight: 700; color: var(--text); margin: 0; }
    .cond-drug-generic { font-size: 0.8rem; color: var(--text-3, #94a3b8); margin: 0; }
    .cond-drug-price { font-size: 0.85rem; margin: 4px 0 0; }
    .cond-cash { color: var(--text-3, #94a3b8); text-decoration: line-through; }
    .cond-low { color: var(--teal, #0b6e5c); }
    .cond-card-cta { margin-top: auto; padding-top: 8px; font-size: 0.82rem; font-weight: 600; color: var(--teal, #0b6e5c); }

    /* Email capture */
    .cond-email-band { background: var(--brand-50, #e1f5ee); border-top: 1px solid rgba(11,110,92,.15); border-bottom: 1px solid rgba(11,110,92,.15); padding: 40px 0; text-align: center; }
    .cond-email-inner { max-width: 540px; margin: 0 auto; padding: 0 16px; }
    .cond-email-band h2 { font-size: 1.2rem; font-weight: 700; color: var(--text); margin: 0 0 8px; }
    .cond-email-band p { font-size: 0.92rem; color: var(--text-2); margin: 0 0 20px; }
    .cond-email-form { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .cond-email-form input[type="email"] { flex: 1; min-width: 220px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; outline: none; }
    .cond-email-form input[type="email"]:focus { border-color: var(--teal, #0b6e5c); box-shadow: 0 0 0 3px rgba(11,110,92,.12); }
    .cond-email-form button { padding: 10px 22px; background: var(--teal, #0b6e5c); color: #fff; border: 0; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
    .cond-form-msg { width: 100%; font-size: 0.88rem; color: var(--teal, #0b6e5c); margin: 4px 0 0; text-align: center; }
    .cond-microcopy { font-size: 0.78rem; color: var(--text-3, #94a3b8); margin: 8px 0 0; }

    /* About section */
    .cond-about { background: #fff; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .cond-about-inner { max-width: 720px; margin: 0 auto; padding: 36px 16px; }
    .cond-about-inner h2 { font-size: 1.15rem; font-weight: 700; color: var(--text); margin: 0 0 14px; }
    .cond-about-inner p { font-size: 0.95rem; line-height: 1.72; color: var(--text-2); margin: 0 0 12px; }
    .cond-about-inner p:last-child { margin: 0; }

    /* FAQ */
    .cond-faq { max-width: 720px; margin: 0 auto; padding: 36px 16px 48px; }
    .cond-faq h2 { font-size: 1.15rem; font-weight: 700; color: var(--text); margin: 0 0 16px; }
    .cond-faq details { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; }
    .cond-faq summary { padding: 14px 16px; font-weight: 600; font-size: 0.95rem; color: var(--text); cursor: pointer; list-style: none; }
    .cond-faq summary::-webkit-details-marker { display: none; }
    .cond-faq summary::after { content: '▾'; float: right; color: var(--text-3, #94a3b8); transition: transform .2s; }
    .cond-faq details[open] summary::after { transform: rotate(-180deg); }
    .cond-faq details p { padding: 0 16px 14px; font-size: 0.92rem; color: var(--text-2); line-height: 1.65; margin: 0; }

    /* Breadcrumb */
    .cond-breadcrumb { max-width: 960px; margin: 0 auto; padding: 12px 16px; font-size: 0.85rem; color: var(--text-3, #94a3b8); }
    .cond-breadcrumb a { color: var(--text-2); text-decoration: none; }
    .cond-breadcrumb a:hover { text-decoration: underline; }
    .cond-breadcrumb-sep { margin: 0 6px; }

    @media (max-width: 640px) {
      .cond-drug-grid { grid-template-columns: 1fr 1fr; }
      .cond-stats { gap: 20px; }
    }
    @media (max-width: 400px) {
      .cond-drug-grid { grid-template-columns: 1fr; }
    }
  </style>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${esc(meta.name)} Medication Savings",
    "description": "Find official manufacturer savings programs and copay cards for ${esc(meta.name)} medications.",
    "url": "https://saverx.ai/conditions/${meta.slug}/",
    "publisher": {
      "@type": "Organization",
      "name": "SaveRx.ai",
      "url": "https://saverx.ai",
      "logo": { "@type": "ImageObject", "url": "https://saverx.ai/assets/img/logo-512.png" }
    }
  }
  <\/script>
</head>
<body class="design-v2 theme-light">
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MVZBBF7R" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

  <header class="header">
    <div class="container inner">
      <a href="/" class="nav-logo" aria-label="SaveRx.ai home">Save<span>Rx.ai</span></a>
      <nav id="primary-nav" class="nav" aria-label="Main navigation">
        <a href="/drugs/" class="nav-link">Drugs</a>
        <div class="nav-dropdown" id="catDropdown">
          <button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="catDropdownMenu">
            Categories <span class="caret" aria-hidden="true">▾</span>
          </button>
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
        </div>
        <a href="/comparisons.html" class="nav-link">Comparisons</a>
        <a href="/about.html" class="nav-link">About</a>
        <a href="/contact.html" class="nav-link">Contact</a>
      </nav>
      <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </button>
    </div>
  </header>

  <nav class="cond-breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="cond-breadcrumb-sep">›</span>
    <a href="/conditions/">Conditions</a>
    <span class="cond-breadcrumb-sep">›</span>
    <span>${esc(meta.name)}</span>
  </nav>

  <section class="cond-hero">
    <div class="cond-hero-inner">
      <span class="cond-icon" aria-hidden="true">${meta.icon}</span>
      <h1>${esc(meta.name)} Medications — Savings &amp; Copay Assistance</h1>
      <p>Find official manufacturer savings programs, copay cards, and patient assistance for ${esc(meta.name)} medications. Compare your options and pay less at the pharmacy.</p>
      <div class="cond-stats">
        <div class="cond-stat">
          <span class="cond-stat-label">Medications tracked</span>
          <span class="cond-stat-value">${drugCount}</span>
        </div>
        ${cheapest != null ? `<div class="cond-stat">
          <span class="cond-stat-label">Savings card as low as</span>
          <span class="cond-stat-value">$${Number(cheapest).toLocaleString()}</span>
        </div>` : ''}
        ${mostExpensive != null ? `<div class="cond-stat">
          <span class="cond-stat-label">Typical cash price up to</span>
          <span class="cond-stat-value">$${Number(mostExpensive).toLocaleString()}</span>
        </div>` : ''}
      </div>
    </div>
  </section>

  <div class="cond-section">
    <h2>All ${esc(meta.name)} Medications with Savings Programs</h2>
    <div class="cond-drug-grid">
  ${cardList}
    </div>
    <p style="font-size:0.8rem;color:var(--text-3,#94a3b8);margin-top:8px;">
      Prices shown are estimates. Eligibility and savings vary by insurance status and manufacturer program terms.
    </p>
  </div>

  <section class="cond-email-band">
    <div class="cond-email-inner">
      <h2>Get savings alerts for ${esc(meta.name)}</h2>
      <p>We'll notify you when new manufacturer programs or copay card offers become available for ${esc(meta.name)} medications.</p>
      <form class="cond-email-form" id="condEmailForm" novalidate>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none">
        <input type="email" name="email" required placeholder="your@email.com" inputmode="email" autocomplete="email" aria-label="Email address">
        <input type="hidden" name="drug" value="${esc(meta.name)}">
        <input type="hidden" name="source" value="Condition Page - ${meta.slug}">
        <button type="submit">Get Alerts</button>
        <p class="cond-form-msg" id="condFormMsg" role="status" aria-live="polite"></p>
      </form>
      <p class="cond-microcopy">No spam. Unsubscribe anytime.</p>
    </div>
  </section>

  <section class="cond-about">
    <div class="cond-about-inner">
      <h2>About ${esc(meta.name)} Savings Programs</h2>
      <p>
        Manufacturer copay assistance programs allow commercially insured patients to pay significantly less for brand-name ${esc(meta.name)} medications. These programs are funded directly by the drug manufacturer and are typically free to enroll in — no middlemen, no subscription fees.
      </p>
      <p>
        <strong>For commercially insured patients:</strong> Most programs require that you have private insurance (employer plan or marketplace plan) and are not enrolled in Medicare, Medicaid, CHIP, or other government health programs. Eligible patients often pay as little as $0–$25 per fill.
      </p>
      <p>
        <strong>Without insurance:</strong> Many manufacturers also offer separate Patient Assistance Programs (PAPs) for uninsured or underinsured patients who meet income eligibility requirements. These programs can provide medication at low or no cost directly from the manufacturer.
      </p>
      <p>
        SaveRx.ai links you directly to the official manufacturer enrollment pages. We are not affiliated with any manufacturer — we're an independent educational resource.
      </p>
    </div>
  </section>

  <section class="cond-faq">
    <h2>Frequently Asked Questions</h2>
    <details>
      <summary>How do manufacturer copay cards work for ${esc(meta.name)} medications?</summary>
      <p>Manufacturer copay cards are savings programs funded by the drug company. When you fill your prescription, you present the card (physical or digital) and the manufacturer pays the difference between what your insurance covers and your final copay — often bringing your cost down to $0–$25 per fill. Enrollment is free and typically done online in a few minutes.</p>
    </details>
    <details>
      <summary>Can I use a copay card if I have Medicare or Medicaid?</summary>
      <p>No. Manufacturer copay cards cannot legally be used with Medicare, Medicaid, CHIP, TRICARE, or other government insurance programs — federal anti-kickback rules prohibit it. If you have government insurance, look into Patient Assistance Programs (PAPs), which provide medication directly at low or no cost based on income.</p>
    </details>
    <details>
      <summary>How long do savings programs last?</summary>
      <p>Coverage periods vary by manufacturer. Some programs cover the first 12–24 months of therapy, and some require annual re-enrollment. A few programs have no set end date. Always check the specific program terms on the manufacturer's official site — we link directly to those pages from each medication listing.</p>
    </details>
    <details>
      <summary>What if I don't have insurance?</summary>
      <p>Without insurance, copay cards typically don't apply. However, most major manufacturers offer separate Patient Assistance Programs (PAPs) based on income. These programs can provide ${esc(meta.name)} medications at very low or zero cost. Click any medication above to see uninsured options for that specific drug.</p>
    </details>
  </section>

  <div class="not-insurance-band">
    <div class="container">
      <p>SaveRx is not insurance. We help commercially insured patients find official manufacturer savings programs for brand-name medications. Eligibility and savings vary by program.</p>
    </div>
  </div>

  <footer class="footer">
    <div class="container grid">
      <div>
        <a href="/" class="nav-logo footer-logo" aria-label="SaveRx.ai home">Save<span>Rx.ai</span></a>
        <p class="footer-tagline">Official manufacturer savings for 350+ brand-name medications.<br>We are not a pharmacy.</p>
      </div>
      <div>
        <h4 class="footer-col-heading">Quick Links</h4>
        <div><a href="/">Home</a></div>
        <div><a href="/drugs/">Drugs</a></div>
        <div><a href="/conditions/">All Conditions</a></div>
        <div><a href="/comparisons.html">Comparisons</a></div>
        <div><a href="/about.html">About</a></div>
        <div><a href="/contact.html">Contact</a></div>
      </div>
      <div>
        <h4 class="footer-col-heading">Categories</h4>
        <div><a href="/categories/weight-loss/">Weight Loss &amp; GLP-1</a></div>
        <div><a href="/categories/diabetes/">Diabetes</a></div>
        <div><a href="/categories/heart-cholesterol/">Heart &amp; Cholesterol</a></div>
        <div><a href="/categories/autoimmune/">Autoimmune</a></div>
        <div><a href="/categories/migraine/">Migraine</a></div>
        <div><a href="/categories/respiratory/">Respiratory</a></div>
        <div><a href="/categories/mental-health/">Mental Health</a></div>
      </div>
      <div>
        <h4 class="footer-col-heading">Legal</h4>
        <div><a href="/privacy.html">Privacy Policy</a></div>
        <div><a href="/terms.html">Terms of Service</a></div>
        <div><a href="#" data-consent-toggle>Cookie settings</a></div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;width:100%;">
        <span>© 2026 SaveRx.ai — All rights reserved.</span>
        <span>SaveRx is not insurance. All trademarks are property of their respective owners. Savings vary by program.</span>
      </div>
    </div>
  </footer>

  <script defer src="/assets/scripts.js?v=2025-10-03"><\/script>
  <script>
  /* Nav dropdown */
  (function(){
    var dd=document.getElementById('catDropdown');
    if(!dd)return;
    var btn=dd.querySelector('.nav-dropdown-toggle');
    var menu=dd.querySelector('.nav-dropdown-menu');
    function open(){dd.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}
    function close(){dd.removeAttribute('data-open');btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){e.stopPropagation();dd.hasAttribute('data-open')?close():open();});
    document.addEventListener('click',close);
    menu.addEventListener('click',function(e){e.stopPropagation();});
  })();

  /* Email form */
  (function(){
    var form=document.getElementById('condEmailForm');
    var msg=document.getElementById('condFormMsg');
    if(!form)return;
    var API='https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec';
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(form.querySelector('[name="website"]').value)return;
      var email=form.querySelector('[name="email"]').value.trim();
      if(!email)return;
      var btn=form.querySelector('button');
      btn.disabled=true;btn.textContent='Sending\u2026';
      fetch(API,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({email:email,drug:form.querySelector('[name="drug"]').value,source:form.querySelector('[name="source"]').value})
      }).then(function(){
        if(msg){msg.textContent='\u2713 Got it! We\u2019ll be in touch.';} form.reset();
      }).catch(function(){
        if(msg){msg.textContent='Something went wrong. Please try again.';}
      }).finally(function(){
        btn.disabled=false;btn.textContent='Get Alerts';
      });
    });
  })();

  /* GA4 */
  if(typeof gtag!=='undefined')gtag('event','view_condition',{condition:'${meta.slug}'});
  <\/script>
</body>
</html>`;
}

// ─── Hub / index page ─────────────────────────────────────────────────────────

function renderHub(conditions) {
  const cards = conditions.map(({ meta, drugs }) => {
    return `<a class="cond-hub-card" href="/conditions/${meta.slug}/" style="--card-accent:${meta.color};--card-accent-bg:${meta.bg}">
  <span class="cond-hub-icon">${meta.icon}</span>
  <span class="cond-hub-name">${esc(meta.name)}</span>
  <span class="cond-hub-count">${drugs.length} medication${drugs.length !== 1 ? 's' : ''}</span>
</a>`;
  }).join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browse Medications by Condition | SaveRx.ai</title>
  <meta name="description" content="Find manufacturer savings programs and copay cards for ${conditions.length} medical conditions. Browse by diagnosis to find savings for your specific medication.">
  <link rel="canonical" href="https://saverx.ai/conditions/">
  <meta name="theme-color" content="#0b6e5c">

  <!-- Google Consent Mode v2 -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
      personalization_storage: 'denied', wait_for_update: 500
    });
  <\/script>
  <script src="/assets/js/consent.js"><\/script>
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MVZBBF7R');<\/script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-FCKENS1BWB"><\/script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FCKENS1BWB');<\/script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2243579953209623" crossorigin="anonymous"><\/script>

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/components.css">

  <style>
    .cond-hub-hero { background: linear-gradient(180deg, var(--brand-50,#e1f5ee) 0%, var(--bg,#f1efe8) 100%); border-bottom: 1px solid var(--border); padding: 48px 0 36px; text-align: center; }
    .cond-hub-hero h1 { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 700; color: var(--text); margin: 0 0 10px; }
    .cond-hub-hero p { font-size: 1.05rem; color: var(--text-2); max-width: 56ch; margin: 0 auto; }
    .cond-hub-inner { max-width: 1000px; margin: 0 auto; padding: 40px 16px; }
    .cond-hub-inner h2 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0 0 20px; }
    .cond-hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .cond-hub-card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px 14px; text-decoration: none; transition: border-color .12s, box-shadow .12s; }
    .cond-hub-card:hover { border-color: var(--card-accent, var(--teal,#0b6e5c)); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .cond-hub-icon { font-size: 1.6rem; display: block; }
    .cond-hub-name { font-size: 0.92rem; font-weight: 700; color: var(--text); }
    .cond-hub-count { font-size: 0.78rem; color: var(--text-3, #94a3b8); }
    .cond-breadcrumb { max-width: 1000px; margin: 0 auto; padding: 12px 16px; font-size: 0.85rem; color: var(--text-3,#94a3b8); }
    .cond-breadcrumb a { color: var(--text-2); text-decoration: none; }
    .cond-breadcrumb-sep { margin: 0 6px; }
    @media (max-width: 640px) {
      .cond-hub-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body class="design-v2 theme-light">
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MVZBBF7R" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

  <header class="header">
    <div class="container inner">
      <a href="/" class="nav-logo" aria-label="SaveRx.ai home">Save<span>Rx.ai</span></a>
      <nav id="primary-nav" class="nav" aria-label="Main navigation">
        <a href="/drugs/" class="nav-link">Drugs</a>
        <div class="nav-dropdown" id="catDropdown">
          <button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="catDropdownMenu">
            Categories <span class="caret" aria-hidden="true">▾</span>
          </button>
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
        </div>
        <a href="/comparisons.html" class="nav-link">Comparisons</a>
        <a href="/about.html" class="nav-link">About</a>
        <a href="/contact.html" class="nav-link">Contact</a>
      </nav>
      <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </button>
    </div>
  </header>

  <nav class="cond-breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="cond-breadcrumb-sep">›</span>
    <span>Browse by Condition</span>
  </nav>

  <section class="cond-hub-hero">
    <h1>Browse Medications by Condition</h1>
    <p>Find official manufacturer savings programs for your specific diagnosis. Select your condition to see all available medications with copay assistance.</p>
  </section>

  <div class="cond-hub-inner">
    <h2>All Conditions (${conditions.length})</h2>
    <div class="cond-hub-grid">
  ${cards}
    </div>
  </div>

  <div class="not-insurance-band">
    <div class="container">
      <p>SaveRx is not insurance. We help commercially insured patients find official manufacturer savings programs for brand-name medications. Eligibility and savings vary by program.</p>
    </div>
  </div>

  <footer class="footer">
    <div class="container grid">
      <div>
        <a href="/" class="nav-logo footer-logo" aria-label="SaveRx.ai home">Save<span>Rx.ai</span></a>
        <p class="footer-tagline">Official manufacturer savings for 350+ brand-name medications.<br>We are not a pharmacy.</p>
      </div>
      <div>
        <h4 class="footer-col-heading">Quick Links</h4>
        <div><a href="/">Home</a></div>
        <div><a href="/drugs/">Drugs</a></div>
        <div><a href="/conditions/">All Conditions</a></div>
        <div><a href="/about.html">About</a></div>
        <div><a href="/contact.html">Contact</a></div>
      </div>
      <div>
        <h4 class="footer-col-heading">Legal</h4>
        <div><a href="/privacy.html">Privacy Policy</a></div>
        <div><a href="/terms.html">Terms of Service</a></div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;width:100%;">
        <span>© 2026 SaveRx.ai — All rights reserved.</span>
      </div>
    </div>
  </footer>

  <script defer src="/assets/scripts.js?v=2025-10-03"><\/script>
  <script>
  (function(){
    var dd=document.getElementById('catDropdown');if(!dd)return;
    var btn=dd.querySelector('.nav-dropdown-toggle');var menu=dd.querySelector('.nav-dropdown-menu');
    function open(){dd.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}
    function close(){dd.removeAttribute('data-open');btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){e.stopPropagation();dd.hasAttribute('data-open')?close():open();});
    document.addEventListener('click',close);menu.addEventListener('click',function(e){e.stopPropagation();});
  })();
  <\/script>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching drug data from API…');
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const items = data.items || [];
  console.log(`Fetched ${items.length} drugs.`);

  // Group drugs by canonical condition slug
  const conditionMap = new Map(); // slug → Set of items (using drug name as key to deduplicate)

  for (const item of items) {
    const raw = item.indication || '';
    const slugs = normaliseIndication(raw);
    for (const slug of slugs) {
      if (!conditionMap.has(slug)) conditionMap.set(slug, new Map());
      const drugName = (item.name || '').trim().toLowerCase();
      if (drugName) conditionMap.get(slug).set(drugName, item);
    }
  }

  // Build sorted list of conditions with enough drugs
  const conditions = [];
  for (const [slug, drugMap] of conditionMap) {
    const drugs = [...drugMap.values()].sort((a, b) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      return pa - pb;
    });
    if (drugs.length < MIN_DRUGS) {
      console.log(`  skip ${slug}: only ${drugs.length} drugs (< ${MIN_DRUGS})`);
      continue;
    }
    const meta = getMeta(slug);
    if (!meta) {
      console.log(`  skip ${slug}: no meta found`);
      continue;
    }
    conditions.push({ meta, drugs });
  }

  // Sort hub by drug count descending
  conditions.sort((a, b) => b.drugs.length - a.drugs.length);

  console.log(`\nGenerating pages for ${conditions.length} conditions:\n`);
  conditions.forEach(({ meta, drugs }) => {
    console.log(`  ${meta.slug.padEnd(35)} ${drugs.length} drugs`);
  });

  if (DRY_RUN) {
    console.log('\n--dry-run: no files written.');
    return;
  }

  // Write condition pages
  const condDir = path.join(ROOT, 'conditions');
  if (!fs.existsSync(condDir)) fs.mkdirSync(condDir);

  for (const { meta, drugs } of conditions) {
    const dir = path.join(condDir, meta.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const html = renderPage(meta, drugs);
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    console.log(`  ✓ conditions/${meta.slug}/index.html`);
  }

  // Write hub page
  const hubHtml = renderHub(conditions);
  fs.writeFileSync(path.join(condDir, 'index.html'), hubHtml, 'utf8');
  console.log(`  ✓ conditions/index.html`);

  console.log(`\nDone. ${conditions.length} condition pages + 1 hub page written.`);
}

main().catch(err => { console.error(err); process.exit(1); });
