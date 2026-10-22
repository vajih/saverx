import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const source=readFileSync('assets/js/support-pages.js','utf8');
function helper(){
 const context={window:{},document:{querySelector:()=>null,querySelectorAll:()=>[]},URLSearchParams,fetch:()=>{throw new Error('Unexpected network access')}};
 vm.runInNewContext(source,context);
 return context.window.SaveRxRequest.submitRequest;
}
test('medication request retains backend field names and source',async()=>{
 let call;
 await helper()('https://example.com/exec',{email:'fixture@example.com',drug:'Example',source:'request_med',ua:'test'},async(url,options)=>{call={url,options};return {ok:true,json:async()=>({status:'ok',sheetError:null})}});
 assert.equal(call.options.method,'POST');
 assert.equal(call.options.headers['Content-Type'],'application/x-www-form-urlencoded');
 const fields=new URLSearchParams(call.options.body);
 assert.equal(fields.get('source'),'request_med');assert.equal(fields.get('drug'),'Example');assert.equal(fields.get('email'),'fixture@example.com');
});
test('sheet write failure is never presented as a saved request',async()=>{
 await assert.rejects(helper()('https://example.com/exec',{},async()=>({ok:true,json:async()=>({status:'ok',sheetError:'write failed'})})));
});
test('backend error and unconfirmed HTTP response stay errors',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>({status:'error'})},{ok:true,json:async()=>{throw new Error('opaque')}}])await assert.rejects(helper()('https://example.com/exec',{},async()=>response));
});
test('email delivery failure does not erase an acknowledged request',async()=>{
 assert.equal(await helper()('https://example.com/exec',{},async()=>({ok:true,json:async()=>({status:'ok',sheetError:null,emailSent:false})})),true);
});
test('existing contact field contract and backend endpoint remain',()=>{
 const before=execFileSync('git',['show','origin/main:contact.html'],{encoding:'utf8'}),after=readFileSync('contact.html','utf8');
 for(const id of ['contactForm','name','email','topic','message','consent','website','submitBtn','formStatus'])assert.ok(after.includes(`id="${id}"`),id);
 const api=before.match(/window.CONTACT_API = "([^"]+)"/)[1];assert.ok(after.includes(api));
});
test('published guide article content remains unchanged',()=>{
 for(const name of ['how-copay-cards-work','copay-cards-vs-patient-assistance-programs','how-to-reduce-prescription-costs','what-to-do-if-insurance-denies-medication','medicare-vs-commercial-insurance-drug-costs']){
  const path=`learn/${name}.html`,before=execFileSync('git',['show',`origin/main:${path}`],{encoding:'utf8'}),after=readFileSync(path,'utf8');
  assert.equal(after.match(/<article class="article-body">([\s\S]*?)<\/article>/)[1],before.match(/<article class="article-body">([\s\S]*?)<\/article>/)[1],path);
 }
});
