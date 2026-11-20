import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const gs=fs.readFileSync('scripts/Code.gs','utf8');
const hoursAgo=h=>new Date(Date.now()-h*3600e3).toISOString();

function loadGs({eventLog,leads,waitlist=null,ga4Views=null,ga4Throws=false}){
  const sheet=rows=>({getDataRange:()=>({getValues:()=>rows}),getLastRow:()=>rows.length,appendRow:r=>rows.push(r),setFrozenRows(){},getRange:(r)=>({setNumberFormat(){},setValues:v=>{rows[r-1]=v[0];}})});
  const sheets={EventLog:sheet(eventLog),CopayEnrollments:sheet(leads),EnrollmentInterest:sheet([['timestamp']])};if(waitlist)sheets.TextWaitlist=sheet(waitlist);
  const logged=[];
  const ctx={__sheets:sheets,SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet([]))})},Logger:{log:x=>logged.push(x)},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},UrlFetchApp:{fetch:()=>({})},ContentService:{createTextOutput:t=>({t,setMimeType(){return this;}}),MimeType:{JSON:'json'}},
    ScriptApp:{},Utilities:{},Session:{},HtmlService:{},LockService:{},console};
  if(ga4Views!==null||ga4Throws)ctx.AnalyticsData={Properties:{runReport:(req)=>{if(ga4Throws)throw new Error('GA4 down');
    const isSms=JSON.stringify(req).includes('sms_interest_view');return {rows:isSms?[{metricValues:[{value:String(ga4Views)}]}]:[]};}}};
  vm.runInNewContext(gs,ctx);return ctx;
}
const compute=o=>JSON.parse(JSON.stringify(loadGs(o).computeEnrollMetrics()));   // plain objects (the sandbox's prototypes differ)
const header=['timestamp','event','slug','extra'];
const EL=[header,
  [hoursAgo(1),'sms_interest_click','repatha','coupons'],[hoursAgo(2),'sms_interest_click','repatha','updates'],[hoursAgo(30),'sms_interest_click','ozempic','coupons'],
  [hoursAgo(24*10),'sms_interest_click','dupixent','updates'],[hoursAgo(3),'assist_cta_click','repatha',''],[hoursAgo(1),'sms_interest_email','repatha','coupons'],[hoursAgo(2),'sms_interest_click','repatha','bogus-variant']];
const LEADS=[['ts','email','drug','source','ua'],
  [hoursAgo(1),'A@example.test','Repatha','SMS interest (coupons)','x'],[hoursAgo(1),'a@example.test','Repatha','SMS interest (coupons)','x'],   // same person twice
  [hoursAgo(40),'b@example.test','Ozempic','SMS interest (updates)','x'],[hoursAgo(5),'c@example.test','Ozempic','Drug Page Modal','x'],   // not from the card
  [hoursAgo(100),'d@example.test','Dupixent','SMS interest (updates)','x']];

test('metrics: interested counts, windows, per-drug and per-variant tallies',()=>{
  const m=compute({eventLog:EL,leads:LEADS,ga4Views:200}).sms_interest;
  assert.equal(m.interested.total,5);assert.equal(m.interested.last24,3);assert.equal(m.interested.last7,4);
  assert.deepEqual(m.by_drug,{repatha:3,ozempic:1,dupixent:1});
  assert.deepEqual(m.by_variant.coupons,{interested:2,emails:1,phones:0});assert.equal(m.by_variant.updates.interested,2,'unknown variant is not attributed');
});
test('metrics: emails are DISTINCT people from the card only (other sources and repeats excluded)',()=>{
  const m=compute({eventLog:EL,leads:LEADS,ga4Views:200}).sms_interest;
  assert.equal(m.emails.total,3);assert.equal(m.emails.last24,1);assert.deepEqual(m.emails_by_drug,{repatha:1,ozempic:1,dupixent:1});assert.equal(m.by_variant.updates.emails,2);
});
test('metrics: rates use GA4 views and interested clicks; missing data gives null, never a crash',()=>{
  const m=compute({eventLog:EL,leads:LEADS,ga4Views:200}).sms_interest;
  assert.equal(m.views,200);assert.equal(m.interest_rate_pct,2.5);assert.equal(m.email_rate_pct,60);
  const down=compute({eventLog:EL,leads:LEADS,ga4Throws:true}).sms_interest;assert.equal(down.views,null);assert.match(down.view_error,/GA4 down/);assert.equal(down.interest_rate_pct,null);assert.equal(down.interested.total,5);
  const none=compute({eventLog:[header],leads:[LEADS[0]]}).sms_interest;assert.equal(none.interested.total,0);assert.equal(none.email_rate_pct,null);
});
test('metrics output stays aggregate-only: no email addresses anywhere',()=>{
  const out=JSON.stringify(compute({eventLog:EL,leads:LEADS,ga4Views:200}));assert(!/@example\.test/.test(out));
});
test('existing metrics are unaffected (still present) and a failure in the new block cannot break them',()=>{
  const m=compute({eventLog:EL,leads:LEADS});assert(m.events&&m.intakes&&m.funnel&&m.thresholds);
  assert.equal(m.events.total.assist_cta_click,1);
});

