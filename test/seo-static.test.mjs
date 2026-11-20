import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {urlFor,REPATHA,HOME_TITLE,GUIDE_SITEMAP,fixPage,fixRepatha,fixHome,fixLegacy,fixSitemap} from '../scripts/_fix-static-seo.mjs';
const slugs=fs.readdirSync('drugs',{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(`drugs/${d.name}/index.html`)).map(d=>d.name);
const attr=(h,re)=>(h.match(re)||[])[1];

test('urlFor maps files to their public URLs',()=>{
  assert.equal(urlFor('index.html'),'https://saverx.ai/');assert.equal(urlFor('drugs/repatha/index.html'),'https://saverx.ai/drugs/repatha/');
  assert.equal(urlFor('drugs/index.html'),'https://saverx.ai/drugs/');assert.equal(urlFor('privacy.html'),'https://saverx.ai/privacy.html');
});
test('every drug page, the directory and the privacy page ship a real canonical and og:url in the raw HTML (matching the runtime script)',()=>{
  const files=['drugs/index.html','privacy.html',...slugs.map(s=>`drugs/${s}/index.html`)];assert(files.length>=365);
  for(const f of files){const h=fs.readFileSync(f,'utf8');const u=urlFor(f);
    assert.equal(attr(h,/<link rel="canonical" href="([^"]*)"/),u,`${f} canonical`);assert.equal(attr(h,/<meta property="og:url" content="([^"]*)"/),u,`${f} og:url`);}
});
test('Repatha (the ad landing page) has a real title and description in the raw HTML; no other page still has the template placeholder',()=>{
  const h=fs.readFileSync('drugs/repatha/index.html','utf8');
  assert.equal(attr(h,/<title>(.*?)<\/title>/),REPATHA.title.replace(/&/g,'&amp;'));assert(REPATHA.title.length<=60);assert(REPATHA.description.length>=120&&REPATHA.description.length<=160,`description ${REPATHA.description.length}`);
  assert.equal(attr(h,/<meta name="description" content="([^"]*)"/),REPATHA.description);assert.match(attr(h,/<meta property="og:title" content="([^"]*)"/),/Repatha/);
  for(const s of slugs){const t=attr(fs.readFileSync(`drugs/${s}/index.html`,'utf8'),/<title>(.*?)<\/title>/)||'';assert(!/^Drug Savings/.test(t)&&t.length>=30,`${s}: "${t}"`);}
});
test('homepage title is short enough for search results',()=>{
  const t=attr(fs.readFileSync('index.html','utf8'),/<title>(.*?)<\/title>/);assert.equal(t,HOME_TITLE);assert(t.length<=65,String(t.length));
});
test('legacy pages: ozempic.html canonicalizes to the main Ozempic page; no page points at the old vajih.github.io host',()=>{
  const o=fs.readFileSync('drugs/ozempic.html','utf8');assert.equal(attr(o,/<link rel="canonical" href="([^"]*)"/),'https://saverx.ai/drugs/ozempic/');
  const stale=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','.venv','_site','dev'].includes(e.name))continue;const p=`${d}/${e.name}`;
    if(e.isDirectory())walk(p);else if(e.name.endsWith('.html')&&fs.readFileSync(p,'utf8').includes('vajih.github.io'))stale.push(p);}};walk('.');assert.deepEqual(stale,[]);
});
test('sitemap lists the guide / coupon pages, stays well-formed, and has no duplicates',()=>{
  const x=fs.readFileSync('sitemap.xml','utf8');assert(x.trim().endsWith('</urlset>'));
  for(const f of GUIDE_SITEMAP)assert(x.includes(`<loc>https://saverx.ai/${f}</loc>`),f);
  const locs=[...x.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(locs).size,locs.length,'no duplicate URLs');
});
test('the fix functions are idempotent',()=>{
  const p='<title>Drug Savings | SaveRx.ai</title><link rel="canonical" href="" /><meta property="og:url" content="" />';
  const a=fixPage('drugs/x/index.html',p);assert.equal(fixPage('drugs/x/index.html',a),a);assert.equal(fixRepatha(fixRepatha(p)),fixRepatha(p));
  const s='<urlset>\n  <url><loc>a</loc></url>\n</urlset>';const s1=fixSitemap(s);assert.equal(fixSitemap(s1),s1);assert.equal(fixHome(fixHome('x')),'x');assert.equal(fixLegacy('other.html','x'),'x');
});
