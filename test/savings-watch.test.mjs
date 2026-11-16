import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {addDrugCard,addStrip,removeBlock,upsert,START,END,PENDING,drugCardHtml,stripHtml,stripPages,drugSlugs} from '../scripts/_add-savings-watch-cta.mjs';
const page=fs.readFileSync('savings-watch/index.html','utf8');
const source=fs.readFileSync('assets/js/savings-watch.js','utf8');
const ctaSource=fs.readFileSync('assets/js/savings-watch-cta.js','utf8');
const sw=JSON.parse(fs.readFileSync('data/savings-watch.json','utf8'));
const count=(h,t)=>h.split(t).length-1;

test('drug card: injected hidden above enroll-help, links to the right drug, idempotent, upgradeable',()=>{
  const html='<main><section id="enroll-help" class="x"></section></main>';
  const a=addDrugCard(html,'repatha');assert.equal(a.changed,true);
  assert.match(a.html,/href="\/savings-watch\/\?drug=repatha"/);assert.match(a.html,/Find savings for me — Free/);
  assert(a.html.includes(PENDING),'ships hidden');assert(a.html.indexOf(START)<a.html.indexOf('id="enroll-help"'),'placed before enroll-help');
  const b=addDrugCard(a.html,'repatha');assert.equal(b.changed,false);assert.equal(count(b.html,START),1);assert.equal(count(b.html,END),1);
  assert.equal(addDrugCard('<main></main>','x').error,'anchor not found');
  const legacy='<main><!-- saverx-savings-watch-cta -->\n <section id="savings-watch" class="old">old</section>\n <section id="enroll-help"></section></main>';
  const up=addDrugCard(legacy,'repatha');assert(!up.html.includes('class="old"'),'legacy block replaced');assert.equal(count(up.html,START),1);
});
test('strip: injected hidden before the shared footer, idempotent, generic link',()=>{
  const html='<main></main><footer class="relief-footer">x</footer>';
  const a=addStrip(html);assert.equal(a.changed,true);assert(a.html.includes(PENDING));assert(a.html.indexOf(START)<a.html.indexOf('<footer'));assert.match(a.html,/href="\/savings-watch\/"/);
  assert.equal(addStrip(a.html).changed,false);assert.equal(removeBlock(a.html),html);
});
test('rollout switch file: valid, OFF by default, and its open list equals the Worker PILOT_SLUGS',()=>{
  assert.equal(sw.live,false,'must stay false until the Worker is deployed and A2P is approved');
  assert(Array.isArray(sw.open)&&sw.open.length>0);
  const wr=fs.readFileSync('saverx-savings-watch/wrangler.jsonc','utf8').match(/"PILOT_SLUGS":\s*"([^"]*)"/)[1].split(',').map(x=>x.trim()).sort();
  assert.deepEqual([...sw.open].sort(),wr,'data/savings-watch.json open[] must match PILOT_SLUGS in wrangler.jsonc');
});
test('every drug page has exactly one hidden card for its own slug, in front of enroll-help, with GTM intact',()=>{
  const slugs=drugSlugs();assert(slugs.length>=363);let checked=0;
  for(const slug of slugs){
    const h=fs.readFileSync(`drugs/${slug}/index.html`,'utf8');
    if(!h.includes('id="enroll-help"'))continue;checked++;
    assert.equal(count(h,START),1,slug);assert.equal(count(h,END),1,slug);
    assert(h.includes(`data-sw-drug="${slug}"`),slug);assert(h.includes(`href="/savings-watch/?drug=${slug}"`),slug);
    assert(h.includes(PENDING),`${slug} must ship hidden`);
    assert(h.indexOf(START)<h.indexOf('id="enroll-help"'),slug);
    assert(h.includes('GTM-MVZBBF7R'),`${slug} lost GTM`);assert.equal(count(h,'<footer class="relief-footer">'),1,slug);
  }
  assert(checked>=363,`checked ${checked}`);
});
test('strip pages: hidden strip before the footer; excluded pages have none',()=>{
  const pages=stripPages();assert(pages.length>=60);
  for(const p of pages){const h=fs.readFileSync(p,'utf8');assert.equal(count(h,START),1,p);assert(h.includes(PENDING),p);assert(h.indexOf(START)<h.indexOf('<footer class="relief-footer">'),p);assert(h.includes('GTM-MVZBBF7R'),p);}
  for(const p of ['about.html','contact.html','privacy.html','terms.html','get-help/index.html','experts/index.html','savings-watch/index.html','request-medication.html'])assert.equal(count(fs.readFileSync(p,'utf8'),START),0,`${p} must not get a strip`);
});
test('nothing on the site is visible while the switch is off: every injected block is hidden',()=>{
  const all=[...drugSlugs().map(s=>`drugs/${s}/index.html`),...stripPages()];
  for(const f of all){const h=fs.readFileSync(f,'utf8');const m=h.match(/<(section|aside)[^>]*data-savings-watch-cta[^>]*>/);assert(m,f);assert(m[0].includes('hidden')&&m[0].includes('display:none'),f);}
});