test('dashboard: renders the interest panel from the metrics JSON (real script, stub DOM)',async()=>{
  const html=fs.readFileSync('dashboard/enrollment.html','utf8');const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
  const els={};const el=id=>els[id]||(els[id]={id,textContent:'',innerHTML:'',hidden:true});
  const metrics=compute({eventLog:EL,leads:LEADS,ga4Views:200});
  const ctx={document:{getElementById:el},fetch:async()=>({json:async()=>JSON.parse(JSON.stringify(metrics))}),Date,Object,Math,JSON};
  vm.runInNewContext(script,ctx);for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(els['s-total'].textContent,5);assert.equal(els['s-24h'].textContent,3);assert.equal(els['s-emails'].textContent,3);assert.equal(els['s-emailrate'].textContent,'60%');assert.equal(els['s-rate'].textContent,'2.5%');
  assert.equal(els.smsCard.hidden,false);assert.match(els.smsBody.innerHTML,/Wording: coupons[\s\S]*<b>2<\/b> interested/);assert.match(els.smsBody.innerHTML,/repatha/);
  assert(!/@example\.test/.test(els.smsBody.innerHTML));
});
test('dashboard: an older backend without sms_interest shows a clear "redeploy" note instead of breaking',async()=>{
  const html=fs.readFileSync('dashboard/enrollment.html','utf8');const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
  const els={};const el=id=>els[id]||(els[id]={id,textContent:'',innerHTML:'',hidden:true});
  const m=compute({eventLog:EL,leads:LEADS});delete m.sms_interest;
  vm.runInNewContext(script,{document:{getElementById:el},fetch:async()=>({json:async()=>JSON.parse(JSON.stringify(m))}),Date,Object,Math,JSON});for(let i=0;i<20;i++)await Promise.resolve();
  assert.match(els.smsBody.innerHTML,/Redeploy Code\.gs/);assert.equal(els.smsCard.hidden,false);assert.equal(els.error?.hidden??true,true);
});

// ---- Text-alerts waitlist (TextWaitlist tab)
const WL_HEAD=['timestamp','phone','drug','drug_slug','variant','consent_version','consent_text','source_page','utm_source','utm_medium','utm_campaign','user_agent','status'];
const wrow=(h,phone,drug,slug,variant)=>[hoursAgo(h),phone,drug,slug,variant,'v1','text','/p','','','','ua','waitlist'];
const WL=[WL_HEAD,wrow(1,'+18324567788','Repatha','repatha','coupons'),wrow(2,'+18324567788','Ozempic','ozempic','coupons'),wrow(30,'+12145550123','Repatha','repatha','updates'),
  wrow(24*10,'+13125550188','Dupixent','dupixent','updates'),wrow(3,'+12145550123','Repatha','repatha','updates')];   // last row: duplicate phone+drug
