import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../assets/js/drug-data.js',import.meta.url),'utf8');
function setup(fetch) {
  const context = {window:{},fetch,AbortController,setTimeout,clearTimeout,Map};
  vm.runInNewContext(source,context);
  return context.window.SaveRxDrugData;
}
const response = data => ({ok:true,json:async()=>data});
test('missing prices stay unknown, while a genuine zero remains zero',()=>{
  const data=setup(()=>{});
  for(const value of [null,undefined,'','  ']) assert.ok(Number.isNaN(data.amount(value)));
  assert.equal(data.amount(0),0); assert.equal(data.amount('15'),15);
});
test('per-drug response keeps the existing program and all fields',async()=>{
  const item={brand:'Repatha',copay_price:15,manufacturerUrl:'https://example.com/program',bullets:'A|B'};
  const data=setup(async()=>response({item}));
  assert.equal(await data.load('https://api.example','repatha'),item);
});
test('featured fallback maps the live feed to the legacy page contract',async()=>{
  let calls=0;
  const data=setup(async()=>response(++calls===1?{item:null}:{items:[{name:'Repatha',cash_price:600,as_low_as:0,url:'https://example.com/official'}]}));
  const result=await data.load('https://api.example','repatha');
  assert.equal(result.copay_price,0); assert.equal(result.manufacturerUrl,'https://example.com/official');
});
test('API outage keeps the directory name without fabricating a price or link',async()=>{
  const data=setup(async url=>{
    if(url==='/data/drugs.json')return response({items:[{slug:'repatha',name:'Repatha'}]});
    throw new Error('offline');
  });
  const result=await data.load('https://api.example','repatha');
  assert.equal(result.brand,'Repatha'); assert.equal(result._unavailable,true);
  assert.equal(result.copay_price,undefined); assert.equal(result.manufacturerUrl,undefined);
});
test('duplicate consumers share one request',async()=>{
  let calls=0;const data=setup(async()=>{calls++;return response({item:{brand:'Repatha'}})});
  await Promise.all([data.load('https://api.example','repatha'),data.load('https://api.example','repatha')]);
  assert.equal(calls,1);
});
test('non-success HTTP responses use the safe unavailable state',async()=>{
  const data=setup(async()=>({ok:false}));
  assert.equal((await data.load('https://api.example','unknown'))._unavailable,true);
});
