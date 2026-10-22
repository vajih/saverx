/* Conversion aids: no quote/coverage/email values enter analytics or storage. */
(() => {
 const page=document.querySelector('.drug-conversion-v2');if(!page)return;
 const $=s=>page.querySelector(s);
 const ready=$('#enroll-help'),payment=$('#payment-options'),email=$('#footerEmail');
 const sticky=$('[data-drug-sticky]'),prompt=$('#drug-save-prompt');
 const started=Date.now();let chosen=false,stickyDismissed=false,promptShown=false,submitted=false,queued=false,returnFocus=null;
 const slug=location.pathname.split('/')[2];
 if(slug)for(const a of page.querySelectorAll('[data-guided-placement]'))a.href='/get-help/?drug='+encodeURIComponent(slug);
 const submit=$('#footerSubmit');if(submit)submit.textContent='Email me & open program ↗';
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function obstructed(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"][aria-hidden="false"]')).some(el=>el!==prompt&&el.getClientRects().length);}
 function update(){
  queued=false;
  const r=ready.getBoundingClientRect(),p=payment.getBoundingClientRect();
  const inReady=r.top<innerHeight&&r.bottom>0;
  const footer=document.querySelector('.relief-footer')?.getBoundingClientRect();
  sticky.hidden=!chosen||stickyDismissed||submitted||p.top>80||inReady||!!prompt.open||obstructed()||!!(footer&&footer.top<innerHeight);
  // Mobile departure alternative: one non-modal reminder near the end of reading.
  if(matchMedia('(max-width: 800px)').matches&&Date.now()-started>45000&&chosen&&!submitted&&!promptShown){
   const rect=page.querySelector('.drug-main').getBoundingClientRect();
   if(rect.bottom<innerHeight*1.8)showPrompt(true);
  }
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 function showPrompt(mobile=false){
  if(promptShown||submitted||!chosen||obstructed()||Date.now()-started<20000||email.value.trim()||document.activeElement?.matches('input,textarea,select'))return;
  promptShown=true;returnFocus=document.activeElement;
  if(mobile){prompt.setAttribute('data-mobile','');prompt.show();}else{prompt.removeAttribute('data-mobile');prompt.showModal();}
  sticky.hidden=true;
 }
 function dismiss(){prompt.close();returnFocus?.focus?.({preventScroll:true});schedule();}
 for(const button of page.querySelectorAll('[data-save-dismiss]'))button.addEventListener('click',dismiss);
 prompt.addEventListener('close',schedule);
 $('[data-save-email]').addEventListener('click',()=>{prompt.close();$('#save-options').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});email.focus({preventScroll:true});schedule();});
 $('[data-sticky-close]').addEventListener('click',()=>{stickyDismissed=true;sticky.hidden=true;});
 window.addEventListener('saverx:coverage-chosen',()=>{chosen=true;schedule();});
 document.addEventListener('scroll',schedule,{capture:true,passive:true});
 window.addEventListener('resize',schedule);
 document.addEventListener('mouseleave',event=>{if(event.clientY<=0&&matchMedia('(hover:hover) and (min-width: 801px)').matches)showPrompt();});
 $('#footerForm').addEventListener('submit',()=>{submitted=true;sticky.hidden=true;prompt.close();});
 // Placement-only events use the site's existing consent-governed analytics queue.
 for(const anchor of page.querySelectorAll('[data-guided-placement]'))anchor.addEventListener('click',()=>{
  if(typeof window.gtag==='function')window.gtag('event','guided_enrollment_click',{placement:anchor.dataset.guidedPlacement,drug_slug:location.pathname.split('/')[2]||''});
 });
 update();
})();
