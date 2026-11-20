import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync('assets/js/consent.js','utf8');
// Behavior is verified in a real browser (see the PR); these guard the structure that regulators and the consent logic rely on.
test('main screen: Accept and Reject are identical buttons (same class, same size rules); Preferences is a secondary link',()=>{
  const m=src.slice(src.indexOf('function renderMain()'),src.indexOf('// ─── Preferences screen'));
  const cls=[...m.matchAll(/(\w+)\.className = '([^']*)'/g)].reduce((o,x)=>(o[x[1]]=x[2],o),{});
  assert.equal(cls.acceptBtn,cls.rejectBtn,'accept and reject must share one class');assert.match(cls.acceptBtn,/srxcb__btn--primary/);
  assert.match(m,/acceptBtn\.textContent = 'Accept all'/);assert.match(m,/rejectBtn\.textContent = 'Reject all'/);assert.match(cls.prefsBtn,/prefslink/);
  assert(!/srxcb__reject'/.test(m),'the small grey reject link is gone');
  assert.match(m,/rejectBtn\.addEventListener\('click', function \(\) \{ rejectAll\(false\); \}\)/);assert.match(m,/acceptBtn\.addEventListener\('click', acceptAll\)/);
});
test('presentation modes: main screen is a non-modal bar; preferences is the modal (scroll lock + focus trap only there)',()=>{
  assert.match(src,/var mode = 'bar'/);assert.match(src,/function renderMain\(\) \{\s*mode = 'bar'; applyMode\(\);/);assert.match(src,/function renderPrefs\(\) \{[\s\S]{0,80}mode = 'modal'; applyMode\(\);/);
  const a=src.slice(src.indexOf('function applyMode()'),src.indexOf('function hideModal()'));
  assert.match(a,/document\.body\.style\.overflow = \(isModal && visible\) \? 'hidden' : ''/);assert.match(a,/if \(isModal && visible\) document\.addEventListener\('keydown', trapFocus\)/);assert.match(a,/removeAttribute\('aria-modal'\)/);
  assert.match(src,/\.srxcb-bd--bar\{[^}]*background:transparent[^}]*pointer-events:none/);assert.match(src,/\.srxcb-bd--bar \.srxcb\{pointer-events:auto/);
  assert.match(src,/if \(mode === 'modal'\) setTimeout\(function \(\) \{\s*var els = getFocusable\(\)/,'focus is only moved for the modal');
});
test('consent logic is untouched: Consent Mode v2 update, stored shape, GPC honored, 365-day TTL, re-open link',()=>{
  for(const must of ["analytics_storage: prefs.analytics ? 'granted' : 'denied'","ad_storage: prefs.advertising ? 'granted' : 'denied'","ad_user_data: prefs.advertising ? 'granted' : 'denied'","ad_personalization: prefs.advertising ? 'granted' : 'denied'","personalization_storage: prefs.personalization ? 'granted' : 'denied'",
    "var STORAGE_KEY = 'saverx_consent'","var CONSENT_TTL = 365 * 24 * 60 * 60 * 1000","navigator.globalPrivacyControl === true","[data-consent-toggle]","gtag('event', 'consent_accept_all')","gtag('event', 'consent_reject_all')","rejectAll(true)"])assert(src.includes(must),must);
  assert.match(src,/function acceptAll\(\) \{\s*var prefs = \{ analytics: true, advertising: true, personalization: true \}/);assert.match(src,/function rejectAll\(silent\) \{\s*var prefs = \{ analytics: false, advertising: false, personalization: false \}/);
});
