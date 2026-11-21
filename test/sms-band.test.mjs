import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {START,END,CONSENT_P,addBand,removeBlock,bandHtml,targetPages,chipsFor,EXTRA_PAGES,GLP1_CHIPS,DEFAULT_CHIPS} from '../scripts/_add-sms-band.mjs';
import {bandHtml as homeBand,PENDING} from '../scripts/_add-sms-home.mjs';
const items=JSON.parse(fs.readFileSync('data/drugs.json','utf8')).items;const names=items.map(x=>({slug:x.slug,name:x.brand||x.name}));
const known=new Set(items.flatMap(x=>[x.name,x.brand].filter(Boolean).map(n=>n.toLowerCase())));
const count=(h,t)=>h.split(t).length-1;
const targets=targetPages();

test('target set: conditions, categories, learn, comparisons, directory, pharmacy, get-glp1, request-medication (67 pages); legal/about/contact/experts excluded',()=>{
  assert.equal(targets.length,67);for(const p of EXTRA_PAGES)assert(targets.includes(p),p);
  for(const p of ['about.html','contact.html','privacy.html','terms.html','experts/index.html','get-help/index.html','savings-watch/index.html','dashboard/enrollment.html','admin.html','list.html','index.html','drugs/repatha-enroll.html','drugs/repatha/index.html'])assert(!targets.includes(p),`${p} must not be a target`);
  assert(targets.filter(p=>p.startsWith('conditions/')).length===45&&targets.filter(p=>p.startsWith('categories/')).length===8&&targets.filter(p=>p.startsWith('learn/')).length===6);
});
test('every target page has exactly one hidden band, placed before the Savings Watch strip/footer, with GTM, canonical and the strip intact',()=>{
  for(const f of targets){const h=fs.readFileSync(f,'utf8');
    assert.equal(count(h,START),1,f);assert.equal(count(h,END),1,f);assert.equal(count(h,'id="sms-band"'),1,f);
    const m=h.match(/<section id="sms-band"[^>]*>/)[0];assert(m.includes(PENDING),`${f} ships hidden`);assert(m.includes('data-si-surface="content"')&&m.includes('data-sw-drug="content"'),f);
    const anchor=h.includes('<!-- saverx-savings-watch-cta -->')?h.indexOf('<!-- saverx-savings-watch-cta -->'):h.indexOf('<footer class="relief-footer">');assert(h.indexOf(START)<anchor&&anchor>0,`${f} band before strip/footer`);
    assert(h.includes('GTM-MVZBBF7R'),f);assert.equal(count(h,'<footer class="relief-footer">'),1,f);
    for(const id of ['siBandTitle','siBandDrug','siBandPhone','siBandDrugs'])assert.equal(count(h,`id="${id}"`),1,`${f} unique id ${id}`);
    assert.equal(count(h,'data-sms-interest'),1,`${f}: one waitlist block only`);}
});
test('consent disclosure is word-for-word the homepage band disclosure and carries every required element',()=>{
  const home=homeBand().match(/<p class="si-consent"[\s\S]*?<\/p>/)[0];assert.equal(CONSENT_P,home);
  for(const must of [/recurring automated text messages/,/not a condition of any purchase/,/Message frequency varies/,/Message and data rates may apply/,/Reply STOP to cancel/,/HELP for help/,/privacy\.html#sms/,/terms\.html/,/never put medication names in a text/,/first message asking you to confirm/])assert.match(CONSENT_P,must,String(must));
  for(const f of targets){const h=fs.readFileSync(f,'utf8');assert(h.includes(CONSENT_P),`${f} has the exact disclosure`);const b=h.slice(h.indexOf(START),h.indexOf(END));assert(b.indexOf('data-si-btn')<b.indexOf('class="si-consent"'),`${f}: disclosure directly under the button`);assert(b.includes('data-si-consent-version="2026-11-21-home-v1"'),f);}
});
test('chips: 3 to 5 per page, all real medications, page-specific where the page links to drugs, GLP-1 on the GLP-1 pages',()=>{
  for(const f of targets){const h=fs.readFileSync(f,'utf8');const chips=[...h.slice(h.indexOf(START),h.indexOf(END)).matchAll(/data-si-chip="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));
    assert(chips.length>=3&&chips.length<=5,`${f}: ${chips.length} chips`);assert.equal(new Set(chips).size,chips.length,f);for(const c of chips)assert(known.has(c.toLowerCase()),`${f}: "${c}" is not a known medication`);}
  const chipsOf=f=>[...fs.readFileSync(f,'utf8').matchAll(/data-si-chip="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(chipsOf('mounjaro-vs-ozempic.html').slice(0,2),['Mounjaro','Ozempic']);assert.deepEqual(chipsOf('get-glp1.html'),GLP1_CHIPS);assert.equal(chipsOf('learn/index.html').join(),DEFAULT_CHIPS.join());
  assert(chipsOf('conditions/diabetes/index.html').includes('Ozempic')&&chipsOf('conditions/diabetes/index.html').includes('Jardiance'),'condition pages use the drugs they list');
});
test('the band has the sticky bar and the shared form fields; the homepage and drug pages are unaffected',()=>{
  const b=bandHtml(DEFAULT_CHIPS);for(const must of ['data-si-bar','data-si-bar-go','data-si-bar-x','name="phone"','name="drug"','name="website"','data-si-phone-form','data-si-thanks','sms-interest.js'])assert(b.includes(must),must);
  assert(!b.includes('data-si-home-link'));
  const home=fs.readFileSync('index.html','utf8');assert.equal(count(home,'id="sms-home"'),1);assert(!home.includes('id="sms-band"'));
  for(const s of ['repatha','ozempic','keytruda']){const h=fs.readFileSync(`drugs/${s}/index.html`,'utf8');assert(!h.includes('id="sms-band"'),s);assert.equal(count(h,'id="sms-interest"'),1,s);}
  for(const f of ['about.html','contact.html','privacy.html','terms.html','experts/index.html'])assert(!fs.readFileSync(f,'utf8').includes('sms-band'),f);
});
test('injector is idempotent, removable and refuses pages without an anchor',()=>{
  const page='<main>x</main><!-- saverx-savings-watch-cta --><aside></aside><footer class="relief-footer"></footer>';
  const a=addBand(page,DEFAULT_CHIPS);assert.equal(a.changed,true);assert(a.html.indexOf(START)<a.html.indexOf('<!-- saverx-savings-watch-cta -->'));
  assert.equal(addBand(a.html,DEFAULT_CHIPS).changed,false);assert.equal(removeBlock(a.html).trim(),page.trim());
  const noStrip='<main>x</main><footer class="relief-footer"></footer>';const b=addBand(noStrip,DEFAULT_CHIPS);assert(b.html.indexOf(START)<b.html.indexOf('<footer class="relief-footer">'));
  assert.equal(addBand('<main></main>',DEFAULT_CHIPS).error,'anchor not found');assert.throws(()=>removeBlock(START+'x'));
  assert.deepEqual(chipsFor('x.html','',names),DEFAULT_CHIPS);
});
