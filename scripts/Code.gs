/**
 * SaveRx.ai — Google Apps Script (Code.gs)
 *
 * Handles:
 *  1. doGet  — Drug data API  (?mode=featured | ?mode=drug&slug=x | ?mode=slugs)
 *  2. doPost — Email capture  → writes to Leads sheet + sends Resend welcome email
 *
 * Sheet IDs / names:
 *  - Spreadsheet ID : 19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE
 *  - Drug data      : "Featured"   (columns: name, generic, manufacturer, cash_price,
 *                                   as_low_as, url, priority, active,
 *                                   drug_class, indication, description)
 *  - Email leads    : "Leads"
 *  - Unsubscribes   : "Unsubscribes"
 *  - Follow-up queue: "FollowUpQueue"
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
var SPREADSHEET_ID  = '19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE';
var FEATURED_SHEET  = 'Featured';
var LEADS_SHEET     = 'Leads';
var UNSUB_SHEET     = 'Unsubscribes';
var QUEUE_SHEET     = 'FollowUpQueue';
var FROM_EMAIL      = 'hello@saverx.ai';
var FROM_NAME       = 'SaveRx.ai';
var RESEND_BASE_URL = 'https://api.resend.com/emails';

// ─────────────────────────────────────────────────────────────────────────────
// doGet — Drug data API
// ─────────────────────────────────────────────────────────────────────────────
function doGet(e) {
  var params = e ? (e.parameter || {}) : {};
  var mode   = params.mode || 'featured';
  var slug   = params.slug || '';

  var output;
  try {
    if (mode === 'featured') {
      output = getFeaturedDrugs();
    } else if (mode === 'drug') {
      output = getDrugBySlug(slug);
    } else if (mode === 'slugs') {
      output = getSlugs(params.source || '');
    } else {
      output = { error: 'Unknown mode: ' + mode };
    }
  } catch (err) {
    output = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns all active drugs from the Featured sheet as { items: [...] }.
 * Includes the 3 new columns: drug_class, indication, description.
 */
function getFeaturedDrugs() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FEATURED_SHEET);
  if (!sheet) return { items: [], error: 'Featured sheet not found' };

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { items: [] };

  // Build a header→index map (case-insensitive, trimmed)
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var col = function(name) { return headers.indexOf(name.toLowerCase()); };

  var items = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var active = row[col('active')];
    // Skip inactive rows (FALSE, 'false', 0, empty)
    if (active !== undefined && active !== '' && String(active).toLowerCase() === 'false') continue;

    var name = String(row[col('name')] || '').trim();
    if (!name) continue;

    items.push({
      name:        name,
      generic:     String(row[col('generic')]      || '').trim(),
      manufacturer:String(row[col('manufacturer')] || '').trim(),
      cash_price:  parseCurrency(row[col('cash_price')]),
      as_low_as:   parseCurrency(row[col('as_low_as')]),
      url:         String(row[col('url')]          || '').trim(),
      priority:    Number(row[col('priority')])    || 99,
      slug:        toSlug(name),
      // ── New columns ───────────────────────────────────────────
      drug_class:  String(row[col('drug_class')]   || '').trim(),
      indication:  String(row[col('indication')]   || '').trim(),
      description: String(row[col('description')]  || '').trim()
    });
  }

  // Sort by priority ascending
  items.sort(function(a, b) { return a.priority - b.priority; });

  return { items: items };
}

/**
 * Returns a single drug item by slug as { item: {...} }.
 */
function getDrugBySlug(slug) {
  if (!slug) return { item: null };
  var result = getFeaturedDrugs();
  var match = (result.items || []).filter(function(i) { return i.slug === slug; })[0] || null;
  return { item: match };
}

/**
 * Returns just slugs (for sitemap / page generation) as { slugs: [...] }.
 */
function getSlugs(source) {
  var result = getFeaturedDrugs();
  var slugs = (result.items || []).map(function(i) { return i.slug; });
  return { slugs: slugs, source: source };
}