function ctaHarness({cfg,fail=false,blocks}){
  const events=[];
  const mk=(attrs,brandEls=[],link=null)=>({attrs:{...attrs},hidden:true,style:{display:'none'},getAttribute(n){return this.attrs[n]??null;},removeAttribute(n){delete this.attrs[n];},querySelectorAll(sel){return sel==='[data-sw-brand]'?brandEls:[];},querySelector(sel){return sel==='a[data-sw-link]'?link:null;}});
  const els=blocks.map(b=>mk({'data-sw-drug':b.slug,'data-launch':'pending'},b.brand?[{textContent:'medication'}]:[], {listeners:{},addEventListener(n,f){this.listeners[n]=f;}}));
  els.forEach((e,i)=>{if(!blocks[i].slug)delete e.attrs['data-sw-drug'];e.brandEl=e.querySelectorAll('[data-sw-brand]')[0];});
  const doc={querySelectorAll:s=>s==='[data-savings-watch-cta]'?els:[],getElementById:id=>id==='drug-page-profile'?{textContent:JSON.stringify({brand:'Repatha'})}:null};
  const ctx={document:doc,window:{gtag:(...a)=>events.push(a)},fetch:async()=>{if(fail)throw new Error('offline');return {json:async()=>cfg};}};
  vm.runInNewContext(ctaSource,ctx);
  return {els,events,wait:async()=>{for(let i=0;i<10;i++)await Promise.resolve();}};
}
test('reveal script: stays hidden when live is false, when the file is unreadable, or when live is not exactly true',async()=>{
  for(const opts of [{cfg:{live:false,open:['repatha']}},{cfg:{live:'true',open:['repatha']}},{cfg:null},{cfg:{},fail:false},{cfg:{live:true},fail:true}]){
    const h=ctaHarness({...opts,blocks:[{slug:'repatha',brand:true},{slug:null}]});await h.wait();h.els.forEach(e=>assert.equal(e.hidden,true));
  }
});
test('reveal script: live shows open drug cards and strips, keeps non-open drugs hidden, fills the brand',async()=>{
  const h=ctaHarness({cfg:{live:true,open:['repatha']},blocks:[{slug:'repatha',brand:true},{slug:'ozempic',brand:true},{slug:null}]});await h.wait();
  assert.equal(h.els[0].hidden,false);assert.equal(h.els[0].style.display,'');assert.equal(h.els[0].attrs['data-launch'],undefined);assert.equal(h.els[0].brandEl.textContent,'Repatha');
  assert.equal(h.els[1].hidden,true,'ozempic is not open');assert.equal(h.els[2].hidden,false,'strip shows when live');
  assert(!JSON.stringify(h.events).match(/\d{3}[-. ]?\d{3}[-. ]?\d{4}/),'no phone-like data in analytics');
});
test('signup page: noindex, consent boxes unchecked, honeypot, privacy links',()=>{
  assert.match(page,/name="robots" content="noindex,nofollow"/);
  assert(!/id="swConsent"[^>]*checked/.test(page));assert(!/id="swWatch"[^>]*checked/.test(page));
  assert.match(page,/id="swHp"/);assert.match(page,/\/privacy\.html/);assert.match(page,/Reply STOP/);
  assert(page.includes('GTM-MVZBBF7R'),'GTM must stay on the page');
});
test('privacy policy and terms describe text messaging, STOP and no marketing sharing',()=>{
  const p=fs.readFileSync('privacy.html','utf8'),t=fs.readFileSync('terms.html','utf8');
  assert.match(p,/id="sms"/);assert.match(p,/reply STOP/i);assert.match(p,/do not sell or share mobile numbers/);
  assert.match(t,/5A\. Text Messages/);assert.match(t,/Consent is not a condition/);
});

