import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {addCta,MARKER,PILOT_SLUGS,PENDING} from '../scripts/_add-savings-watch-cta.mjs';
const page=fs.readFileSync('savings-watch/index.html','utf8');
const source=fs.readFileSync('assets/js/savings-watch.js','utf8');

test('CTA injection is idempotent and links to the right medication',()=>{
  const html='<main><section id="enroll-help" class="x"></section></main>';
  const a=addCta(html,'repatha');assert.equal(a.changed,true);assert.match(a.html,/href="\/savings-watch\/\?drug=repatha"/);assert.match(a.html,/Find savings for me — Free/);
  assert(a.html.includes(PENDING),'ships hidden until launch');
  const b=addCta(a.html,'repatha');assert.equal(b.changed,false);assert.equal(b.html.split(MARKER).length-1,1);
  const live=addCta(a.html,'repatha',{live:true});assert.equal(live.changed,true);assert(!live.html.includes(PENDING));assert.equal(live.html.split(MARKER).length-1,1);
  assert.equal(addCta(live.html,'repatha',{live:true}).changed,false);
  assert.equal(addCta('<main></main>','x').error,'anchor not found');
});
test('only the pilot page has the button for now',()=>{
  assert.deepEqual(PILOT_SLUGS,['repatha']);
  const rep=fs.readFileSync('drugs/repatha/index.html','utf8');assert.equal(rep.split(MARKER).length-1,1);
  assert(rep.includes(PENDING),'Repatha card stays hidden until the Worker is live (run --live at launch)');
  assert(!fs.readFileSync('drugs/ozempic/index.html','utf8').includes(MARKER));
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

function harness({search='?drug=repatha',startRes,verifyRes,drugsFail=false,postFails=false}={}){
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
  h.map['#swPhone'].value='4155550100';h.map['#swConsent'].checked=true;h.submit();await h.wait();assert.equal(h.posts.length,0);assert.match(h.map['#swFormMsg'].textContent,/pilot/);
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
