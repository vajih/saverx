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

const ML_API = 'https://connect.mailerlite.com/api';
const ML_KEY = process.env.MAILERLITE_API_KEY || '';

// ─── Cache ───────────────────────────────────────────────────────────────────
let _cache = { data: null, ts: 0, error: null };

function isCacheFresh() {
  return _cache.data && (Date.now() - _cache.ts) < CACHE_TTL_MS;
}

// ─── MailerLite API helpers ───────────────────────────────────────────────────
async function mlFetch(path) {
  if (!ML_KEY) throw new Error('MAILERLITE_API_KEY not set in .env');
  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      'Authorization': `Bearer ${ML_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401) throw new Error('MailerLite API key is invalid or expired. Get a new token from app.mailerlite.com → Integrations → API.');
  if (!res.ok) throw new Error(`MailerLite API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchStats() {
  // Run requests in parallel
  const [groupsRes, subsRes, recentRes] = await Promise.all([
    mlFetch('/groups?limit=25&sort=name'),
    mlFetch('/subscribers?filter[status]=active&limit=1'),
    mlFetch('/subscribers?filter[status]=active&sort=-subscribed_at&limit=20'),
  ]);

  // Subscribers added in the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSubscribers = (recentRes.data || []).filter(s => {
    const d = new Date(s.subscribed_at || s.created_at);
    return d.getTime() > sevenDaysAgo;
  });

  // Group totals for percentage chart
  const groups = (groupsRes.data || []).map(g => ({
    id: g.id,
    name: g.name,
    total: g.active_count ?? 0,
    openRate: g.open_rate ? (g.open_rate.float * 100).toFixed(1) : null,
    clickRate: g.click_rate ? (g.click_rate.float * 100).toFixed(1) : null,
  }));

  const totalActive = subsRes.total ?? 0;

  const recent = (recentRes.data || []).slice(0, 15).map(s => ({
    email: s.email,
    drug: s.fields?.drug || '—',
    category: s.fields?.drug_category || '—',
    date: s.subscribed_at || s.created_at,
  }));

  return {
    totalActive,
    newThisWeek: recentSubscribers.length,
    groups,
    recent,
    fetchedAt: new Date().toISOString(),
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
  console.log('  Auto-refreshes every 60 seconds.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
  if (!ML_KEY) {
    console.warn('  ⚠️   MAILERLITE_API_KEY is not set in .env');
    console.warn('       Add it and restart the server.');
  }
});
