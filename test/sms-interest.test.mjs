import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {addInterest,removeBlock,START,END,PENDING,drugSlugs} from '../scripts/_add-sms-interest.mjs';
import {START as SW_START,END as SW_END} from '../scripts/_add-savings-watch-cta.mjs';
const src=fs.readFileSync('assets/js/sms-interest.js','utf8');
const count=(h,t)=>h.split(t).length-1;

test('injection: hidden, before enroll-help, idempotent, upgradeable, honest copy',()=>{
  const html='<main><section id="enroll-help"></section></main>';
  const a=addInterest(html,'repatha');assert.equal(a.changed,true);assert(a.html.includes(PENDING));assert(a.html.indexOf(START)<a.html.indexOf('id="enroll-help"'));
  assert.match(a.html,/COMING SOON/);assert.match(a.html,/aren’t live yet/);assert.match(a.html,/No phone number needed/);
  const b=addInterest(a.html,'repatha');assert.equal(b.changed,false);assert.equal(count(b.html,START),1);assert.equal(removeBlock(a.html).trim(),html);
  assert.equal(addInterest('<main></main>','x').error,'anchor not found');
});
test('all 363+ drug pages: exactly one hidden card, own slug, GTM + footer + Savings Watch card intact, no marker collision',()=>{
  let n=0;
  for(const slug of drugSlugs()){const h=fs.readFileSync(`drugs/${slug}/index.html`,'utf8');if(!h.includes('id="enroll-help"'))continue;n++;
    assert.equal(count(h,START),1,slug);assert.equal(count(h,END),1,slug);assert(h.includes(`id="sms-interest"`)&&h.includes(`data-sw-drug="${slug}"`),slug);
    const m=h.match(/<section id="sms-interest"[^>]*>/)[0];assert(m.includes('hidden')&&m.includes('display:none'),`${slug} must ship hidden`);
    assert.equal(count(h,SW_START),1,`${slug} Savings Watch card must remain`);assert.equal(count(h,SW_END),1,slug);
    assert(h.includes('GTM-MVZBBF7R'),slug);assert.equal(count(h,'<footer class="relief-footer">'),1,slug);assert(h.indexOf(START)<h.indexOf('id="enroll-help"'),slug);}
  assert(n>=363,`checked ${n}`);
});
test('switch file ships with interest OFF and live OFF; Apps Script allows the two new events',()=>{
  const c=JSON.parse(fs.readFileSync('data/savings-watch.json','utf8'));assert.equal(c.interest,false);assert.equal(c.live,false);
  const gs=fs.readFileSync('scripts/Code.gs','utf8');assert.match(gs,/TRACKED_EVENTS[\s\S]{0,400}"sms_interest_click"/);assert.match(gs,/"sms_interest_email"/);
});

