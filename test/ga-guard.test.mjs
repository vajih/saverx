import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync('assets/js/consent.js','utf8');
const m=src.match(/\/\/ --- ga-guard:start[^\n]*\n([\s\S]*?)\/\/ --- ga-guard:end ---/);assert(m,'guard block present');
const GA='ga-disable-G-FCKENS1BWB';
function run({host='saverx.ai',search='',store={},storageThrows=false}={}){
  const ls=storageThrows?{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}}
    :{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  const window={location:{hostname:host,search},localStorage:ls};
  vm.runInNewContext(m[1],{window,URLSearchParams});return {window,store};
}
test('analytics is enabled only on saverx.ai (apex and www)',()=>{
  assert.equal(run({host:'saverx.ai'}).window[GA],undefined);assert.equal(run({host:'www.saverx.ai'}).window[GA],undefined);
  for(const host of ['localhost','127.0.0.1','saverx.pages.dev','abc123.saverx.pages.dev','staging.saverx.ai.evil.com','notsaverx.ai','saverx.ai.example.com','vajih.github.io','','file'])assert.equal(run({host}).window[GA],true,`disabled on "${host}"`);
});
test('owner opt-out: ?no_analytics=1 disables now and on later visits; ?no_analytics=0 turns it back on',()=>{
  const a=run({search:'?no_analytics=1'});assert.equal(a.window[GA],true);assert.equal(a.store.sr_no_ga,'1');
  const later=run({search:'',store:a.store});assert.equal(later.window[GA],true,'stays off on a later page');
  const back=run({search:'?no_analytics=0',store:a.store});assert.equal(back.window[GA],undefined);assert.equal(back.store.sr_no_ga,undefined);
  assert.equal(run({search:'?no_analytics=yes'}).window[GA],undefined,'only 1 / 0 are recognized');assert.equal(run({search:'?utm_source=x&no_analytics=1&y=2'}).window[GA],true);
});
test('the guard can never break the page: blocked storage is tolerated (analytics stays on at saverx.ai, off elsewhere)',()=>{
  assert.equal(run({storageThrows:true}).window[GA],undefined);assert.equal(run({host:'localhost',storageThrows:true}).window[GA],true);
});
test('the guard runs before the consent UI and before GTM/gtag can load (consent.js is the first script in the head of every page)',()=>{
  assert(src.indexOf('ga-guard:start')<src.indexOf("var STORAGE_KEY = 'saverx_consent'"));
  for(const f of ['index.html','drugs/repatha/index.html','drugs/ozempic/index.html']){const h=fs.readFileSync(f,'utf8');assert(h.indexOf('consent.js')>=0&&h.indexOf('consent.js')<h.indexOf('googletagmanager.com'),`${f}: consent.js before GTM/gtag`);}
});
