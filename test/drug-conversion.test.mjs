import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('assets/js/drug-conversion.js','utf8');
function harness({typing=false,mobile=false}={}){
 let time=0;const events={},docEvents={};
 function element(){return {hidden:true,open:false,value:'',dataset:{},listeners:{},addEventListener(n,fn){this.listeners[n]=fn;},getBoundingClientRect(){return {top:-200,bottom:-100};},setAttribute(n,v){this[n]=v;},removeAttribute(n){delete this[n];},getClientRects(){return [];},focus(){},scrollIntoView(){},close(){this.open=false;},show(){this.open=true;this.mode='nonmodal';},showModal(){this.open=true;this.mode='modal';}};}
 const email=element();email.value=typing?'someone@example.test':'';
 const map=Object.fromEntries(['#enroll-help','#payment-options','#footerEmail','[data-drug-sticky]','#drug-save-prompt','#footerSubmit','[data-save-email]','[data-sticky-close]','#footerForm','#save-options','.drug-main'].map(s=>[s,s==='#footerEmail'?email:element()]));
 const dismiss=element();const page={querySelector:s=>map[s],querySelectorAll:s=>s==='[data-save-dismiss]'?[dismiss]:[]};
 const document={activeElement:{matches:()=>false,focus(){}},querySelector:s=>s==='.drug-conversion-v2'?page:null,querySelectorAll:()=>[],addEventListener:(n,fn)=>docEvents[n]=fn};
 const context=vm.createContext({document,window:{addEventListener:(n,fn)=>events[n]=fn},Date:{now:()=>time},requestAnimationFrame:fn=>{fn();return 1;},matchMedia:q=>({matches:q.includes('prefers-reduced-motion')?false:q.includes('hover')?!mobile:mobile}),innerHeight:900,location:{pathname:'/drugs/repatha/'}});
 vm.runInContext(source,context);
 return {map,events,docEvents,dismiss,setTime:t=>time=t};
}
test('desktop departure reminder needs coverage and engagement, appears once, and dismisses',()=>{const h=harness();h.setTime(25000);h.docEvents.mouseleave({clientY:-1});assert.equal(h.map['#drug-save-prompt'].open,false);h.events['saverx:coverage-chosen']();h.docEvents.mouseleave({clientY:-1});assert.equal(h.map['#drug-save-prompt'].mode,'modal');h.dismiss.listeners.click();assert.equal(h.map['#drug-save-prompt'].open,false);h.docEvents.mouseleave({clientY:-1});assert.equal(h.map['#drug-save-prompt'].open,false);});
test('email entry suppresses departure prompt',()=>{const h=harness({typing:true});h.setTime(25000);h.events['saverx:coverage-chosen']();h.docEvents.mouseleave({clientY:-1});assert.equal(h.map['#drug-save-prompt'].open,false);});
test('mobile reminder is delayed and nonmodal',()=>{const h=harness({mobile:true});h.events['saverx:coverage-chosen']();h.setTime(50000);h.docEvents.scroll();assert.equal(h.map['#drug-save-prompt'].mode,'nonmodal');});
test('sticky reminder can be dismissed without reappearing while scrolling',()=>{const h=harness();h.events['saverx:coverage-chosen']();assert.equal(h.map['[data-drug-sticky]'].hidden,false);h.map['[data-sticky-close]'].listeners.click();h.docEvents.scroll();assert.equal(h.map['[data-drug-sticky]'].hidden,true);});