function harness({cfg,fail=false,storedVariant=null,random=0.1,beacon=true,store:prior=null}={}){
  const events=[],images=[],beacons=[],store=prior||{};if(storedVariant)store.sr_si_v=storedVariant;
  const el=(a={})=>({attrs:{...a},hidden:false,style:{},value:'',checked:false,textContent:'',listeners:{},focus(){this.focused=true;},getAttribute(n){return this.attrs[n]??null;},setAttribute(n,v){this.attrs[n]=v;},removeAttribute(n){delete this.attrs[n];},addEventListener(n,f){this.listeners[n]=f;}});
  const block=el({'data-sw-drug':'repatha','data-launch':'pending'});block.hidden=true;block.style={display:'none'};
  const head=el(),brandEls=[el(),el()],btn=el(),after=el(),main=el(),thanks=el(),msg=el(),form=el(),email=el(),consent=el(),hp=el(),intro=el();after.hidden=true;thanks.hidden=true;
  const email_q={'input[type=email]':email,'input[type=checkbox]':consent,'input[name=website]':hp,'[data-si-msg]':msg};
  form.querySelector=s=>email_q[s]||null;after.querySelector=s=>s==='input[type=email]'?email:null;
  const map={'[data-si-headline]':head,'[data-si-btn]':btn,'[data-si-after]':after,'[data-si-main]':main,'[data-si-form]':form,'[data-si-thanks]':thanks,'[data-si-intro]':intro};
  block.querySelector=s=>map[s]||null;block.querySelectorAll=s=>s==='[data-si-brand]'?brandEls:[];
  const doc={querySelectorAll:s=>s==='[data-sms-interest]'?[block]:[],getElementById:id=>id==='drug-page-profile'?{textContent:JSON.stringify({brand:'Repatha'})}:null,referrer:'https://example.test/'};
  const ctx={document:doc,window:{gtag:(...a)=>events.push(a),localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}}},
    navigator:{userAgent:'test-agent',...(beacon?{sendBeacon:(u,b)=>{beacons.push({u,b});return true;}}:{})},Image:class{set src(v){images.push(v);}},Blob:class{constructor(p){this.text=p.join('');}},URLSearchParams,
    fetch:async()=>{if(fail)throw new Error('x');return {json:async()=>cfg};},Math:{...Math,random:()=>random},encodeURIComponent,Date,JSON};
  ctx.window.localStorage=ctx.window.localStorage;ctx.localStorage=ctx.window.localStorage;
  vm.runInNewContext(src,ctx);
  return {intro,block,head,brandEls,btn,after,main,thanks,msg,form,email,consent,hp,events,images,beacons,store,
    wait:async()=>{for(let i=0;i<12;i++)await Promise.resolve();},
    submit:()=>form.listeners.submit({preventDefault(){}})};
}
test('stays hidden when interest is off, live is true, the file is unreadable, or interest is not exactly true',async()=>{
  for(const o of [{cfg:{interest:false,live:false}},{cfg:{interest:true,live:true}},{cfg:{interest:'true',live:false}},{cfg:null},{cfg:{},fail:false},{cfg:{interest:true},fail:true}]){
    const h=harness(o);await h.wait();assert.equal(h.block.hidden,true,JSON.stringify(o));
  }
});
test('interest on + live off: shown with the brand filled; variant copy and persistence',async()=>{
  const c=harness({cfg:{interest:true,live:false},random:0.1});await c.wait();assert.equal(c.block.hidden,false);assert.equal(c.block.style.display,'');
  assert.equal(c.store.sr_si_v,'coupons');assert.match(c.head.textContent,/Want a text when there’s news on Repatha manufacturer savings and coupons\?/);assert.equal(c.brandEls[0].textContent,'Repatha');
  const u=harness({cfg:{interest:true,live:false},random:0.9});await u.wait();assert.equal(u.store.sr_si_v,'updates');assert.equal(u.head.textContent,'Want text updates about Repatha?');
  const sticky=harness({cfg:{interest:true,live:false},storedVariant:'updates',random:0.1});await sticky.wait();assert.equal(sticky.store.sr_si_v,'updates','returning visitor keeps their variant');
  assert(c.events.some(e=>e[1]==='sms_interest_view'&&e[2].drug_slug==='repatha'&&e[2].variant==='coupons'));
  assert.equal(c.images.length,0,'views are GA4-only: no sheet beacon per pageview');
});
test('click: anonymous beacon + GA4 (slug + variant only), reveals the honest follow-up',async()=>{
  const h=harness({cfg:{interest:true,live:false}});await h.wait();h.btn.listeners.click();
  assert.equal(h.images.length,1);assert.match(h.images[0],/mode=track&ev=sms_interest_click&slug=repatha&x=coupons/);
  assert.equal(h.main.hidden,true);assert.equal(h.after.hidden,false);assert.equal(h.email.focused,true);
  assert(h.events.some(e=>e[1]==='sms_interest_click'));assert(!JSON.stringify([h.events,h.images]).includes('@'));
});
test('email signup: validates, needs consent, honeypot ignored, posts to the lead endpoint with a tagged source, analytics stay anonymous',async()=>{
  const h=harness({cfg:{interest:true,live:false}});await h.wait();h.btn.listeners.click();
  h.email.value='nope';h.submit();assert.match(h.msg.textContent,/valid email/);assert.equal(h.beacons.length,0);
  h.email.value='person@example.test';h.consent.checked=false;h.submit();assert.match(h.msg.textContent,/check the box/);assert.equal(h.beacons.length,0);
  h.hp.value='bot';h.consent.checked=true;h.submit();assert.equal(h.beacons.length,0,'honeypot');h.hp.value='';
  h.submit();assert.equal(h.beacons.length,1);const body=new URLSearchParams(h.beacons[0].b.text);
  assert.equal(body.get('email'),'person@example.test');assert.equal(body.get('drug'),'Repatha');assert.equal(body.get('source'),'SMS interest (coupons)');
  assert.equal(h.form.hidden,true);assert.equal(h.intro.hidden,true);assert.equal(h.thanks.hidden,false);
  assert(!JSON.stringify(h.events).includes('person@example.test'),'email never goes to analytics');
  assert(h.images.some(i=>/ev=sms_interest_email&slug=repatha&x=coupons/.test(i)));assert(!h.images.join('').includes('person@example.test'));
});
test('email signup still works where sendBeacon is missing (falls back to fetch, silently)',async()=>{
  const h=harness({cfg:{interest:true,live:false},beacon:false});await h.wait();h.btn.listeners.click();h.email.value='a@b.test';h.consent.checked=true;h.submit();
  assert.equal(h.thanks.hidden,false);
});
test('the card never collects a phone number',()=>{
  const html=fs.readFileSync('drugs/repatha/index.html','utf8');const blk=html.slice(html.indexOf(START),html.indexOf(END));
  assert(!/type="tel"|name="phone"|phone/i.test(blk.replace('No phone number needed','')),'no phone field');
});

test('repeat clicks by the same browser on the same drug are counted once (beacon + GA4); the follow-up still opens',async()=>{
  const first=harness({cfg:{interest:true,live:false}});await first.wait();first.btn.listeners.click();
  assert.equal(first.images.length,1);assert.equal(JSON.parse(first.store.sr_si_c).join(','),'repatha');
  const again=harness({cfg:{interest:true,live:false},store:first.store});await again.wait();again.btn.listeners.click();
  assert.equal(again.images.length,0,'no second beacon');assert(!again.events.some(e=>e[1]==='sms_interest_click'),'no second GA4 click event');
  assert.equal(again.after.hidden,false,'visitor still sees the follow-up');assert.equal(JSON.parse(again.store.sr_si_c).length,1);
});