test('waitlist metrics: distinct people vs signups, windows, per-drug and per-variant, rate from GA4 views',()=>{
  const m=compute({eventLog:EL,leads:LEADS,waitlist:WL,ga4Views:200}).sms_interest;
  assert.equal(m.waitlist.signups,4,'one per phone+drug; the duplicate row is ignored');assert.equal(m.waitlist.people,3);assert.equal(m.waitlist.last24,2);assert.equal(m.waitlist.last7,3);
  assert.deepEqual(m.waitlist_by_drug,{repatha:2,ozempic:1,dupixent:1});assert.equal(m.by_variant.coupons.phones,2);assert.equal(m.by_variant.updates.phones,2);
  assert.equal(m.waitlist_rate_pct,2);
});
test('waitlist metrics: no tab yet means zeros, never a crash; output is aggregate-only (no phone numbers)',()=>{
  const none=compute({eventLog:EL,leads:LEADS,ga4Views:200}).sms_interest;assert.equal(none.waitlist.signups,0);assert.equal(none.waitlist.people,0);assert.equal(none.waitlist_rate_pct,0);
  const out=JSON.stringify(compute({eventLog:EL,leads:LEADS,waitlist:WL,ga4Views:200}));assert(!/\+1\d{10}/.test(out),'no phone numbers in the metrics JSON');assert(!/832|214|312/.test(out.replace(/generated_at":"[^"]*"/,'')),'no digits of any number');
});

// ---- doPost -> handleTextWaitlist
function post(waitlistRows,p){
  const ctx=loadGs({eventLog:[header],leads:[LEADS[0]],waitlist:waitlistRows});
  const out=ctx.doPost({parameter:{form_type:'text_waitlist',...p}});return {ctx,out:out.t};
}
const GOOD={phone:'(832) 456-7788',drug:'Repatha',drug_slug:'repatha',variant:'coupons',consent_version:'2026-11-20-v1',consent_text:'By tapping you agree... STOP',source_page:'/drugs/repatha/',utm_source:'fb',utm_medium:'cpc',utm_campaign:'nov',useragent:'ua'};
test('doPost waitlist: stores one row with the consent record; phone normalized to +1XXXXXXXXXX',()=>{
  const rows=[WL_HEAD];const {out}=post(rows,GOOD);assert.equal(rows.length,2);const r=rows[1];
  assert.equal(JSON.parse(out).status,'ok');assert.equal(r[1],'+18324567788');assert.equal(r[2],'Repatha');assert.equal(r[3],'repatha');assert.equal(r[4],'coupons');assert.equal(r[5],'2026-11-20-v1');assert.equal(r[6],GOOD.consent_text);
  assert.equal(r[7],'/drugs/repatha/');assert.equal(r[8],'fb');assert.equal(r[12],'waitlist');assert(!isNaN(Date.parse(r[0])));
});
test('doPost waitlist: invalid numbers write nothing; duplicates (same phone + drug) are skipped but a second drug is stored',()=>{
  for(const bad of ['','12345','(123) 456-7890','5555555555','(832) 555-0142','+44 20 7946 0958']){const rows=[WL_HEAD];const {out}=post(rows,{...GOOD,phone:bad});assert.equal(out,'Invalid phone',bad);assert.equal(rows.length,1,bad);}
  const rows=[WL_HEAD];post(rows,GOOD);const dup=post(rows,{...GOOD,phone:'1-832-456-7788'});assert.equal(rows.length,2);assert.equal(JSON.parse(dup.out).duplicate,true);
  post(rows,{...GOOD,drug:'Ozempic',drug_slug:'ozempic'});assert.equal(rows.length,3,'same person, different drug = a new signup');
});
test('doPost waitlist: honeypot is ignored; creates the tab if missing; long fields are capped; email flow is untouched',()=>{
  const rows=[WL_HEAD];assert.equal(post(rows,{...GOOD,website:'bot'}).out,'Ignored');assert.equal(rows.length,1);
  const ctx=loadGs({eventLog:[header],leads:[LEADS[0]]});const out=ctx.doPost({parameter:{form_type:'text_waitlist',...GOOD}});assert.equal(JSON.parse(out.t).status,'ok');
  const created=ctx.__sheets.TextWaitlist;assert(created,'tab created');assert.equal(created.getDataRange().getValues().length,2);
  const big=[WL_HEAD];post(big,{...GOOD,consent_text:'x'.repeat(5000),useragent:'u'.repeat(5000)});assert.equal(big[1][6].length,1500);assert.equal(big[1][11].length,300);
  const c2=loadGs({eventLog:[header],leads:[LEADS[0]]});const e=c2.doPost({parameter:{email:'z@example.test',drug:'Repatha',source:'SMS interest (coupons)'}});assert.equal(JSON.parse(e.t).status,'ok');
});
test('Code.gs normalizeUsPhone matches the page script on the same inputs',()=>{
  const ctx=loadGs({eventLog:[header],leads:[LEADS[0]]});const js=fs.readFileSync('assets/js/sms-interest.js','utf8');
  const m=js.match(/function normalizePhone\(raw\) \{[\s\S]*?\n  \}/)[0];const page=vm.runInNewContext(`(function(){${m};return normalizePhone;})()`,{});
  for(const x of ['(832) 456-7788','1-832-456-7788','8324567788','832.456.7788','123','5555555555','(832) 555-0142','(123) 456-7890','(832) 056-7788','','+44 20 7946 0958'])
    assert.equal(ctx.normalizeUsPhone(x)||null,page(x),`mismatch for "${x}"`);
});
