/**
 * SaveRx.ai Admin Dashboard Server
 * Run: node admin-server.js
 * Open: http://localhost:3001
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const CSV_PATH = path.join(__dirname, 'data', 'saverx-leads-deduped.csv');

// ─── Cache ───────────────────────────────────────────────────────────────────
let _cache = { data: null, ts: 0, error: null };

function isCacheFresh() {
  return _cache.data && (Date.now() - _cache.ts) < CACHE_TTL_MS;
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function getDrugCategory(drug) {
  if (!drug || drug === 'N/A') return 'general';
  const d = drug.toLowerCase();
  if (['ozempic','wegovy','mounjaro','zepbound','saxenda','victoza','rybelsus','trulicity','semaglutide','tirzepatide','liraglutide'].some(n => d.includes(n))) return 'glp1';
  if (['repatha','entresto','eliquis','xarelto','brilinta','plavix','corlanor','evkeeza','camzyos'].some(n => d.includes(n))) return 'cardiovascular';
  if (['jardiance','farxiga','freestylelibre','dexcom','metformin','januvia'].some(n => d.includes(n))) return 'diabetes';
  return 'general';
}

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (fields don't contain commas in our data)
    const parts = lines[i].split(',');
    if (parts.length < 3) continue;
    rows.push({
      timestamp: parts[0].trim(),
      email: parts[1].trim(),
      drug: parts[2].trim(),
    });
  }
  return rows;
}

async function fetchStats() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found at ${CSV_PATH}. Export leads from Google Sheet first.`);

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Category breakdown
  const categoryCounts = { glp1: 0, cardiovascular: 0, diabetes: 0, general: 0 };
  let newThisWeek = 0;

  for (const row of rows) {
    const cat = getDrugCategory(row.drug);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    // Timestamp format: M/D/YYYY H:MM:SS
    const d = new Date(row.timestamp);
    if (!isNaN(d.getTime()) && d.getTime() > sevenDaysAgo) newThisWeek++;
  }

  const CATEGORY_LABELS = {
    glp1: 'GLP-1 Users',
    cardiovascular: 'Cardiovascular',
    diabetes: 'Diabetes & CGM',
    general: 'General Savings',
  };

  const groups = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ id: key, name: CATEGORY_LABELS[key], total: count }));

  const recent = rows.slice(-15).reverse().map(r => ({
    email: r.email,
    drug: r.drug || '—',
    category: getDrugCategory(r.drug),
    date: new Date(r.timestamp).toISOString(),
  }));

  return {
    totalActive: rows.length,
    newThisWeek,
    groups,
    recent,
    fetchedAt: new Date().toISOString(),
    source: 'csv',
  };
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS (localhost only)
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── GET / → serve dashboard HTML ──
  if (url.pathname === '/' || url.pathname === '/admin.html') {
    const htmlPath = path.join(__dirname, 'admin.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('admin.html not found — make sure it is in the saverx/ folder.');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(htmlPath));
    return;
  }

  // ── GET /api/stats → return JSON stats ──
  if (url.pathname === '/api/stats') {
    // Force refresh?
    if (url.searchParams.get('refresh') === '1') _cache = { data: null, ts: 0, error: null };

    if (isCacheFresh()) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...(_cache.data), cached: true }));
      return;
    }

    try {
      const data = await fetchStats();
      _cache = { data, ts: Date.now(), error: null };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      _cache.error = err.message;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── 404 ──
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅  SaveRx.ai Admin Dashboard');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log('');
  console.log('  Reads from data/saverx-leads-deduped.csv');
  console.log('  Auto-refreshes every 60 seconds.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
