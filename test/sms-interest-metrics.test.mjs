import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const gs=fs.readFileSync('scripts/Code.gs','utf8');
const hoursAgo=h=>new Date(Date.now()-h*3600e3).toISOString();

function loadGs({eventLog,leads,ga4Views=null,ga4Throws=false}){
  const sheet=rows=>({getDataRange:()=>({getValues:()=>rows}),getLastRow:()=>rows.length,appendRow:r=>rows.push(r)});
  const sheets={EventLog:sheet(eventLog),CopayEnrollments:sheet(leads),EnrollmentInterest:sheet([['timestamp']])};
  const logged=[];
  const ctx={SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:()=>sheet([])})},Logger:{log:x=>logged.push(x)},
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
  assert.deepEqual(m.by_variant.coupons,{interested:2,emails:1});assert.equal(m.by_variant.updates.interested,2,'unknown variant is not attributed');
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