function harness({search='?drug=repatha',startRes,verifyRes,drugsFail=false,postFails=false,open=['repatha']}={}){
  const posts=[],events=[];
  const el=(a={})=>({hidden:false,value:'',checked:false,disabled:false,textContent:'',attrs:a,listeners:{},children:[],focus(){this.focused=true;},getAttribute(n){return this.attrs[n]??null;},addEventListener(n,f){this.listeners[n]=f;},appendChild(c){this.children.push(c);if(c.textContent!==undefined&&this.textContent!==undefined&&c.isLink)this.link=c;},querySelector(){return btn;}});
  const btn=el();
  const ids=['#swSubmit','#swFormMsg','#swPhone','#swHp','#swConsent','#swWatch','#swForm','#swCodeForm','#swCode','#swCodeMsg','#swTurnstile','#swDrug','#swDrugList','#swDrugMsg'];
  const map=Object.fromEntries(ids.map(i=>[i,el()]));map['#swDrug'].value='Repatha';
  const steps=['form','code','done'].map(x=>el({'data-step':x}));
  const nameEls=[el(),el()];
  const doc={querySelector:s=>map[s]||null,querySelectorAll:s=>s==='[data-step]'?steps:s==='[data-drug-name]'?nameEls:[],createElement:t=>{const e=el();e.isLink=t==='a';e.tag=t;return e;},createTextNode:t=>({textContent:t}),head:{appendChild(){}}};
  const directory={items:[{name:'Repatha',brand:'Repatha',slug:'repatha',url:'/drugs/repatha/'},{name:'Ozempic',brand:'Ozempic',slug:'ozempic',url:'/drugs/ozempic/'},{name:'Dupixent',brand:'Dupixent',slug:'dupixent',url:'/drugs/dupixent/'}]};
  const fetch=async(url,opts)=>{
    if(!opts&&String(url).includes('savings-watch.json'))return {json:async()=>({live:true,open})};
    if(!opts){ if(drugsFail)throw new Error('offline'); return {json:async()=>directory}; }
    posts.push({url,body:JSON.parse(opts.body)});
    if(postFails)throw new Error('offline');
    const res=url.endsWith('/start')?(startRes||{ok:true,data:{ok:true,request_id:'req-1'}}):(verifyRes||{ok:true,data:{ok:true,verified:true}});
    return {ok:res.ok,json:async()=>res.data};
  };
  const ctx={document:doc,window:{gtag:(...a)=>events.push(a),SAVERX_SAVINGS:{api:'/api/savings',turnstileSiteKey:''}},location:{search},fetch,URLSearchParams};
  vm.runInNewContext(source,ctx);
  const visible=()=>steps.find(s=>!s.hidden)?.attrs['data-step'];
  const wait=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const type=v=>{map['#swDrug'].value=v;map['#swDrug'].listeners.input();};
  return {map,posts,events,visible,wait,type,nameEls,
    submit:()=>map['#swForm'].listeners.submit({preventDefault(){}}),
    code:()=>map['#swCodeForm'].listeners.submit({preventDefault(){},target:map['#swCodeForm']})};
}
test('medication defaults to Repatha with no URL parameter and is marked available',async()=>{
  const h=harness({search:''});await h.wait();assert.equal(h.map['#swDrug'].value,'Repatha');assert.match(h.map['#swDrugMsg'].textContent,/Repatha is available/);assert.doesNotMatch(h.map['#swDrugMsg'].className,/warn/);assert.equal(h.nameEls[0].textContent,'Repatha');
});
test('medication suggestions load from the site directory',async()=>{
  const h=harness();await h.wait();assert.equal(h.map['#swDrugList'].children.length,3);assert.equal(h.map['#swDrugList'].children[0].value,'Repatha');
});
test('typing is forgiving: case, spaces and the slug all resolve to Repatha',async()=>{
  for(const v of ['repatha','REPATHA ','  Repatha','re-patha']){const h=harness();await h.wait();h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.type(v);h.submit();await h.wait();assert.equal(h.posts[0].body.drug_slug,'repatha',v);}
});
test('a medication outside the pilot is blocked with a link to its official-programs page, and makes no API call',async()=>{
  const h=harness();await h.wait();h.type('Ozempic');assert.match(h.map['#swDrugMsg'].textContent,/Ozempic isn't available yet/);assert.equal(h.map['#swDrugMsg'].link.href,'/drugs/ozempic/');assert.match(h.map['#swDrugMsg'].className,/warn/);
  h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();assert.equal(h.posts.length,0);assert.match(h.map['#swFormMsg'].textContent,/available now \(Repatha\)/);
});
test('unknown or empty medication is rejected before any API call',async()=>{
  const h=harness();await h.wait();h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;
  h.type('zzzzmed');h.submit();await h.wait();assert.equal(h.posts.length,0);assert.match(h.map['#swDrugMsg'].textContent,/couldn't find/);
  h.type('');h.submit();await h.wait();assert.equal(h.posts.length,0);assert.match(h.map['#swDrugMsg'].textContent,/Enter the medication/);
});
test('?drug= prefills the field; a non-pilot slug is not submittable',async()=>{
  const ok=harness({search:'?drug=repatha'});await ok.wait();assert.equal(ok.map['#swDrug'].value,'Repatha');
  const no=harness({search:'?drug=dupixent'});await no.wait();assert.equal(no.map['#swDrug'].value,'dupixent');assert.match(no.map['#swDrugMsg'].textContent,/Dupixent isn't available yet/);
});
test('page still works for Repatha if the drug directory fails to load',async()=>{
  const h=harness({drugsFail:true});await h.wait();h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();assert.equal(h.posts[0].body.drug_slug,'repatha');
});
test('consent wording in the page is static and identical to the server copy',async()=>{
  const consent=fs.readFileSync('saverx-savings-watch/src/consent.js','utf8');
  const server=Object.fromEntries([...consent.matchAll(/^\s*(transactional|watch):\s*\n?\s*((?:"[^"\n]*"\s*\+?\s*)+),/gm)].map(m=>[m[1],[...m[2].matchAll(/"([^"]*)"/g)].map(x=>x[1]).join('')]));
  const decode=t=>t.replace(/&amp;/g,'&').replace(/&#39;/g,"'");
  const grab=id=>decode(page.match(new RegExp('id="'+id+'">([^<]+)</span>'))[1]);
  assert(server.transactional&&server.watch,'parsed server consent');
  assert.equal(grab('swConsentText'),server.transactional);assert.equal(grab('swWatchText'),server.watch);
  assert(!page.includes('Loading…'));
});
test('consent and phone are required before any request',async()=>{
  const h=harness();await h.wait();h.map['#swPhone'].value='(415) 555-0100';h.submit();assert.equal(h.posts.length,0);assert.match(h.map['#swFormMsg'].textContent,/agree/);
  h.map['#swConsent'].checked=true;h.map['#swPhone'].value='';h.submit();assert.equal(h.posts.length,0);
});
test('happy path: start -> code step -> verify -> done; watch consent is separate; no phone in analytics',async()=>{
  const h=harness();await h.wait();h.map['#swPhone'].value='(415) 555-0100';h.map['#swConsent'].checked=true;h.submit();await h.wait();
  assert.equal(h.posts[0].url,'/api/savings/start');assert.equal(h.posts[0].body.consent_transactional,true);assert.equal(h.posts[0].body.consent_watch,false);assert.equal(h.visible(),'code');
  h.map['#swCode'].value='123456';h.code();await h.wait();assert.equal(h.posts[1].url,'/api/savings/verify');assert.equal(h.posts[1].body.request_id,'req-1');assert.equal(h.visible(),'done');
  assert(!JSON.stringify(h.events).includes('555'));assert(!JSON.stringify(h.events).includes('4155550100'));
});
test('optional watch consent is sent only when checked',async()=>{
  const h=harness();await h.wait();h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.map['#swWatch'].checked=true;h.submit();await h.wait();assert.equal(h.posts[0].body.consent_watch,true);
});
test('server errors are shown and keep the user on the form',async()=>{
  const h=harness({startRes:{ok:false,data:{error:'invalid_phone',message:'Enter a valid US mobile number.'}}});await h.wait();
  h.map['#swPhone'].value='123';h.map['#swConsent'].checked=true;h.submit();await h.wait();assert.equal(h.visible(),'form');assert.equal(h.map['#swFormMsg'].textContent,'Enter a valid US mobile number.');assert.equal(h.map['#swSubmit'].disabled,false);
});
test('wrong code shows the error and stays on the code step',async()=>{
  const h=harness({verifyRes:{ok:false,data:{message:"That code didn't match. Please try again."}}});await h.wait();
  h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();h.map['#swCode'].value='000000';h.code();await h.wait();
  assert.equal(h.visible(),'code');assert.match(h.map['#swCodeMsg'].textContent,/didn't match/);
});
test('stylesheet keeps [hidden] elements hidden (the dismissed cookie banner must not block clicks)',()=>{
  assert.match(fs.readFileSync('assets/css/savings-watch.css','utf8'),/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
test('operating company is named on the signup page, privacy policy and terms (needed for A2P review)',()=>{
  for(const f of ['savings-watch/index.html','privacy.html','terms.html'])assert.match(fs.readFileSync(f,'utf8'),/operated by Sterling Ridge Management LP/,f);
});

test('network failure explains Savings Watch may not be open yet and keeps the form usable',async()=>{
  const h=harness({postFails:true});await h.wait();h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();
  assert.match(h.map['#swFormMsg'].textContent,/may not be open yet/);assert.equal(h.visible(),'form');assert.equal(h.map['#swSubmit'].disabled,false);
});
test('signup page has the medication field defaulting to Repatha and the full disclaimers',()=>{
  assert.match(page,/id="swDrug"[^>]*value="Repatha"/);assert.match(page,/<datalist id="swDrugList">/);
  for(const t of ['not medical advice','not the drug manufacturer','do not guarantee','Reply <strong>STOP</strong>','Texts never include the medication name','never sell it','operated by Sterling Ridge Management LP','Consent to texts is not a condition'])assert(page.includes(t),t);
  assert(!page.includes('data-step="unsupported"'));
});

test('signup page follows the switch file: a drug added to open[] becomes submittable; others stay blocked with the open list named',async()=>{
  const h=harness({open:['repatha','ozempic']});await h.wait();h.type('Ozempic');assert.match(h.map['#swDrugMsg'].textContent,/Ozempic is available/);
  h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();assert.equal(h.posts[0].body.drug_slug,'ozempic');
  h.type('Dupixent');assert.match(h.map['#swDrugMsg'].textContent,/open for Repatha, Ozempic right now, so Dupixent isn't available yet/);
});
