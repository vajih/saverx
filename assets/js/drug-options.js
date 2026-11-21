/* Coverage selection and comparison run locally. No selections/quotes are transmitted. */
((root)=>{
 'use strict';
 function amount(value){
  if(typeof value==='boolean'||value==null||String(value).trim()==='')return null;
  const n=Number(String(value).replace(/^\$/,'').replace(/,/g,''));
  return Number.isFinite(n)&&n>=0?n:null;
 }
 function difference(quote,target){const a=amount(quote),b=amount(target);return a===null||b===null?null:a-b;}
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function fresh(profile,now=Date.now()){
  const checked=Date.parse(profile?.checkedAt+'T00:00:00Z');
  return Number.isFinite(checked)&&now>=checked&&now-checked<=(profile.copay?.maxAgeDays||30)*86400000;
 }
 function offer(record,profile,now=Date.now()){
  const curated=!!profile?.copay;
  // A stale curated price must not silently fall back to an older feed price.
  const price=curated?(fresh(profile,now)?amount(profile.copay.price):null):amount(record?.copay_price);
  const url=safeUrl(profile?.copay?.url||record?.manufacturerUrl);
  return {price:url?price:null,url,curated};
 }

 const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
 const txt=v=>typeof v==='string'&&v.trim()?v.trim():'';
 const list=v=>Array.isArray(v)?v.map(txt).filter(Boolean):[];
 const link2=l=>{const url=safeUrl(l?.url),label=txt(l?.label);return url&&label?{label,url}:null;};
 const day=v=>{const t=Date.parse(v+'T00:00:00Z');return Number.isFinite(t)?t:null;};
 /**
  * Pure view-model for a manufacturer benefit program (profile.program). Returns null unless there is a valid cap, a benefit
  * period and an https call-to-action, so an incomplete record can never render a half-verified claim.
  * Every number comes from the profile; nothing here infers a renewal, a lookback or a coverage rule. Only an explicit capStatus "verified" is shown as verified; anything else gets the cautious source-dated wording.
  */
 function programView(profile,now=Date.now()){
  const p=profile?.program;if(!p)return null;
  const cap=amount(p.cap),period=txt(p.period),cta=link2(p.cta);
  if(cap===null||cap<=0||!period||!cta)return null;
  const checked=day(profile.checkedAt),f=p.followup;
  return {name:txt(p.name),cap,capText:usd(cap),period,
   capStatus:p.capStatus==='verified'?'verified':'source-dated',sourceNote:txt(p.sourceNote)||(p.capStatus==='verified'?'':'Confirm the current maximum with the program before relying on it.'),periodNote:txt(p.periodNote),
   insurance:txt(p.insurance),government:txt(p.government),patientPays:txt(p.patientPays),
   covers:list(p.covers),notCovered:list(p.notCovered),conditions:list(p.conditions),note:txt(p.note),
   cta,secondaryCta:link2(p.secondaryCta),terms:link2(p.terms),
   checkedAt:checked===null?'':String(profile.checkedAt),stale:checked===null||now-checked>120*86400000,
   followup:f&&txt(f.heading)?{heading:txt(f.heading),paragraphs:list(f.paragraphs),readyHeading:txt(f.readyHeading),ready:list(f.ready),readyIsGuidance:!!f.readyIsGuidance,contactNote:txt(f.contactNote),contact:link2(f.contact)}:null};
 }
 root.SaveRxDrugOptions={amount,difference,safeUrl,fresh,offer,programView};
 if(typeof document==='undefined')return;
 const page=document.querySelector('.drug-options-page');if(!page)return;
 const profile=JSON.parse(document.getElementById('drug-page-profile')?.textContent||'{}');
 let record={},coverage=null,loaded=!!window.__saverxDrugRecord;
 const $=s=>document.querySelector(s);
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
 const set=(selector,value)=>{const el=$(selector);if(el)el.textContent=value;};
 function link(selector,url,label){const el=$(selector);if(!el)return;const safe=safeUrl(url);if(safe){el.href=safe;el.target='_blank';el.rel=el.rel.includes('sponsored')?'noopener sponsored':'noopener';el.removeAttribute('aria-disabled');el.removeAttribute('tabindex');}else{el.href='#program-sources';el.setAttribute('aria-disabled','true');}if(label)el.textContent=label;}

 // ---- Manufacturer benefit program (profile.program): summary-row figures, benefit section, "already received" section
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const slugNow=()=>location.pathname.split('/')[2]||'';
 function official(a,placement,utm){
  if(utm){try{a.href=root.SaveRxTrack?.withUtm?.(a.href,slugNow()+'-program')||a.href;}catch{}}   // generic campaign id only (docs/UTM_TRACKING_RULES.md)
  if(a.dataset.pgTracked)return;a.dataset.pgTracked='1';
  a.addEventListener('click',()=>{try{root.__trackOfficialClick?.(slugNow(),placement);}catch{}});
 }
 function ext(label,url,cls){const a=el('a',cls||'drug-text-link',label+' ↗');a.href=url;a.target='_blank';a.rel='noopener';return a;}
 function ul(items){const u=el('ul','drug-program-list');for(const i of items)u.append(el('li',null,i));return u;}
 function fact(term,node,cls){const d=el('div',cls||null);d.append(el('dt',null,term));const dd=el('dd');if(typeof node==='string')dd.textContent=node;else dd.append(node);d.append(dd);return d;}
 function buildProgram(v,brand){
  const sec=el('section','drug-section drug-program');sec.id='program-benefit';sec.setAttribute('aria-labelledby','pb-title');
  const head=el('div','drug-section-heading');const hd=el('div');hd.append(el('p','drug-eyebrow','MANUFACTURER CO-PAY PROGRAM'));const h2=el('h2',null,`${brand}: what the co-pay program covers`);h2.id='pb-title';hd.append(h2);head.append(hd);sec.append(head);
  const grid=el('div','drug-program-grid'),main=el('div','drug-program-main');
  const amt=el('p','drug-program-amount');amt.append(el('span','drug-program-up','Up to'),el('strong',null,v.capText),el('span',null,v.period));main.append(amt);
  if(v.capStatus==='source-dated'&&v.sourceNote){const f=el('p','drug-program-flag',v.sourceNote);f.setAttribute('role','note');main.append(f);}
  if(v.periodNote)main.append(el('p','drug-program-note',v.periodNote));
  if(v.note)main.append(el('p','drug-program-note',v.note));
  const dl=el('dl','drug-program-facts');
  if(v.insurance)dl.append(fact('Who can use it',v.insurance));
  if(v.government)dl.append(fact('Not available with',v.government,'drug-program-warn'));
  if(v.patientPays)dl.append(fact('What you pay',v.patientPays));
  if(v.covers.length)dl.append(fact('What it covers',ul(v.covers)));
  if(v.notCovered.length)dl.append(fact('What it does not cover',ul(v.notCovered)));
  if(v.conditions.length)dl.append(fact('Good to know',ul(v.conditions)));
  main.append(dl);grid.append(main);
  // Government-plan exclusion and coverage rules come first in the DOM; the action column follows, so they are read before the CTA.
  const act=el('aside','drug-program-action');act.setAttribute('aria-label','Next step');
  const cta=el('a','drug-button drug-program-cta',v.cta.label+' ↗');cta.href=v.cta.url;cta.target='_blank';cta.rel='noopener';cta.setAttribute('data-program-cta','');official(cta,'program_benefit',true);act.append(cta);
  if(v.secondaryCta){const a2=ext(v.secondaryCta.label,v.secondaryCta.url,'drug-text-link drug-program-secondary');official(a2,'program_benefit_apply',true);act.append(a2);}
  act.append(el('p','drug-small','Eligibility checks and claim submissions happen on the official manufacturer site. SaveRx is independent and never submits them for you.'));
  const meta=el('p','drug-small drug-program-meta');
  if(v.terms){meta.append('Official terms: ',ext(v.terms.label,v.terms.url));meta.append(' · ');}
  const when=v.checkedAt?new Date(v.checkedAt+'T00:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):'';
  meta.append(when?`Last verified ${when}`:'Verification date unavailable');act.append(meta);
  if(v.stale)act.append(el('p','drug-program-flag','These terms were last checked more than four months ago. Confirm the current terms with the program.'));
  grid.append(act);sec.append(grid);return sec;
 }
 function buildFollowup(v,brand){
  const f=v.followup;if(!f)return null;
  const sec=el('section','drug-section drug-program-followup');sec.id='program-followup';sec.setAttribute('aria-labelledby','pf-title');
  const h2=el('h2',null,f.heading);h2.id='pf-title';sec.append(h2);
  for(const t of f.paragraphs)sec.append(el('p',null,t));
  if(f.ready.length){sec.append(el('h3',null,f.readyHeading||'What to have ready'));sec.append(ul(f.ready));}
  if(f.contactNote)sec.append(el('p','drug-small',f.contactNote));
  if(f.contact){const a=ext(f.contact.label,f.contact.url);official(a,'program_followup',false);sec.append(a);}
  return sec;
 }
 let programBuilt=false;
 function renderProgram(){
  const v=programView(profile);if(!v)return;
  const name=profile.brand||record.brand||'this medication';
  // The private-insurance summary row states the verified maximum instead of a per-fill price.
  set('[data-drug-copay]','Up to '+v.capText);const pre=$('[data-drug-price-prefix]');if(pre)pre.hidden=true;
  const pe=$('[data-drug-copay]');pe?.parentElement.classList.remove('drug-price-text');
  set('[data-drug-supply]',v.period);
  set('[data-drug-price-source]',`Program maximum from the manufacturer’s terms${v.checkedAt?`, checked ${v.checkedAt}`:''}. Your actual assistance depends on eligible charges.`);
  const row=$('[data-program-link="copay"]');if(row){row.textContent=v.cta.label+' ↗';official(row,'summary_row',true);}
  if(programBuilt)return;programBuilt=true;
  const host=$('#payment-options');if(!host)return;
  const a=buildProgram(v,name);host.insertAdjacentElement('afterend',a);
  const b=buildFollowup(v,name);if(b)a.insertAdjacentElement('afterend',b);
 }
 function render(){
  const o=offer(record,profile),name=profile.brand||record.brand||'this medication';
  const generic=profile.generic||record.generic,manufacturer=profile.manufacturer||record.manufacturer;
  set('[data-drug-identity]',[generic,manufacturer].filter(Boolean).join(' · ')||'Prescription medication');
  set('[data-drug-copay]',o.price===null?'Check current offer':money(o.price));
  const prefix=$('[data-drug-price-prefix]');if(prefix)prefix.hidden=o.price===null;
  const secondary=$('[data-cash-secondary]');if(secondary)secondary.hidden=!profile.cash;
  set('[data-summary-source]',profile.checkedAt?`Manufacturer sources checked ${profile.checkedAt}. Confirm current terms; your actual cost depends on eligibility, coverage, and supply.`:'Program minimums are not your confirmed price. Confirm current terms; your actual cost depends on eligibility, coverage, and supply.');
  const priceEl=$('[data-drug-copay]');priceEl?.parentElement.classList.toggle('drug-price-text',o.price===null);
  set('[data-drug-supply]',profile.copay?.supply?`For an eligible ${profile.copay.supply}`:'Eligible supply and program terms vary');
  if(profile.copay?.eligibility)set('[data-drug-eligibility]',profile.copay.eligibility);
  set('[data-drug-price-source]',profile.checkedAt?`Manufacturer source checked ${profile.checkedAt}.${o.price===null?' Recheck the current offer.':' Program limits apply.'}`:'SaveRx feed lists this offer when available. Confirm current price and terms on the official site.');
  link('[data-program-link="self"]',o.url,'Or enroll yourself on the official site ↗');
  link('[data-program-link="copay"]',o.url,o.url?'Review official program ↗':'Program link unavailable');
  link('[data-program-link="source"]',o.url,o.url?'Official program website ↗':'See payment options ↑');
  if(profile.assistance){link('[data-government-assistance-link]',profile.assistance.url,'Check assistance eligibility ↗');set('[data-drug-assistance]',profile.assistance.text);link('[data-program-link="assistance"]',profile.assistance.url,`Check ${profile.assistance.name} ↗`);}
  const cashLink=$('[data-program-link="cash"]');if(cashLink)cashLink.hidden=!profile.cash;
  if(profile.cash){set('[data-drug-cash]',profile.cash.text);link('[data-program-link="cash"]',profile.cash.url,`Review ${profile.cash.name} ↗`);set('[data-drug-cash-note]','Separate manufacturer cash-pay option. Confirm the price and terms before using it.');}
  const desc=profile.about?.text||record.description;
  if(desc)set('#rx-about-desc',desc);
  for(const [id,value] of [['rx-about-class',profile.about?.class||record.drug_class],['rx-about-indication',record.indication]]){const el=document.getElementById(id);if(el){el.hidden=!value;if(value)el.textContent=value;}}
  if(profile.about?.url){link('[data-drug-about-link]',profile.about.url,'Official drug & safety information ↗');link('[data-full-drug-info]',profile.about.url,'Official drug & safety information ↗');}
  if(profile.sources){const box=$('[data-drug-sources]');box.replaceChildren();const note=document.createElement('p');note.textContent=`Manufacturer sources checked ${profile.checkedAt}. Offers may change; recheck before using a program.`;box.append(note);for(const source of profile.sources){if(!safeUrl(source.url))continue;const a=document.createElement('a');a.className='drug-text-link';a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.label+' ↗';box.append(a);}}
  const status=$('.drug-source-status');if(status){status.hidden=!!o.url;if(!o.url)status.textContent=loaded?'The manufacturer program link is unavailable. You can still explore assistance resources, compare pharmacy prices, or try again later. No price is confirmed.':'Loading program details. No personal price is confirmed.';}
  // No automatic calculation; the visitor explicitly compares matching supply quotes.
  const target=$('#your-target');if(o.price!==null&&!target.dataset.edited&&coverage==='private'){target.value=o.price;target.dataset.suggested='true';set('[data-calculator-note]',`The manufacturer program minimum is prefilled as an illustration${profile.copay?.supply?' for a '+profile.copay.supply:''}. Confirm eligibility and use the same supply for both prices.`);}
 renderProgram();
 }
 // All three summaries stay visible. Expansion only supplies optional next steps.
 for(const row of document.querySelectorAll('[data-payment-row]'))row.addEventListener('toggle',()=>{
  if(!row.open)return;
  coverage=row.dataset.paymentRow;
  window.dispatchEvent(new CustomEvent('saverx:coverage-chosen'));
  const target=$('#your-target');
  if(coverage!=='private'&&target.dataset.suggested){target.value='';delete target.dataset.suggested;set('[data-calculator-note]','Enter a price for the same supply. A commercial co-pay minimum does not apply to government or cash-pay routes.');set('#drug-savings-result','Add both prices to see the difference.');}
  render();
 });
 $('#your-target').addEventListener('input',e=>{e.target.dataset.edited='true';delete e.target.dataset.suggested;set('[data-calculator-note]','Compare prices for the same supply. Confirm any program eligibility before relying on a price.');set('#drug-savings-result','Compare again to update the difference.');});
 $('#your-quote').addEventListener('input',()=>set('#drug-savings-result','Compare again to update the difference.'));
 $('#drug-savings-calculator').addEventListener('submit',event=>{event.preventDefault();const delta=difference($('#your-quote').value,$('#your-target').value);if(delta===null){set('#drug-savings-result','Enter two valid, non-negative prices for the same supply.');return;}set('#drug-savings-result',delta>0?`${money(delta)} less for the same supply, if you qualify for the compared price.`:delta===0?'These two prices are the same for this supply.':`The compared price is ${money(-delta)} higher for this supply. Your current quote is lower.`);});
 // Capture blocks a placeholder link before legacy accordion handlers can run.
 page.addEventListener('click',event=>{const a=event.target.closest('a[aria-disabled="true"]');if(a){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 window.addEventListener('saverx:drug-data',event=>{record=event.detail||{};loaded=true;render();});
 record=window.__saverxDrugRecord||{};render();
})(typeof window==='undefined'?globalThis:window);