// ─────────────────────────────────────────────────────────────────────────────
// doPost — Email capture
// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  var params = {};
  try {
    if (e.postData && e.postData.type === 'application/json') {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }
  } catch (err) {
    params = e.parameter || {};
  }

  var email    = String(params.email    || '').trim().toLowerCase();
  var drug     = String(params.drug     || 'N/A').trim();
  var source   = String(params.source   || 'Unknown').trim();
  var useragent= String(params.useragent|| '').trim();
  var referrer = String(params.referrer || '').trim();

  // Basic validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email' });
  }

  var ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  var leadsSheet= ss.getSheetByName(LEADS_SHEET);
  var timestamp = new Date().toISOString();

  // Write lead (silently; this must always succeed)
  try {
    if (leadsSheet) {
      leadsSheet.appendRow([timestamp, email, drug, source, useragent, referrer]);
    }
  } catch (err) { /* silent — never block the user */ }

  // Send welcome email via Resend (silent on failure)
  try {
    var category = getDrugCategory(drug);
    var template = getEmailTemplate(category, 'welcome');
    if (template && !isUnsubscribed(email, ss)) {
      sendResendEmail(email, template.subject, template.html);
      queueFollowUps(email, drug, category, timestamp, ss);
    }
  } catch (err) { /* silent */ }

  return jsonResponse({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Email helpers
// ─────────────────────────────────────────────────────────────────────────────
function isUnsubscribed(email, ss) {
  try {
    var sheet = ss.getSheetByName(UNSUB_SHEET);
    if (!sheet) return false;
    var emails = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues()
      .map(function(r) { return String(r[0]).trim().toLowerCase(); });
    return emails.indexOf(email) !== -1;
  } catch (e) { return false; }
}

function queueFollowUps(email, drug, category, baseTimestamp, ss) {
  var sheet = ss.getSheetByName(QUEUE_SHEET);
  if (!sheet) return;
  var base = new Date(baseTimestamp);
  var delays = [3, 7]; // days
  delays.forEach(function(days) {
    var sendAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    sheet.appendRow([email, drug, category, 'follow-up-' + days, sendAt, 'pending']);
  });
}

function sendResendEmail(to, subject, html) {
  var key = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
  if (!key) return;
  UrlFetchApp.fetch(RESEND_BASE_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      from: FROM_NAME + ' <' + FROM_EMAIL + '>',
      to: [to],
      subject: subject,
      html: html
    }),
    headers: { Authorization: 'Bearer ' + key }
  });
}

function getDrugCategory(drug) {
  var d = String(drug || '').toLowerCase();
  var glp1 = ['ozempic','wegovy','mounjaro','zepbound','saxenda','victoza','rybelsus',
               'trulicity','semaglutide','tirzepatide','liraglutide'];
  var cardio = ['repatha','entresto','eliquis','xarelto','brilinta','plavix','leqvio',
                'praluent','corlanor'];
  var diabetes = ['jardiance','farxiga','freestylelibre','dexcom','metformin','januvia',
                  'victoza','basaglar','apidra','afrezza','baqsimi'];
  if (glp1.some(function(k){ return d.indexOf(k) !== -1; }))      return 'glp1';
  if (cardio.some(function(k){ return d.indexOf(k) !== -1; }))    return 'cardiovascular';
  if (diabetes.some(function(k){ return d.indexOf(k) !== -1; }))  return 'diabetes';
  return 'general';
}

function getEmailTemplate(category, type) {
  // Templates are served from saverx.ai/emails/ — subject lines only needed here
  var subjects = {
    'glp1-welcome':             'Your Ozempic/GLP-1 savings card is ready',
    'cardiovascular-welcome':   'Your heart medication savings — next steps',
    'diabetes-welcome':         'Your diabetes medication savings card',
    'general-welcome':          'Your SaveRx.ai savings card is ready'
  };
  var key = category + '-' + type;
  var subject = subjects[key] || subjects['general-welcome'];
  var htmlUrl = 'https://saverx.ai/emails/' + category + '-' + type + '.html';
  try {
    var resp = UrlFetchApp.fetch(htmlUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      return { subject: subject, html: resp.getContentText() };
    }
  } catch(e) {}
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled follow-up processor  (run via hourly trigger)
// ─────────────────────────────────────────────────────────────────────────────
function processFollowUps() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(QUEUE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;

  var data = sheet.getDataRange().getValues();
  var now  = new Date();

  for (var i = 1; i < data.length; i++) {
    var row      = data[i];
    var email    = String(row[0] || '').trim();
    var drug     = String(row[1] || '');
    var category = String(row[2] || '');
    var seqType  = String(row[3] || '');
    var sendAt   = new Date(row[4]);
    var status   = String(row[5] || '').toLowerCase();

    if (status !== 'pending') continue;
    if (sendAt > now) continue;
    if (isUnsubscribed(email, ss)) {
      sheet.getRange(i + 1, 6).setValue('unsubscribed');
      continue;
    }

    try {
      var template = getEmailTemplate(category, seqType);
      if (template) sendResendEmail(email, template.subject, template.html);
      sheet.getRange(i + 1, 6).setValue('sent');
    } catch(err) {
      sheet.getRange(i + 1, 6).setValue('error: ' + err.message);
    }
  }
}

/**
 * Run once in the Apps Script editor to install the hourly trigger.
 */
function createHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processFollowUps') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processFollowUps')
    .timeBased().everyHours(1).create();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function parseCurrency(val) {
  if (val === '' || val === null || val === undefined) return null;
  var n = Number(String(val).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toSlug(name) {
  return String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
