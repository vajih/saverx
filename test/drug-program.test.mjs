import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({URL,Intl,Date});vm.runInContext(fs.readFileSync('assets/js/drug-options.js','utf8'),ctx);const api=ctx.SaveRxDrugOptions;
const profiles=JSON.parse(fs.readFileSync('data/drug-option-profiles.json','utf8'));
const SLUGS=['keytruda','phesgo','evkeeza'];
const plain=x=>JSON.parse(JSON.stringify(x));
const text=p=>JSON.stringify(p).toLowerCase();
const embedded=slug=>JSON.parse(fs.readFileSync(`drugs/${slug}/index.html`,'utf8').match(/<script type="application\/json" id="drug-page-profile">(.*?)<\/script>/s)[1].replace(/\\u003c/g,'<'));

test('each program states its verified cap beside the correct benefit period',()=>{
  const k=profiles.keytruda.program,p=profiles.phesgo.program,e=profiles.evkeeza.program;
  for(const x of [k,p,e])assert.equal(x.cap,25000);
  assert.equal(k.period,'per 12-month eligibility period');assert.equal(p.period,'per calendar year');assert.equal(e.period,'per calendar year');
  assert.equal(k.capStatus,'verified');assert.equal(p.capStatus,'verified');
  assert.equal(e.capStatus,'source-dated','Evkeeza: the cap is only confirmed in a 07/2025 brochure');assert.match(e.sourceNote,/07\/2025/);assert.match(e.sourceNote,/confirm the current maximum/i);
});
test('Keytruda: first $25 per administration; drug only; office-visit and administration charges excluded; no implied renewal',()=>{
  const k=profiles.keytruda.program;
  assert.match(k.patientPays,/first \$25/);assert.match(k.patientPays,/each administration/);
  assert.deepEqual(k.covers,['Your out-of-pocket cost for the Keytruda drug itself']);assert.deepEqual(k.notCovered,['Office visit charges','Medication administration charges']);
  assert.match(k.periodNote,/one eligibility period/i);assert.match(k.periodNote,/don’t assume the benefit renews/i);
  assert(!/renew(s|ed|al)? (automatically|each year|annually)/i.test(text(k)),'must not imply automatic renewal');
});
test('Keytruda lookback (90 days, conditional) is kept distinct from the claim-documentation deadline (180 days)',()=>{
  const f=profiles.keytruda.program.followup,[a,b]=f.paragraphs;
  assert.match(f.heading,/^Already received Keytruda\? Check whether an earlier bill qualifies\.$/);
  assert.match(a,/may apply/);assert.match(a,/up to 90 days before your eligibility period starts/);assert(!/180/.test(a),'the 90-day paragraph must not mention the 180-day deadline');
  assert.match(b,/separate from the claim deadline/);assert.match(b,/within 180 days of the date the claim was processed/);
  assert(f.ready.some(x=>/Explanation of Benefits \(EOB\)/.test(x)));assert.equal(f.readyIsGuidance,false);
});
test('Phesgo: 180-day window is conditional and not guaranteed; no unverified "subject to review" claim; claim deadline separate',()=>{
  const f=profiles.phesgo.program.followup,[a,b]=f.paragraphs;
  assert.match(f.heading,/^Already received Phesgo\? Ask about help with an earlier bill\.$/);
  assert.match(a,/may honor/);assert.match(a,/up to 180 days before you enroll/);assert.match(a,/not guaranteed/);assert(!/subject to review/i.test(text(profiles.phesgo)),'"subject to review" was not found on the official pages');
  assert.match(b,/365 days/);assert(!/180/.test(b));
  assert.equal(f.readyIsGuidance,true,'the "what to have" list is SaveRx guidance, not a program rule');assert.match(f.contactNote,/not a program rule/);
  assert.match(profiles.phesgo.program.periodNote,/January 1/);assert.match(profiles.phesgo.program.insurance,/commercial/i);
  assert.match(profiles.phesgo.program.government,/Medicare.*Medicaid.*VA.*TRICARE/);assert.equal(profiles.phesgo.program.secondaryCta.url,'https://www.copayassistancenow.com/');
});
test('Evkeeza: administration charges are covered separately from supplies and unrelated charges; no lookback claim',()=>{
  const e=profiles.evkeeza.program;
  assert(e.covers.some(x=>/administration charges/.test(x)));assert(e.covers.some(x=>/the Evkeeza drug/.test(x)));
  assert(e.notCovered.some(x=>/Supplies/.test(x)));assert(e.notCovered.some(x=>/office visits/.test(x)&&/lists only the drug and its administration/.test(x)));
  assert(e.conditions.some(x=>/Rhode Island and Massachusetts/.test(x)));assert.match(profiles.evkeeza.program.followup.heading,/^Check whether your infusion administration charges qualify\.$/);
  assert(!/lookback|days before|prior to enroll|retroactive/i.test(text(e.followup)),'no earlier-bill window was verified for Evkeeza');
  assert(!/\$0\b/.test(text(e)),'"as little as $0" was not republished by the live site');
});
test('the stale Sheet-feed "$0" can never display: curated profiles carry no per-fill price, and a program shows its verified cap instead',()=>{
  for(const s of SLUGS){const p=profiles[s];assert.equal(p.copay.price,null,s);const o=api.offer({copay_price:0,manufacturerUrl:'https://www.keytruda.com/patient-support'},p,Date.parse('2026-11-22T00:00:00Z'));assert.equal(o.price,null,`${s}: feed $0 ignored`);assert.equal(o.url,p.copay.url,`${s}: verified URL overrides the feed URL`);}
});
test('every destination is https, has a label, and the profile carries a valid verification date and sources',()=>{
  for(const s of SLUGS){const p=profiles[s],pr=p.program;
    for(const l of [pr.cta,pr.terms,pr.followup.contact,pr.secondaryCta].filter(Boolean)){assert(api.safeUrl(l.url),`${s} ${l.url}`);assert(l.label.length>5,s);}
    assert(api.safeUrl(p.copay.url)&&api.safeUrl(p.copay.terms),s);assert(Number.isFinite(Date.parse(p.checkedAt+'T00:00:00Z')),s);assert.equal(pr.verification.checkedAt,p.checkedAt);assert(pr.verification.sources.length>=2,s);assert(p.sources.length>=2,s);
    assert.equal(p.copay.url,pr.cta.url,`${s}: the row CTA / email hand-off destination equals the program CTA`);}
  assert.match(profiles.keytruda.program.cta.label,/^Check eligibility with Merck$/);assert.match(profiles.phesgo.program.cta.label,/^Visit the official Genentech copay program$/);
});
test('Takhzyro ($40,000) and Rybrevant ($26,000) stay out of this release',()=>{
  for(const s of ['takhzyro','rybrevant']){assert(!(s in profiles),`${s} has no profile`);const e=embedded(s);assert.deepEqual(Object.keys(e),['brand'],`${s} page profile is still just the brand`);}
  for(const s of SLUGS)assert(!/40,000|26,000|takhzyro|rybrevant/i.test(text(profiles[s])),s);
  for(const f of ['drugs/takhzyro/index.html','drugs/rybrevant/index.html'])assert(!fs.readFileSync(f,'utf8').includes('program-benefit'),f);
});
test('the three pages embed exactly the profile in data/drug-option-profiles.json (sync script ran); other drugs are untouched',()=>{
  const items=Object.fromEntries(JSON.parse(fs.readFileSync('data/drugs.json','utf8')).items.map(x=>[x.slug,x]));
  for(const s of SLUGS)assert.deepEqual(plain(embedded(s)),plain({brand:items[s].brand||items[s].name,...profiles[s]}),s);
  assert.deepEqual(plain(embedded('ozempic')),{brand:'Ozempic'});assert.equal(embedded('repatha').copay.price,25);
});
test('programView: builds the model from a valid program and refuses incomplete or unsafe ones',()=>{
  const now=Date.parse('2026-11-22T00:00:00Z');
  const v=api.programView(profiles.keytruda,now);assert.equal(v.capText,'$25,000');assert.equal(v.period,'per 12-month eligibility period');assert.equal(v.stale,false);assert.equal(v.capStatus,'verified');assert.equal(v.followup.heading,profiles.keytruda.program.followup.heading);
  assert.equal(api.programView(profiles.repatha,now),null,'no program: nothing rendered');assert.equal(api.programView({},now),null);
  const base=()=>plain(profiles.keytruda);
  for(const [name,mut] of [['no cap',p=>{delete p.program.cap}],['zero cap',p=>{p.program.cap=0}],['text cap',p=>{p.program.cap='lots'}],['negative cap',p=>{p.program.cap=-5}],['no period',p=>{p.program.period='  '}],['no cta',p=>{delete p.program.cta}],['http cta',p=>{p.program.cta.url='http://example.com'}],['js cta',p=>{p.program.cta.url='javascript:alert(1)'}]]){const p=base();mut(p);assert.equal(api.programView(p,now),null,name);}
});
test('programView: caution defaults (unknown status is shown as source-dated, stale or undated checks are flagged, bad links dropped)',()=>{
  const now=Date.parse('2026-11-22T00:00:00Z'),base=()=>plain(profiles.keytruda);
  let p=base();p.program.capStatus='verfied';let v=api.programView(p,now);assert.equal(v.capStatus,'source-dated','a typo must not read as verified');assert.match(v.sourceNote,/confirm the current maximum/i);
  p=base();p.checkedAt='2026-07-01';assert.equal(api.programView(p,now).stale,true,'checked more than 120 days ago');p=base();p.checkedAt='not a date';v=api.programView(p,now);assert.equal(v.stale,true);assert.equal(v.checkedAt,'');
  p=base();p.program.terms.url='http://x.test';p.program.followup.contact.url='ftp://x.test';v=api.programView(p,now);assert.equal(v.terms,null);assert.equal(v.followup.contact,null);
  p=base();p.program.covers='not a list';p.program.notCovered=[' ','x'];v=api.programView(p,now);assert.deepEqual(plain(v.covers),[]);assert.deepEqual(plain(v.notCovered),['x']);
  assert.equal(api.programView(profiles.evkeeza,now).capStatus,'source-dated');
});
test('docs describe the program schema and the sync step',()=>{
  const d=fs.readFileSync('docs/DRUG_OPTIONS_REDESIGN.md','utf8');assert.match(d,/profile\.program/);assert.match(d,/sync-drug-profiles\.py/);assert.match(d,/capStatus/);
});
