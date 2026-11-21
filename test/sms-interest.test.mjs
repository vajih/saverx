import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {addInterest,addInterestGuide,GUIDE_PAGES,removeBlock,START,END,PENDING,drugSlugs} from '../scripts/_add-sms-interest.mjs';
import {addSmsHome,removeSmsHome,START as HOME_START,END as HOME_END,LINK_START,LINK_END,PENDING as HOME_PENDING} from '../scripts/_add-sms-home.mjs';
import {START as SW_START,END as SW_END} from '../scripts/_add-savings-watch-cta.mjs';
const src=fs.readFileSync('assets/js/sms-interest.js','utf8');
const count=(h,t)=>h.split(t).length-1;

test('injection: hidden, before enroll-help, idempotent, upgradeable; phone-first with the full consent disclosure',()=>{
  const html='<main><section id="enroll-help"></section></main>';
  const a=addInterest(html,'repatha');assert.equal(a.changed,true);assert(a.html.includes(PENDING));assert(a.html.indexOf(START)<a.html.indexOf('id="enroll-help"'));
  assert.match(a.html,/LAUNCHING SOON/);assert.match(a.html,/type="tel"[^>]*name="phone"|name="phone"[^>]*type="tel"/);
  const c=a.html.match(/<p class="si-consent"[\s\S]*?<\/p>/)[0];
  for(const must of [/recurring automated text messages/,/SaveRx\.ai/,/not a condition of any purchase/,/Message frequency varies/,/Message and data rates may apply/,/Reply STOP to cancel/,/HELP for help/,/privacy\.html#sms/,/terms\.html/,/never put medication names in a text/,/first message asking you to confirm/])
    assert.match(c,must,`consent disclosure must include ${must}`);
  assert(a.html.indexOf('data-si-btn')<a.html.indexOf('si-consent'),'disclosure sits directly under the button');
  const b=addInterest(a.html,'repatha');assert.equal(b.changed,false);assert.equal(count(b.html,START),1);assert.equal(removeBlock(a.html).trim(),html);
  assert.equal(addInterest('<main></main>','x').error,'anchor not found');
});
test('all 363+ drug pages: exactly one hidden card, own slug, phone field + disclosure, GTM + footer + Savings Watch card intact',()=>{
  let n=0;
  for(const slug of drugSlugs()){const h=fs.readFileSync(`drugs/${slug}/index.html`,'utf8');if(!h.includes('id="enroll-help"'))continue;n++;
    assert.equal(count(h,START),1,slug);assert.equal(count(h,END),1,slug);assert(h.includes(`id="sms-interest"`)&&h.includes(`data-sw-drug="${slug}"`),slug);
    const m=h.match(/<section id="sms-interest"[^>]*>/)[0];assert(m.includes('hidden')&&m.includes('display:none'),`${slug} must ship hidden`);
    assert(h.includes('name="phone"')&&h.includes('data-si-consent')&&h.includes('Reply STOP to cancel'),`${slug} phone form + disclosure`);
    assert.equal(count(h,SW_START),1,`${slug} Savings Watch card must remain`);assert.equal(count(h,SW_END),1,slug);
    assert(h.includes('GTM-MVZBBF7R'),slug);assert.equal(count(h,'<footer class="relief-footer">'),1,slug);assert(h.indexOf(START)<h.indexOf('id="enroll-help"'),slug);}
  assert(n>=363,`checked ${n}`);
});
test('guide/coupon pages under drugs/: exactly one hidden card each, carrying the drug name; redirect page excluded; GTM + footer intact',()=>{
  for(const [f,[slug,name]] of Object.entries(GUIDE_PAGES)){const h=fs.readFileSync(f,'utf8');
    assert.equal(count(h,START),1,f);assert(h.includes('id="sms-interest"')&&h.includes(`data-sw-drug="${slug}"`)&&h.includes(`data-si-name="${name}"`),f);
    const m=h.match(/<section id="sms-interest"[^>]*>/)[0];assert(m.includes('hidden')&&m.includes('display:none'),`${f} ships hidden`);
    assert(h.includes('name="phone"')&&h.includes('Reply STOP to cancel')&&h.includes('sms-interest.js'),f);assert(h.includes('GTM-MVZBBF7R'),f);assert.equal(count(h,'<footer class="relief-footer">'),1,f);
    assert(h.indexOf(START)<h.indexOf('<footer class="relief-footer">'),`${f}: card before footer`);}
  assert(!('drugs/repatha-enroll.html' in GUIDE_PAGES));assert(!fs.readFileSync('drugs/repatha-enroll.html','utf8').includes('id="sms-interest"'));
  const base='<main></main><!-- saverx-savings-watch-cta --><aside></aside><footer class="relief-footer"></footer>';
  const a=addInterestGuide(base,'ozempic','Ozempic');assert.equal(a.changed,true);assert(a.html.indexOf(START)<a.html.indexOf('<!-- saverx-savings-watch-cta -->'));
  assert.equal(addInterestGuide(a.html,'ozempic','Ozempic').changed,false);assert.equal(removeBlock(a.html).trim(),base.trim());assert.equal(addInterestGuide('<main></main>','x','X').error,'anchor not found');
});
test('switch file: waitlist ON (interest) while Savings Watch stays OFF (live); Apps Script allows the tracked events',()=>{
  // Interest card is enabled (2026-11-20, Code.gs v20 deployed). live must stay false until the Worker is deployed and A2P is approved.
  const c=JSON.parse(fs.readFileSync('data/savings-watch.json','utf8'));assert.equal(c.interest,true);assert.equal(c.live,false);
  const gs=fs.readFileSync('scripts/Code.gs','utf8');assert.match(gs,/TRACKED_EVENTS[\s\S]{0,400}"sms_interest_click"/);assert.match(gs,/"sms_interest_email"/);
});

const CONSENT='By tapping “Get text alerts,” you agree to receive recurring automated text messages from SaveRx.ai about Repatha savings programs. Reply STOP to cancel.';
function harness({cfg,fail=false,storedVariant=null,random=0.1,beacon=true,store:prior=null,sstore:sprior=null,search='',inView=false,home=false,guideName='',noJump=false,footerTop=null}={}){
  const intervals=[],cleared=[],events=[],images=[],sent=[],timers=[],assigned=[],appended=[],store=prior||{},sstore=sprior||{},wl={};if(storedVariant)store.sr_si_v=storedVariant;
  const el=(a={})=>({children:[],appendChild(c){this.children.push(c);},attrs:{...a},hidden:false,style:{},value:'',checked:false,textContent:'',listeners:{},focus(){this.focused=true;},getAttribute(n){return this.attrs[n]??null;},setAttribute(n,v){this.attrs[n]=v;},removeAttribute(n){delete this.attrs[n];},addEventListener(n,f){this.listeners[n]=f;}});
  const block=el(home?{'data-sw-drug':'home','data-launch':'pending','data-si-home':'','data-si-consent-version':'2026-11-21-home-v1'}:{'data-sw-drug':'repatha','data-launch':'pending',...(guideName?{'data-si-name':guideName}:{})});block.hidden=true;block.style={display:'none'};
  block.getBoundingClientRect=()=>inView?{top:100,bottom:600}:{top:5000,bottom:5500};block.scrollIntoView=()=>{block.scrolled=true;};
  const head=el(),brandEls=[el(),el(),el()],main=el(),thanks=el(),emailBox=el(),bar=el(),go=el(),x=el(),toggle=el(),emailThanks=el();
  const form=el(),phone=el(),hp=el(),msg=el(),consentEl=el(),eform=el(),email=el(),consent=el(),ehp=el(),emsg=el();
  consentEl.textContent=CONSENT;thanks.hidden=true;emailBox.hidden=true;bar.hidden=true;emailThanks.hidden=true;
  const drugIn=el(),drugList=el(),chips=[el({'data-si-chip':'Repatha'}),el({'data-si-chip':'Ozempic'})],homeLink=el();homeLink.hidden=true;homeLink.style={display:'none'};drugList.opts=[];drugList.appendChild=o=>drugList.opts.push(o.value);
  const fq={'input[name=drug]':drugIn,'input[name=phone]':phone,'input[name=website]':hp,'[data-si-msg]':msg,'[data-si-consent]':consentEl};form.querySelector=s=>fq[s]||null;
  const eq={'input[type=email]':email,'input[type=checkbox]':consent,'input[name=website]':ehp,'[data-si-email-msg]':emsg};eform.querySelector=s=>eq[s]||null;emailBox.querySelector=s=>s==='input[type=email]'?email:null;
  const map={'[data-si-drug-list]':drugList,'[data-si-headline]':head,'[data-si-main]':main,'[data-si-thanks]':thanks,'[data-si-email]':emailBox,'[data-si-bar]':bar,'[data-si-phone-form]':form,'[data-si-email-toggle]':toggle,'[data-si-email-form]':eform,'[data-si-email-thanks]':emailThanks,'[data-si-bar-go]':go,'[data-si-bar-x]':x};
  block.querySelector=s=>map[s]||null;block.querySelectorAll=s=>s==='[data-si-brand]'?brandEls:s==='[data-si-chip]'?chips:[];
  const inserted=[],jump={parentNode:{insertBefore:(n,ref)=>inserted.push({n,ref})}};
  const footer={getBoundingClientRect:()=>({top:footerTop===null?99999:footerTop})};
  const doc={querySelector:s=>s==='.drug-jump'&&!noJump?jump:s==='footer'&&footerTop!==null?footer:null,createElement:()=>el(),body:{appendChild:n=>appended.push(n)},querySelectorAll:s=>s==='[data-sms-interest]'?[block]:s==='[data-si-home-link]'?[homeLink]:[],getElementById:id=>id==='drug-page-profile'&&!home&&!guideName?{textContent:JSON.stringify({brand:'Repatha'})}:null,referrer:'https://example.test/',documentElement:{scrollHeight:4000}};
  const win={gtag:(...a)=>events.push(a),location:{pathname:'/drugs/repatha/',search,assign:u=>assigned.push(u)},innerHeight:800,scrollY:0,addEventListener:(n,f)=>{wl[n]=f;},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}},sessionStorage:{getItem:k=>sstore[k]??null,setItem:(k,v)=>{sstore[k]=v;},removeItem:k=>{delete sstore[k];}}};
  const ctx={document:doc,window:win,navigator:{userAgent:'test-agent',...(beacon?{sendBeacon:(u,b)=>{sent.push(b.text);return true;}}:{})},Image:class{set src(v){images.push(v);}},Blob:class{constructor(p){this.text=p.join('');}},URLSearchParams,
    fetch:async(u,o)=>{if(o&&o.method==='POST'){sent.push(o.body);return {};}if(typeof u==='string'&&u.includes('mode=track')){images.push(u);return {};}if(u==='/data/drugs.json')return {json:async()=>({items:[{name:'Repatha',brand:'Repatha',slug:'repatha',url:'/drugs/repatha/'},{name:'Ozempic',brand:'Ozempic',slug:'ozempic',url:'/drugs/ozempic/'}]})};if(fail)throw new Error('x');return {json:async()=>cfg};},Math:{...Math,random:()=>random},encodeURIComponent,Date,JSON,setTimeout:f=>{timers.push(f);return 1;},setInterval:f=>{intervals.push(f);return intervals.length;},clearInterval:i=>{cleared.push(i);}};
  ctx.localStorage=win.localStorage;
  vm.runInNewContext(src,ctx);
  return {inserted,jump,intervals,cleared,assigned,appended,drugIn,drugList,chips,homeLink,block,head,brandEls,main,thanks,emailBox,emailThanks,bar,go,x,toggle,form,phone,hp,msg,eform,email,consent,ehp,emsg,events,images,sent,timers,store,sstore,win,doc,wl,
    wait:async()=>{for(let i=0;i<12;i++)await Promise.resolve();},
    submit:()=>form.listeners.submit({preventDefault(){}}),esubmit:()=>eform.listeners.submit({preventDefault(){}})};
}
const ON={interest:true,live:false};
test('stays hidden when interest is off, live is true, the file is unreadable, or interest is not exactly true',async()=>{
  for(const o of [{cfg:{interest:false,live:false}},{cfg:{interest:true,live:true}},{cfg:{interest:'true',live:false}},{cfg:null},{cfg:{},fail:false},{cfg:{interest:true},fail:true}]){
    const h=harness(o);await h.wait();assert.equal(h.block.hidden,true,JSON.stringify(o));
  }
});
test('interest on + live off: shown with the brand filled; variant copy and persistence',async()=>{
  const c=harness({cfg:ON,random:0.1});await c.wait();assert.equal(c.block.hidden,false);assert.equal(c.block.style.display,'');
  assert.equal(c.store.sr_si_v,'coupons');assert.equal(c.head.textContent,'Get a text when Repatha savings or coupons change');assert.equal(c.brandEls[0].textContent,'Repatha');
  const u=harness({cfg:ON,random:0.9});await u.wait();assert.equal(u.store.sr_si_v,'updates');assert.equal(u.head.textContent,'Get text alerts about Repatha');
  const sticky=harness({cfg:ON,storedVariant:'updates',random:0.1});await sticky.wait();assert.equal(sticky.store.sr_si_v,'updates','returning visitor keeps their variant');
  assert(c.events.some(e=>e[1]==='sms_interest_view'&&e[2].drug_slug==='repatha'&&e[2].variant==='coupons'));
  assert.equal(c.images.length,0,'views are GA4-only: no sheet beacon per pageview');
});
test('phone submit: rejects bad numbers with a message and sends nothing',async()=>{
  const h=harness({cfg:ON});await h.wait();
  for(const bad of ['','12345','(123) 456-7890','(832) 056-7788','5555555555','(832) 555-0142','abcdefghij','1234567890123']){
    h.phone.value=bad;h.submit();assert.match(h.msg.textContent,/valid 10-digit US mobile number/,bad);assert.equal(h.sent.length,0,bad);}
  assert.equal(h.main.hidden,false);
});
test('phone submit: posts phone + drug + variant + the exact consent text; analytics and beacons never carry the number',async()=>{
  const h=harness({cfg:ON,search:'?utm_source=fb&utm_medium=cpc&utm_campaign=nov'});await h.wait();
  h.phone.value='(832) 456-7788';h.submit();
  assert.equal(h.sent.length,1);const b=new URLSearchParams(h.sent[0]);
  assert.equal(b.get('form_type'),'text_waitlist');assert.equal(b.get('phone'),'+18324567788');assert.equal(b.get('drug'),'Repatha');assert.equal(b.get('drug_slug'),'repatha');assert.equal(b.get('variant'),'coupons');
  assert.equal(b.get('consent_version'),'2026-11-20-v1');assert.equal(b.get('consent_text'),CONSENT,'saves the exact wording that was on screen');
  assert.equal(b.get('source_page'),'/drugs/repatha/');assert.equal(b.get('utm_source'),'fb');assert.equal(b.get('utm_medium'),'cpc');assert.equal(b.get('utm_campaign'),'nov');assert.equal(b.get('useragent'),'test-agent');
  assert.equal(h.main.hidden,true);assert.equal(h.thanks.hidden,false);assert.equal(h.bar.hidden,true);
  assert(h.events.some(e=>e[1]==='sms_waitlist_signup'&&e[2].drug_slug==='repatha'));
  const leak=JSON.stringify([h.events,h.images]);assert(!/8324567788|\(832\)/.test(leak),'number must never reach analytics or beacon URLs');
  assert.equal(h.images.length,1);assert.match(h.images[0],/ev=sms_interest_click&slug=repatha&x=coupons/);
  assert(h.sent.every(s=>!s.includes('undefined')));
});
test('phone submit: accepts +1 / dashes / spaces; honeypot gets nothing; repeat on same drug counts one click but still stores the signup',async()=>{
  const h=harness({cfg:ON});await h.wait();h.phone.value='1-832-456-7788';h.hp.value='bot';h.submit();assert.equal(h.sent.length,0,'honeypot');h.hp.value='';
  h.submit();assert.equal(new URLSearchParams(h.sent[0]).get('phone'),'+18324567788');
  const again=harness({cfg:ON,store:h.store});await again.wait();again.phone.value='832 456 7788';again.submit();
  assert.equal(again.sent.length,1,'signup still stored');assert.equal(again.images.length,0,'no second interest beacon for the same drug');
});
test('phone submit still works where sendBeacon is missing (falls back to fetch, silently)',async()=>{
  const h=harness({cfg:ON,beacon:false});await h.wait();h.phone.value='8324567788';h.submit();assert.equal(h.sent.length,1);assert.equal(h.thanks.hidden,false);
});
test('email fallback: counted once, validates, needs its own consent, posts with a tagged source, analytics stay anonymous',async()=>{
  const h=harness({cfg:ON});await h.wait();h.toggle.listeners.click();
  assert.equal(h.images.length,1);assert.match(h.images[0],/mode=track&ev=sms_interest_click&slug=repatha&x=coupons/);assert.equal(h.main.hidden,true);assert.equal(h.emailBox.hidden,false);assert.equal(h.email.focused,true);
  h.email.value='nope';h.esubmit();assert.match(h.emsg.textContent,/valid email/);assert.equal(h.sent.length,0);
  h.email.value='person@example.test';h.consent.checked=false;h.esubmit();assert.match(h.emsg.textContent,/check the box/);assert.equal(h.sent.length,0);
  h.ehp.value='bot';h.consent.checked=true;h.esubmit();assert.equal(h.sent.length,0,'honeypot');h.ehp.value='';
  h.esubmit();assert.equal(h.sent.length,1);const body=new URLSearchParams(h.sent[0]);
  assert.equal(body.get('email'),'person@example.test');assert.equal(body.get('drug'),'Repatha');assert.equal(body.get('source'),'SMS interest (coupons)');assert(!body.get('form_type'));
  assert.equal(h.eform.hidden,true);assert.equal(h.emailThanks.hidden,false);
  assert(!JSON.stringify(h.events).includes('person@example.test'),'email never goes to analytics');
  assert(h.images.some(i=>/ev=sms_interest_email&slug=repatha&x=coupons/.test(i)));assert(!h.images.join('').includes('person@example.test'));
});
test('slim bar: not shown at first, appears once after the delay if the card is off-screen, never if the card is visible',async()=>{
  const h=harness({cfg:ON});await h.wait();assert.equal(h.bar.hidden,true);assert.equal(h.timers.length,1);
  h.timers[0]();assert.equal(h.bar.hidden,false);assert(h.events.some(e=>e[1]==='sms_bar_view'));
  const seen=harness({cfg:ON,inView:true});await seen.wait();seen.timers[0]();assert.equal(seen.bar.hidden,true,'card already visible: no bar');
});
test('slim bar: scroll trigger at ~40%, "Add my number" scrolls to + focuses the phone field, dismiss persists for the session',async()=>{
  const h=harness({cfg:ON});await h.wait();h.win.scrollY=800;h.wl.scroll();assert.equal(h.bar.hidden,true,'25% scrolled: not yet');
  h.win.scrollY=1600;h.wl.scroll();assert.equal(h.bar.hidden,false,'50% scrolled: shown');assert(h.events.some(e=>e[1]==='sms_bar_view'));
  h.go.listeners.click();assert.equal(h.bar.hidden,true);assert.equal(h.block.scrolled,true);assert.equal(h.phone.focused,true);assert(h.events.some(e=>e[1]==='sms_bar_click'));
  const d=harness({cfg:ON});await d.wait();d.timers[0]();d.x.listeners.click();assert.equal(d.bar.hidden,true);assert.equal(d.sstore.sr_si_bx,'1');
  const next=harness({cfg:ON,sstore:d.sstore});await next.wait();next.timers[0]();assert.equal(next.bar.hidden,true,'stays dismissed for the session');
});
test('slim bar: never appears after a successful signup',async()=>{
  const h=harness({cfg:ON});await h.wait();h.phone.value='8324567788';h.submit();h.timers[0]();assert.equal(h.bar.hidden,true);
});
test('copy stays honest: text alerts are "launching soon", never claims texts are already being sent',()=>{
  const s=fs.readFileSync('scripts/_add-sms-interest.mjs','utf8');assert.match(s,/LAUNCHING SOON/);assert.match(s,/We’ll text you when/);assert(!/we(?:’|')ll text you (?:now|right away|instantly)/i.test(s));
});

// ---- Homepage band
test('home injection: hidden band before the trustbar + hidden hero link; idempotent; removable; full consent disclosure',()=>{
  const page='<main><section class="hero"><div class="privacy"><span>✓ No insurance details to search</span></div></div></section><div class="trustbar">x</div></main>';
  const a=addSmsHome(page);assert.equal(a.changed,true);assert(a.html.includes(HOME_PENDING));
  assert(a.html.indexOf(LINK_START)<a.html.indexOf(HOME_START)&&a.html.indexOf(HOME_END)<a.html.indexOf('<div class="trustbar">'),'link in hero, band right before trustbar');
  const band=a.html.slice(a.html.indexOf(HOME_START),a.html.indexOf(HOME_END));
  assert.match(band,/type="tel"[^>]*name="phone"|name="phone"[^>]*type="tel"/);assert.match(band,/name="drug"/);assert.match(band,/<datalist id="siHomeDrugs"/);assert.match(band,/data-si-chip="Repatha"/);
  const c=band.match(/<p class="si-consent"[\s\S]*?<\/p>/)[0];
  for(const must of [/recurring automated text messages/,/SaveRx\.ai/,/the medication you entered/,/not a condition of any purchase/,/Message frequency varies/,/Message and data rates may apply/,/Reply STOP to cancel/,/HELP for help/,/privacy\.html#sms/,/terms\.html/,/never put medication names in a text/,/first message asking you to confirm/])assert.match(c,must,String(must));
  assert(band.indexOf('data-si-btn')<band.indexOf('class="si-consent"'),'disclosure directly under the button');
  const b=addSmsHome(a.html);assert.equal(b.changed,false);assert.equal(count(b.html,HOME_START),1);assert.equal(count(b.html,LINK_START),1);assert.equal(removeSmsHome(a.html).trim(),page);
  assert.equal(addSmsHome('<main></main>').error,'anchor not found');
});
test('real homepage: exactly one hidden band + one hidden hero link; search, GTM, trustbar, Savings Watch strip intact',()=>{
  const h=fs.readFileSync('index.html','utf8');
  assert.equal(count(h,HOME_START),1);assert.equal(count(h,HOME_END),1);assert.equal(count(h,LINK_START),1);assert.equal(count(h,'id="sms-home"'),1);
  assert(/<section id="sms-home"[^>]*hidden style="display:none"/.test(h),'band ships hidden');assert(/<p class="sms-hero-link"[^>]*hidden style="display:none"/.test(h),'hero link ships hidden');
  assert(h.includes('id="search-form"')&&h.includes('GTM-MVZBBF7R'));assert.equal(count(h,'<div class="trustbar">'),1);assert.equal(count(h,SW_START),1);
  assert(h.indexOf('class="hero"')<h.indexOf(HOME_START)&&h.indexOf(HOME_START)<h.indexOf('<div class="trustbar">'),'band sits directly under the hero');
});
const HOME_CONSENT='By tapping “Get text alerts,” you agree to receive recurring automated text messages from SaveRx.ai about savings programs for the medication you entered. Reply STOP to cancel.';
test('home: reveals band + hero link, keeps the static headline, loads the medication list into the type-ahead',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.wait();
  assert.equal(h.block.hidden,false);assert.equal(h.homeLink.hidden,false);assert.equal(h.homeLink.style.display,'');assert.equal(h.head.textContent,'','static headline: not overwritten');
  assert.equal(h.block.attrs['data-si-variant'],'home');assert.deepEqual(h.drugList.opts,['Repatha','Ozempic']);
  assert(h.events.some(e=>e[1]==='sms_interest_view'&&e[2].drug_slug==='home'&&e[2].variant==='home'));
  const off=harness({cfg:{interest:false,live:false},home:true});await off.wait();assert.equal(off.block.hidden,true);assert.equal(off.homeLink.hidden,true,'link stays hidden with the switch off');
});
test('home submit: needs a medication and a valid number; listed drug gets its real slug; consent version is the home version',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.phone.value='(832) 456-7788';
  h.drugIn.value='';h.submit();assert.match(h.msg.textContent,/enter your medication/);assert.equal(h.sent.length,0);
  h.drugIn.value='x';h.submit();assert.match(h.msg.textContent,/enter your medication/);
  h.drugIn.value='repatha';h.phone.value='123';h.submit();assert.match(h.msg.textContent,/valid 10-digit/);assert.equal(h.sent.length,0);
  h.phone.value='(832) 456-7788';h.consentEl;h.submit();assert.equal(h.sent.length,1);const b=new URLSearchParams(h.sent[0]);
  assert.equal(b.get('form_type'),'text_waitlist');assert.equal(b.get('phone'),'+18324567788');assert.equal(b.get('drug'),'Repatha','canonical name');assert.equal(b.get('drug_slug'),'repatha');
  assert.equal(b.get('variant'),'home');assert.equal(b.get('consent_version'),'2026-11-21-home-v1');assert.equal(b.get('source_page'),'/drugs/repatha/'.replace('/drugs/repatha/','/drugs/repatha/'));
  assert.equal(h.main.hidden,true);assert.equal(h.thanks.hidden,false);assert.equal(h.brandEls[0].textContent,'Repatha');
  assert(!h.events.some(e=>e[1]==='sms_waitlist_signup'),'redirecting: the GA event is NOT fired here (it would be dropped on unload); the destination page sends it');assert.equal(JSON.parse(h.sstore.sr_si_done).ev,1);assert.match(h.images[0],/ev=sms_interest_click&slug=repatha&x=home/);
  assert(!/8324567788|\(832\)/.test(JSON.stringify([h.events,h.images])),'number never reaches analytics');
});
test('home submit: an unlisted medication is still captured (custom slug, text kept) but never sent to analytics',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.drugIn.value='  Some New Drug! ';h.phone.value='8324567788';h.submit();
  const b=new URLSearchParams(h.sent[0]);assert.equal(b.get('drug'),'Some New Drug!');assert.equal(b.get('drug_slug'),'custom-some-new-drug');
  assert(h.events.some(e=>e[1]==='sms_waitlist_signup'&&e[2].drug_slug==='custom'));assert.match(h.images[0],/slug=custom&x=home/);
  assert(!JSON.stringify([h.events,h.images]).toLowerCase().includes('some new drug'),'typed medication names never go to analytics');assert.equal(h.brandEls[0].textContent,'Some New Drug!');
  const odd=harness({cfg:ON,home:true});await odd.wait();odd.drugIn.value='###';odd.phone.value='8324567788';odd.submit();assert.equal(new URLSearchParams(odd.sent[0]).get('drug_slug'),'custom-other');
});
test('home: honeypot gets nothing; quick-pick chips fill the medication and jump to the phone field',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.drugIn.value='Ozempic';h.phone.value='8324567788';h.hp.value='bot';h.submit();assert.equal(h.sent.length,0);
  h.chips[1].listeners.click();assert.equal(h.drugIn.value,'Ozempic');assert.equal(h.phone.focused,true);h.chips[0].listeners.click();assert.equal(h.drugIn.value,'Repatha');
});

