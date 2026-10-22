/** Offline validation: no emails, leads, analytics, or backend writes. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base = process.argv[2] || 'HEAD';
const files = execFileSync('git',['diff',base,'--name-only','--diff-filter=AM'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html'));
let scripts=0,drugs=0;
for(const file of files){
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!match[2].trim() || /type=["']application\/ld\+json/.test(match[1]))continue;
  new vm.Script(match[2],{filename:file});scripts++;
 }
 if(/^drugs\/[^/]+\/index.html$/.test(file) && html.includes('SaveRxDrugData.load')){
  const before=execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
  for(const hook of ['footerForm','footerEmail','footerSubmit','modal-lead-form','modal-email','modal-drug','email-modal']){
   assert.ok(html.includes(`id="${hook}"`),`${file}: missing ${hook}`);
  }
  for(const url of before.match(/https:\/\/script\.google\.com\/macros\/s\/[^"'\s]+\/exec/g)||[])assert.ok(html.includes(url),`${file}: changed API endpoint`);
  assert.ok(html.includes('GTM-MVZBBF7R'),`${file}: missing analytics`);
  assert.ok(html.includes('/assets/js/consent.js'),`${file}: missing consent manager`);
  if(before.includes('id="enroll-help"'))assert.ok(html.includes('id="enroll-help"'),`${file}: lost enrollment pilot`);
  drugs++;
 }
}
const directory=fs.readFileSync('drugs/index.html','utf8');
let links=0;
for(const [,slug] of directory.matchAll(/class="drug"[^>]*href="\/drugs\/([^/]+)\/"/g)){
 assert.ok(fs.existsSync(`drugs/${slug}/index.html`),`Broken directory link: ${slug}`);links++;
}
assert.ok(links>350,`Only ${links} medications rendered`);
assert.ok(/data-name="repatha /.test(directory),'Repatha placeholder regression');
for(const cat of JSON.parse(fs.readFileSync('data/categories.json')).categories){
 assert.ok(fs.existsSync(`categories/${cat.slug}/index.html`));
}
console.log(`Validated ${scripts} inline scripts, ${drugs} drug-page integration contracts, ${links} directory links, and all 7 categories.`);
