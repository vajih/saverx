/**
 * Vercel serverless function — Katalys affiliate stats proxy
 * GET /api/katalys
 */

function checkAuth(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true; // no password set → open (shouldn't happen in prod)

  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Basic ')) return false;

  const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
  const colonIdx = decoded.indexOf(':');
  const provided = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
  return provided === password;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="SaveRx Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.KATALYS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'KATALYS_API_KEY not configured in Vercel environment variables.' });
  }

  const nowSec   = Math.floor(Date.now() / 1000);
  const startSec = nowSec - 30 * 24 * 60 * 60;

  try {
    const katalysRes = await fetch('https://api.katalys.com/v1/report/stats', {
      method: 'POST',
      headers: {
        'Authorization': `apikey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dimensions: ['offer', 'unique_clicks', 'conversions', 'payout'],
        filters: [
          { field: 'time',   type: 'range',   values: [String(startSec), String(nowSec)] },
          { field: 'org_id', type: 'include', values: ['70a7c458-e3dd-4ab0-bc27-b9b3ac6f9432'] },
        ],
      }),
    });

    if (!katalysRes.ok) {
      return res.status(502).json({ error: `Katalys API returned HTTP ${katalysRes.status}` });
    }

    const data = await katalysRes.json();
    if (data.errors && data.errors.length) {
      return res.status(502).json({ error: data.errors[0].message });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Failed to reach Katalys API' });
  }
}
