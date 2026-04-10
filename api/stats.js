/**
 * Vercel serverless function — subscriber stats
 * GET /api/stats
 *
 * Note: the leads CSV is gitignored (PII) so subscriber counts aren't
 * available in the cloud deployment. Katalys data (/api/katalys) works fine.
 */

function checkAuth(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true;

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

  // Leads CSV is not deployed (gitignored PII). Direct to Google Sheets.
  return res.status(200).json({
    totalActive: null,
    newThisWeek: null,
    groups: [],
    recent: [],
    source: 'cloud-no-csv',
    error: 'Subscriber CSV is not available in the cloud deployment — it contains PII and is gitignored. View live subscriber data in Google Sheets.',
  });
}