// ---- Fewer clicks: homepage signup goes straight to the drug page; the drug page confirms in place
test('home signup with a listed drug: after a brief beat, goes straight to that drug page and leaves a hand-off note',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.drugIn.value='ozempic';h.phone.value='8324567788';h.submit();
  assert.equal(h.sent.length,1,'signup is posted first');assert.equal(h.assigned.length,0,'not navigated until the timer fires (beacon is queued first)');
  const note=JSON.parse(h.sstore.sr_si_done);assert.equal(note.slug,'ozempic');assert.equal(note.name,'Ozempic');
  h.timers[h.timers.length-1]();assert.deepEqual(h.assigned,['/drugs/ozempic/']);
});
test('home signup with an unlisted drug: stays on the page with the thank-you (no page to send them to)',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.drugIn.value='Some New Drug';h.phone.value='8324567788';h.submit();
  assert.equal(h.sent.length,1);assert.equal(h.thanks.hidden,false);h.timers.forEach(t=>t());assert.equal(h.sstore.sr_si_done,undefined);assert.equal(h.assigned.length,0,'nothing navigates even after every timer fires');
});
test('arriving on the drug page after a homepage signup: card shows "you\'re on the list" (not asked again) + a small confirmation banner',async()=>{
  const note=JSON.stringify({slug:'repatha',name:'Repatha',t:Date.now()});
  const h=harness({cfg:ON,sstore:{sr_si_done:note}});await h.wait();
  assert.equal(h.main.hidden,true);assert.equal(h.thanks.hidden,false);assert.equal(h.brandEls[0].textContent,'Repatha');assert.equal(h.sstore.sr_si_done,undefined,'note is single-use');
  assert.equal(h.appended.length,1);assert.match(h.appended[0].textContent,/on the list for Repatha text alerts/);assert.equal(h.appended[0].className,'si-flash');assert.equal(h.sent.length,0,'nothing is re-posted');
  h.timers.forEach(t=>t());assert.equal(h.bar.hidden,true,'no bar after signing up');
  const other=harness({cfg:ON,sstore:{sr_si_done:JSON.stringify({slug:'ozempic',name:'Ozempic',t:Date.now()})}});await other.wait();assert.equal(other.main.hidden,false,'different drug: normal card');assert.equal(other.appended.length,0);
  const stale=harness({cfg:ON,sstore:{sr_si_done:JSON.stringify({slug:'repatha',name:'Repatha',t:Date.now()-3600e3})}});await stale.wait();assert.equal(stale.main.hidden,false,'stale note ignored');
  const junk=harness({cfg:ON,sstore:{sr_si_done:'{not json'}});await junk.wait();assert.equal(junk.main.hidden,false,'bad note ignored');
});
test('guide pages: the card uses the name on the block when the page has no drug profile',async()=>{
  const h=harness({cfg:ON,guideName:'Ozempic'});await h.wait();assert.match(h.head.textContent,/Ozempic/);assert.equal(h.brandEls[0].textContent,'Ozempic');
  h.phone.value='8324567788';h.submit();assert.equal(new URLSearchParams(h.sent[0]).get('drug'),'Ozempic');
});

