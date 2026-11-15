// Admin UI (served only after the Access/JWT check). Vanilla JS; all dynamic text is set via textContent.
export function adminPageHtml(nonce) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Savings Watch admin | SaveRx.ai</title><link rel="stylesheet" href="/assets/css/tokens.css">
<style nonce="${nonce}">body{margin:0;background:var(--bg,#f8f7f2);color:var(--text,#26362f);font:14px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:20px 16px 60px}h1{font-size:1.3rem}h2{font-size:1rem;margin:0 0 8px}
.card{background:var(--surface,#fffefa);border:1px solid var(--border,#ddd);border-radius:12px;padding:14px;margin:12px 0}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--border,#ddd)}tr[data-id]{cursor:pointer}tr[data-id]:hover{background:var(--brand-50,#e1f5ee)}
label{display:block;margin:10px 0 3px;font-weight:600}input,textarea,select{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-strong,#aaa);border-radius:8px;font:inherit;background:#fff}
button{background:var(--teal,#313dc5);color:#fff;border:0;border-radius:100px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;margin:8px 8px 0 0}button.alt{background:transparent;color:inherit;border:1px solid var(--border-strong,#aaa)}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1 1 200px}.stats{display:flex;gap:10px;flex-wrap:wrap}.stat{padding:8px 12px;background:var(--brand-50,#e1f5ee);border-radius:10px}
input.chk{width:auto}.opt{border:1px dashed var(--border-strong,#aaa);border-radius:10px;padding:10px;margin:8px 0}#msg{font-weight:600;margin-top:10px}</style></head>
<body><main><h1>Savings Watch admin</h1><div id="msg" role="status"></div>
<div class="card"><h2>Funnel (all time)</h2><div class="stats" id="stats"></div></div>
<div class="card"><h2>Requests</h2><select id="filter"><option value="">All</option><option>verified</option><option>ready</option><option>sent</option><option>new</option></select>
<table><thead><tr><th>Created</th><th>Medication</th><th>Phone</th><th>Status</th><th>Watch</th></tr></thead><tbody id="rows"></tbody></table></div>
<div class="card" id="detail" hidden><h2 id="dtitle"></h2><p id="dmeta"></p>
<button class="alt" id="draft" type="button">Load draft from drug page</button>
<label>Headline</label><input id="headline" maxlength="120"><label>Summary</label><textarea id="summary" rows="2" maxlength="600"></textarea>
<div id="items"></div><button class="alt" id="addItem" type="button">+ Add option</button>
<label>Eligibility note</label><textarea id="elig" rows="2" maxlength="600"></textarea>
<div class="row"><div><label>Checked date (YYYY-MM-DD)</label><input id="checked"></div><div><label>What did you verify, and where?</label><input id="note" maxlength="300"></div></div>
<label><input type="checkbox" id="ver" class="chk"> I verified this information on the official sources.</label>
<button id="save" type="button">Save verified result</button><a id="previewLink" target="_blank" rel="noopener" hidden>Preview ↗</a>
<button id="send" type="button">Send text</button><p id="dmsgs"></p></div></main>
<script nonce="${nonce}">
var $=function(s){return document.querySelector(s)},cur=null,curResult=null;
function say(t,bad){var m=$("#msg");m.textContent=t;m.style.color=bad?"#b00020":"inherit"}
function api(p,o){o=o||{};if(o.body&&typeof o.body!=="string"){o.body=JSON.stringify(o.body);o.headers={"Content-Type":"application/json"}}
return fetch(p,o).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||"Request failed");return j})})}
function cell(tr,t){var td=document.createElement("td");td.textContent=t;tr.appendChild(td)}
function loadStats(){api("/api/admin/stats").then(function(s){var el=$("#stats");el.textContent="";Object.keys(s.totals).forEach(function(k){var d=document.createElement("div");d.className="stat";d.textContent=k.replace(/_/g," ")+": "+s.totals[k];el.appendChild(d)})}).catch(function(e){say(e.message,1)})}
function loadList(){api("/api/admin/requests"+($("#filter").value?"?status="+$("#filter").value:"")).then(function(d){var b=$("#rows");b.textContent="";d.requests.forEach(function(r){var tr=document.createElement("tr");tr.setAttribute("data-id",r.id);
cell(tr,r.created_at.slice(0,16).replace("T"," "));cell(tr,r.drug_slug);cell(tr,r.phone_last4?"…"+r.phone_last4:"(deleted)");cell(tr,r.status);cell(tr,r.watch_opt_in?"yes":"");b.appendChild(tr)})}).catch(function(e){say(e.message,1)})}
function addItem(it){it=it||{};var d=document.createElement("div");d.className="opt";["title","text","url","terms_url"].forEach(function(k){var l=document.createElement("label");l.textContent=k==="terms_url"?"Terms link (optional, https)":k==="url"?"Official link (https)":k==="text"?"Description":"Title";var i=document.createElement(k==="text"?"textarea":"input");i.setAttribute("data-k",k);i.value=it[k]||"";d.appendChild(l);d.appendChild(i)});$("#items").appendChild(d)}
function readItems(){return Array.prototype.map.call(document.querySelectorAll("#items .opt"),function(d){var o={};d.querySelectorAll("[data-k]").forEach(function(i){if(i.value.trim())o[i.getAttribute("data-k")]=i.value.trim()});return o})}
function open(id){api("/api/admin/requests/"+id).then(function(d){cur=d.request;curResult=d.result;$("#detail").hidden=false;$("#dtitle").textContent=cur.drug_slug+" · …"+cur.phone_last4;
$("#dmeta").textContent="Status: "+cur.status+(d.result&&d.result.sent?" · link sent, expires "+d.result.expires_at+(d.result.viewed_at?" · viewed":"")+(d.result.outcome?" · outcome: "+d.result.outcome:""):"");
$("#dmsgs").textContent=d.messages.map(function(m){return m.created_at.slice(0,16)+" "+m.status+(m.error_code?" ("+m.error_code+")":"")}).join(" | ");
$("#items").textContent="";var c=d.result?d.result.content:null;$("#headline").value=c?c.headline:"";$("#summary").value=c?c.summary:"";$("#elig").value=c?c.eligibility:"";$("#checked").value=c?c.checked_at:new Date().toISOString().slice(0,10);
(c?c.items:[{}]).forEach(addItem);$("#note").value=d.result?d.result.source_note:"";$("#ver").checked=false;$("#previewLink").hidden=!d.result;if(d.result)$("#previewLink").href="/admin/savings/preview/"+d.result.id}).catch(function(e){say(e.message,1)})}
$("#rows").addEventListener("click",function(e){var tr=e.target.closest("tr");if(tr)open(tr.getAttribute("data-id"))});
$("#filter").addEventListener("change",loadList);$("#addItem").addEventListener("click",function(){addItem()});
$("#draft").addEventListener("click",function(){fetch("/drugs/"+cur.drug_slug+"/").then(function(r){return r.text()}).then(function(h){var m=new DOMParser().parseFromString(h,"text/html").getElementById("drug-page-profile");if(!m)throw new Error("No program data found on the drug page.");var p=JSON.parse(m.textContent);
$("#headline").value="Savings options for "+p.brand;$("#items").textContent="";if(p.copay&&p.copay.url)addItem({title:"Manufacturer co-pay program",text:p.copay.eligibility||"",url:p.copay.url,terms_url:p.copay.terms});
if(p.assistance&&p.assistance.url)addItem({title:p.assistance.name,text:p.assistance.text||"",url:p.assistance.url});$("#elig").value=(p.copay&&p.copay.eligibility)||"";$("#checked").value=p.checkedAt||$("#checked").value;say("Draft loaded. Verify every detail on the official sites before saving.")}).catch(function(e){say(e.message,1)})});
$("#save").addEventListener("click",function(){api("/api/admin/requests/"+cur.id+"/result",{method:"POST",body:{verified:$("#ver").checked,source_note:$("#note").value,content:{headline:$("#headline").value,summary:$("#summary").value,eligibility:$("#elig").value,checked_at:$("#checked").value,items:readItems(),sources:[]}}}).then(function(r){say("Saved. Preview it, then send.");$("#previewLink").hidden=false;$("#previewLink").href=r.preview_url;loadList()}).catch(function(e){say(e.message,1)})});
$("#send").addEventListener("click",function(){if(!$("#send").getAttribute("data-armed")){$("#send").setAttribute("data-armed","1");$("#send").textContent="Confirm: send text now";return}$("#send").removeAttribute("data-armed");$("#send").textContent="Send text";
api("/api/admin/requests/"+cur.id+"/send",{method:"POST",body:{}}).then(function(){say("Text sent.");open(cur.id);loadList();loadStats()}).catch(function(e){say(e.message,1)})});
loadStats();loadList();
</script></body></html>`;
}
