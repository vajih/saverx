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
 root.SaveRxDrugOptions={amount,difference,safeUrl,fresh,offer};
 if(typeof document==='undefined')return;
 const page=document.querySelector('.drug-options-page');if(!page)return;
 const profile=JSON.parse(document.getElementById('drug-page-profile')?.textContent||'{}');
 let record={},coverage=null,loaded=!!window.__saverxDrugRecord;
 const $=s=>document.querySelector(s);
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
 const set=(selector,value)=>{const el=$(selector);if(el)el.textContent=value;};
 function link(selector,url,label){const el=$(selector);if(!el)return;const safe=safeUrl(url);if(safe){el.href=safe;el.target='_blank';el.rel=el.rel.includes('sponsored')?'noopener sponsored':'noopener';el.removeAttribute('aria-disabled');el.removeAttribute('tabindex');}else{el.href='#program-sources';el.setAttribute('aria-disabled','true');}if(label)el.textContent=label;}
 function render(){
  const o=offer(record,profile),name=profile.brand||record.brand||'this medication';
  const generic=profile.generic||record.generic,manufacturer=profile.manufacturer||record.manufacturer;
  set('[data-drug-identity]',[generic,manufacturer].filter(Boolean).join(' · ')||'Prescription medication');
  set('[data-drug-copay]',o.price===null?'Check current offer':money(o.price));
  const prefix=$('[data-drug-price-prefix]');if(prefix)prefix.hidden=o.price===null;
  const secondary=$('[data-cash-secondary]');if(secondary)secondary.hidden=!profile.cash;
  const priceEl=$('[data-drug-copay]');priceEl?.parentElement.classList.toggle('drug-price-text',o.price===null);
  set('[data-drug-supply]',profile.copay?.supply?`For an eligible ${profile.copay.supply}`:'Eligible supply and program terms vary');
  if(profile.copay?.eligibility)set('[data-drug-eligibility]',profile.copay.eligibility);
  set('[data-drug-price-source]',profile.checkedAt?`Manufacturer source checked ${profile.checkedAt}.${o.price===null?' Recheck the current offer.':' Program limits apply.'}`:'SaveRx feed lists this offer when available. Confirm current price and terms on the official site.');
  link('[data-program-link="self"]',o.url,'Or enroll yourself on the official site ↗');
  link('[data-program-link="copay"]',o.url,o.url?'Review official program ↗':'Program link unavailable');
  link('[data-program-link="source"]',o.url,o.url?'Official program website ↗':'See payment options ↑');
  if(profile.assistance){set('[data-drug-assistance]',profile.assistance.text);link('[data-program-link="assistance"]',profile.assistance.url,`Check ${profile.assistance.name} ↗`);}
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
 }
 const guidance={all:'Start with the option that matches your coverage. More than one route may be worth checking.',private:'Start with the manufacturer co-pay program. Your plan’s coverage and the program’s limits still determine eligibility and cost.',government:'Commercial co-pay cards generally exclude government coverage. Ask your plan about your benefits; Medicare patients can also check Extra Help. Separate assistance and cash-pay programs have their own rules.',cash:'Compare cash quotes and check assistance criteria. A commercial co-pay card typically requires private prescription insurance.',unsure:'Check your prescription insurance card or ask your pharmacy which plan is being billed. Until then, browse the options without assuming eligibility.'};
 for(const button of document.querySelectorAll('[data-coverage]'))button.addEventListener('click',()=>{
  coverage=button.dataset.coverage;
  const results=$('[data-payment-results]');if(results)results.hidden=false;
  window.dispatchEvent(new CustomEvent('saverx:coverage-chosen'));
  for(const b of document.querySelectorAll('[data-coverage]'))b.setAttribute('aria-pressed',String(b===button));
  $('[data-option="copay"]').hidden=['government','cash'].includes(coverage);
  set('#coverage-guidance',guidance[coverage]);
  const gov=$('[data-government-resources]');if(gov)gov.hidden=coverage!=='government';
  const target=$('#your-target');if(['government','cash'].includes(coverage)&&target.dataset.suggested){target.value='';delete target.dataset.suggested;set('[data-calculator-note]','Enter a confirmed price for the same supply. The commercial co-pay minimum does not apply to this selected coverage.');set('#drug-savings-result','Add both prices to see the difference.');}
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
