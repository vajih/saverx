// Fix all drug pages to use slug-based fallbacks when API returns null data
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let fixed = 0;

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!f.endsWith('.html')) continue;

    let html = readFileSync(full, 'utf8');

    // Only touch drug pages that have the dynamic load pattern
    if (!html.includes('brand: d.brand ||')) continue;

    // Extract the slug from hero image path as a reliable source
    // (these pages all have slug baked into hero img src already)
    // Instead, we inject a slugToTitle helper and fix the fallbacks

    // Fix 1: brand fallback — use slugToTitle(slug) instead of ""
    if (html.includes('brand: d.brand || "",')) {
      html = html.replace(
        'brand: d.brand || "",',
        'brand: d.brand || slug.replace(/-/g," ").replace(/\\b\\w/g,c=>c.toUpperCase()),'
      );
    }

    // Fix 2: generic fallback stays empty — that's fine

    // Fix 3: manufacturerUrl fallback — Google search instead of "/"
    if (html.includes('window.__manufacturerUrl = d.manufacturerUrl || "/";')) {
      html = html.replace(
        'window.__manufacturerUrl = d.manufacturerUrl || "/";',
        'window.__manufacturerUrl = d.manufacturerUrl || `https://www.google.com/search?q=${encodeURIComponent((d.brand||slug.replace(/-/g," "))+" copay card manufacturer savings program")}`;'
      );
    }

    // Fix 4: hero image fallbacks should use slug, not hardcode "repatha"
    if (html.includes('hero_landscape: d.hero_landscape || "/assets/img/repatha-hero.png"')) {
      html = html.replace(
        'hero_landscape: d.hero_landscape || "/assets/img/repatha-hero.png",\n            hero_portrait:  d.hero_portrait  || "/assets/img/repatha-hero-vertical.png",',
        'hero_landscape: d.hero_landscape || `/assets/img/${slug}-hero.png`,\n            hero_portrait:  d.hero_portrait  || `/assets/img/${slug}-hero-vertical.png`,'
      );
    }

    writeFileSync(full, html, 'utf8');
    fixed++;
  }
}

walk('./drugs');
console.log(`Fixed ${fixed} drug pages`);