// ---- Campaign (UTM) attribution for waitlist signups
const extract=(file,start,end)=>{const t=fs.readFileSync(file,'utf8');const i=t.indexOf(start);assert(i>=0,`${file}: ${start}`);return t.slice(i,t.indexOf(end,i)+end.length);};
const pageSan=vm.runInNewContext(`(function(){${extract('assets/js/sms-interest.js','function sanitizeUtm(value)','\n  }')};return sanitizeUtm;})()`,{});
const gsSan=vm.runInNewContext(`(function(){${extract('scripts/Code.gs','function sanitizeUtm_(value)','\n}')};return sanitizeUtm_;})()`,{});
test('utm: the page and Apps Script sanitizers both produce the expected value for every case (same rules as the Worker)',()=>{
  // Golden table: also the contract for saverx-savings-watch/src/validate.js (its own tests cover the same rules).
  const T=[['facebook','facebook'],['Facebook','facebook'],[' paid_social ','paid_social'],['Spring Sale!! 2026','spring-sale-2026'],['ad_set-B','ad_set-b'],['',null],['   ',null],['!!!',null],
    ['x'.repeat(100),'x'.repeat(100)],['x'.repeat(101),null],['(415) 555-0100',null],['415-555-0100',null],['4155550100',null],['+1 415 555 0100',null],['call 415.555.0100 now',null],
    ['someone@example.com',null],['q4-2026-nov-20-v2','q4-2026-nov-20-v2'],['2026-11-20','2026-11-20'],['1234567890',null],['123456789','123456789'],['campaign%20one','campaign-20one'],
    [null,null],[undefined,null],[12345,null],[['a'],null]];
  for(const [input,want] of T){assert.equal(pageSan(input),want,`page: ${JSON.stringify(input)}`);assert.equal(gsSan(input)||null,want,`Apps Script: ${JSON.stringify(input)}`);}
});
const UTM_URL='?utm_source=Facebook&utm_medium=paid_social&utm_campaign=Nov-Test&utm_content=ad-a&utm_term=repatha';
const CONSENT_ON=JSON.stringify({analytics:true,advertising:false,personalization:false,version:2,timestamp:1}),CONSENT_OFF=JSON.stringify({analytics:false,advertising:false,personalization:false,version:2,timestamp:1});
const attrOf=h=>{const b=new URLSearchParams(h.sent[0]);return Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(k=>[k,b.get(k)]));};
const go=async(o,phone='8324567788')=>{const h=harness({cfg:ON,...o});await h.wait();h.phone.value=phone;h.submit();return h;};
test('attribution: sanitized UTMs (including content + term) ride along with the signup',async()=>{
  const h=await go({search:UTM_URL});
  assert.deepEqual(attrOf(h),{utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'nov-test',utm_content:'ad-a',utm_term:'repatha'});
  assert(!JSON.stringify([h.events,h.images]).includes('nov-test'),'campaign labels never go to analytics or beacons');
});
test('attribution: phone-like / email-like / overlong values are dropped on the page; the signup still goes through',async()=>{
  const h=await go({search:'?utm_source=4155550100&utm_campaign=a@b.com&utm_content='+'x'.repeat(101)+'&utm_medium=paid_social'});
  assert.equal(h.sent.length,1);assert.deepEqual(attrOf(h),{utm_source:'',utm_medium:'paid_social',utm_campaign:'',utm_content:'',utm_term:''});
});
test('attribution: the campaign is remembered across pages ONLY with analytics consent',async()=>{
  const on=harness({cfg:ON,search:UTM_URL,store:{saverx_consent:CONSENT_ON}});await on.wait();
  const saved=JSON.parse(on.store.sr_utm);assert.equal(saved.v.utm_campaign,'nov-test');assert(Date.now()-saved.t<5000);
  const off=harness({cfg:ON,search:UTM_URL,store:{saverx_consent:CONSENT_OFF}});await off.wait();assert.equal(off.store.sr_utm,undefined,'analytics declined: nothing stored');
  const none=harness({cfg:ON,search:UTM_URL});await none.wait();assert.equal(none.store.sr_utm,undefined,'no choice made yet: nothing stored');
  const later=await go({search:'',store:on.store});assert.equal(attrOf(later).utm_campaign,'nov-test','a later page with no UTMs still attributes to the ad click');
  const declined=await go({search:'',store:{sr_utm:on.store.sr_utm,saverx_consent:CONSENT_OFF}});assert.equal(attrOf(declined).utm_campaign,'','consent withdrawn: the remembered tag is ignored');
});
test('attribution: first-touch wins within 7 days; an expired or corrupt tag is replaced; fields stay independent',async()=>{
  const first=harness({cfg:ON,search:'?utm_source=facebook&utm_campaign=first-camp',store:{saverx_consent:CONSENT_ON}});await first.wait();
  const second=await go({search:'?utm_source=google&utm_campaign=second-camp&utm_content=ad-z',store:first.store});
  assert.equal(attrOf(second).utm_campaign,'first-camp','first touch kept');assert.equal(attrOf(second).utm_source,'facebook');
  assert.equal(JSON.parse(second.store.sr_utm).v.utm_campaign,'first-camp','stored tag not overwritten');
  const old=JSON.parse(first.store.sr_utm);old.t=Date.now()-8*86400000;
  const renewed=harness({cfg:ON,search:'?utm_campaign=new-camp',store:{saverx_consent:CONSENT_ON,sr_utm:JSON.stringify(old)}});await renewed.wait();
  assert.equal(JSON.parse(renewed.store.sr_utm).v.utm_campaign,'new-camp','expired first touch replaced by the new campaign');
  const corrupt=await go({search:'?utm_campaign=ok-camp',store:{saverx_consent:CONSENT_ON,sr_utm:'{nope'}});assert.equal(attrOf(corrupt).utm_campaign,'ok-camp');
  const tampered=await go({search:'',store:{saverx_consent:CONSENT_ON,sr_utm:JSON.stringify({t:Date.now(),v:{utm_campaign:'4155550100',utm_source:'fine'}})}});
  assert.equal(attrOf(tampered).utm_campaign,'','a tampered stored value is re-sanitized');assert.equal(attrOf(tampered).utm_source,'fine');
});
test('attribution: no UTMs anywhere means empty fields and nothing stored',async()=>{
  const h=await go({search:'',store:{saverx_consent:CONSENT_ON}});assert.deepEqual(attrOf(h),{utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',utm_term:''});assert.equal(h.store.sr_utm,undefined);
});

test('attribution: first visit — the campaign is remembered the moment the cookie banner is ACCEPTED (watching stops once answered); never if declined',async()=>{
  const h=harness({cfg:ON,search:UTM_URL});await h.wait();
  assert.equal(h.intervals.length,1,'watching for the banner answer');assert.equal(h.store.sr_utm,undefined,'nothing stored while unanswered');
  h.intervals[0]();assert.equal(h.store.sr_utm,undefined,'still unanswered: still nothing');assert.equal(h.cleared.length,0);
  h.store.saverx_consent=CONSENT_ON;h.intervals[0]();assert.equal(JSON.parse(h.store.sr_utm).v.utm_campaign,'nov-test','accepted: remembered');assert.equal(h.cleared.length,1,'watch stopped');
  const d=harness({cfg:ON,search:UTM_URL});await d.wait();d.store.saverx_consent=CONSENT_OFF;d.intervals[0]();assert.equal(d.store.sr_utm,undefined,'declined: nothing stored');assert.equal(d.cleared.length,1);
  const noUtm=harness({cfg:ON,search:''});await noUtm.wait();assert.equal(noUtm.intervals.length,0,'no UTMs in the URL: no watching');
  const answered=harness({cfg:ON,search:UTM_URL,store:{saverx_consent:CONSENT_OFF}});await answered.wait();assert.equal(answered.intervals.length,0,'already answered: no watching');
  const long=harness({cfg:ON,search:UTM_URL});await long.wait();for(let i=0;i<121;i++)long.intervals[0]();assert.equal(long.cleared.length>=1,true,'gives up after ~2 minutes');
});

// ---- Top-of-page entry on drug pages
test('top link: a text-alert link is inserted above the "On this page" nav, jumps to the card, tracks the click, and focuses the phone field',async()=>{
  const h=harness({cfg:ON});await h.wait();
  assert.equal(h.inserted.length,1);assert.equal(h.inserted[0].ref,h.jump,'placed right before .drug-jump');
  const p=h.inserted[0].n;assert.equal(p.className,'si-top-link');const a=p.children[0];assert.equal(a.textContent,'Get text alerts for Repatha ↓');assert.equal(a.href,'#sms-interest');
  a.listeners.click();assert(h.events.some(e=>e[1]==='sms_toplink_click'&&e[2].drug_slug==='repatha'));h.timers[h.timers.length-1]();assert.equal(h.phone.focused,true);
  assert(!JSON.stringify(h.events).includes('8324567788'));
});
test('top link: not on the homepage band, not when the page has no nav (guide pages), not after signing up, not when the switch is off',async()=>{
  const home=harness({cfg:ON,home:true});await home.wait();assert.equal(home.inserted.length,0);
  const guide=harness({cfg:ON,guideName:'Ozempic',noJump:true});await guide.wait();assert.equal(guide.inserted.length,0);assert.equal(guide.block.hidden,false,'card itself still works without the nav');
  const arrived=harness({cfg:ON,sstore:{sr_si_done:JSON.stringify({slug:'repatha',name:'Repatha',t:Date.now()})}});await arrived.wait();assert.equal(arrived.inserted.length,0,'already on the list: no prompt');
  const off=harness({cfg:{interest:false,live:false}});await off.wait();assert.equal(off.inserted.length,0);
});

// ---- The text-alert bar must never cover the footer (cookie settings / privacy links live there)
test('bar: steps aside while the footer is on screen, comes back when it leaves, and never shows over the footer',async()=>{
  let top=99999;const h=harness({cfg:ON,footerTop:99999});await h.wait();
  // swap in a movable footer position
  const f=h.doc.querySelector('footer');f.getBoundingClientRect=()=>({top});
  h.win.scrollY=1600;h.wl.scroll();assert.equal(h.bar.hidden,false,'mid-page: shown');
  top=300;h.wl.scroll();assert.equal(h.bar.hidden,true,'footer on screen (top < viewport height): hidden');
  top=99999;h.wl.scroll();assert.equal(h.bar.hidden,false,'footer left the screen: back');
  top=300;h.wl.scroll();assert.equal(h.bar.hidden,true);h.timers.forEach(t=>t());assert.equal(h.bar.hidden,true,'the delayed timer also respects the footer');
  top=99999;h.x.listeners.click();top=300;h.wl.scroll();top=99999;h.wl.scroll();assert.equal(h.bar.hidden,true,'a dismissed bar stays dismissed');
  const done=harness({cfg:ON,footerTop:99999});await done.wait();done.phone.value='8324567788';done.submit();const d=done.doc.querySelector('footer');d.getBoundingClientRect=()=>({top:300});d.getBoundingClientRect=()=>({top:99999});done.wl.scroll();assert.equal(done.bar.hidden,true,'after signing up the bar never returns');
});

// ---- GA4 conversion hand-off (Google drops a pending batch when the page changes)
test('home signup, unlisted drug: no redirect, so the GA conversion is sent right here (slug "custom", no medication text)',async()=>{
  const h=harness({cfg:ON,home:true});await h.wait();h.drugIn.value='Some New Drug';h.phone.value='8324567788';h.submit();
  const e=h.events.find(x=>x[1]==='sms_waitlist_signup');assert(e);assert.deepEqual(JSON.parse(JSON.stringify(e[2])),{drug_slug:'custom',variant:'home'});assert(!JSON.stringify(h.events).toLowerCase().includes('some new drug'));
});
test('arriving from the homepage signup: the drug page sends the GA conversion once (variant "home"); a reload or an older note does not re-send it',async()=>{
  const note=ev=>JSON.stringify({slug:'repatha',name:'Repatha',t:Date.now(),...(ev?{ev:1}:{})});
  const a=harness({cfg:ON,sstore:{sr_si_done:note(true)}});await a.wait();const ev=a.events.filter(x=>x[1]==='sms_waitlist_signup');
  assert.equal(ev.length,1);assert.deepEqual(JSON.parse(JSON.stringify(ev[0][2])),{drug_slug:'repatha',variant:'home'});assert.equal(a.sstore.sr_si_done,undefined,'single-use');
  const again=harness({cfg:ON,sstore:a.sstore});await again.wait();assert.equal(again.events.filter(x=>x[1]==='sms_waitlist_signup').length,0,'reload: nothing re-sent');
  const old=harness({cfg:ON,sstore:{sr_si_done:note(false)}});await old.wait();assert.equal(old.events.filter(x=>x[1]==='sms_waitlist_signup').length,0,'note without the flag: no event');
  assert(!JSON.stringify(a.events).includes('8324567788'));
});
test('Apps Script click beacon uses a keepalive request so it survives the homepage redirect (falls back to an image)',()=>{
  const src=fs.readFileSync('assets/js/sms-interest.js','utf8');assert.match(src,/fetch\(url, \{ mode: "no-cors", keepalive: true \}\)/);assert.match(src,/new Image\(\)\.src = url/);
});
