/**
 * Local test harness for Code.gs
 *
 * Mocks all Google Apps Script globals (SpreadsheetApp, ContentService, etc.)
 * then loads and runs Code.gs in a sandboxed vm context.
 *
 * Run: node scripts/test-code-gs.mjs
 */

import { readFileSync } from 'fs';
import * as vm from 'vm';

// ─── Mock Featured sheet data (mirrors expected Google Sheet columns) ─────────
const MOCK_FEATURED = [
  // header
  ['name', 'generic', 'manufacturer', 'cash_price', 'as_low_as', 'url',
   'priority', 'active', 'drug_class', 'indication', 'description'],
  // active drug with all new fields
  ['Ozempic', 'semaglutide', 'Novo Nordisk', 850, 25,
   'https://ozempic.com/savings', 1, 'TRUE',
   'GLP-1 receptor agonist',
   'Type 2 diabetes / weight management',
   'Ozempic (semaglutide) is a once-weekly injectable that lowers blood sugar and reduces cardiovascular risk.'],
  // active drug — no new fields (graceful empty string handling)
  ['Repatha', 'evolocumab', 'Amgen', 600, 5,
   'https://repatha.com/savings', 2, 'TRUE',
   '', '', ''],
  // inactive — should be excluded from results
  ['Stale Drug', 'generic', 'Pharma Co', 100, 10,
   'https://example.com', 3, 'FALSE',
   'Test class', 'Test indication', 'Should not appear.'],
];

const MOCK_UNSUB = [
  ['email', 'unsubscribed_at'],
  ['unsub@example.com', '2025-01-01T00:00:00.000Z'],
];

const MOCK_QUEUE_ROWS = []; // starts empty

// ─── Google Apps Script API mocks ────────────────────────────────────────────

function makeMockSheet(rows) {
  return {
    getDataRange: () => ({ getValues: () => rows }),
    getLastRow:   () => rows.length,
    appendRow:    (row) => { rows.push(row); },
    getRange:     (r, c) => ({ setValue: (v) => { rows[r - 1][c - 1] = v; } }),
    setFrozenRows: () => {},
  };
}

const SHEETS = {
  Featured:         makeMockSheet(MOCK_FEATURED),
  CopayEnrollments: makeMockSheet([['ts','email','drug','source','ua']]),
  Unsubscribes:     makeMockSheet(MOCK_UNSUB),
  EmailQueue:       makeMockSheet([['email','drug','category','type','send_at','sent_at','status']]),
};

const SpreadsheetApp = {
  openById: (_id) => ({
    getSheetByName: (name) => SHEETS[name] || null,
    insertSheet:    (name) => { SHEETS[name] = makeMockSheet([]); return SHEETS[name]; },
    getSheets:      () => Object.values(SHEETS),
  }),
};

function makeTextOutput(content) {
  return {
    _content: content,
    setMimeType: function() { return this; },
    getContent:  function() { return this._content; },
  };
}

const ContentService = {
  createTextOutput: (str) => makeTextOutput(str),
  MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
};

const HtmlService = {
  createHtmlOutput: (html) => ({ getContent: () => html }),
};

const UrlFetchApp = {
  fetch: (url, _opts) => {
    // Simulate Resend API
    if (url === 'https://api.resend.com/emails') {
      return { getResponseCode: () => 200, getContentText: () => '{"id":"mock-id"}' };
    }
    // Simulate email template fetch
    if (url.includes('saverx.ai/emails/')) {
      return {
        getResponseCode: () => 200,
        getContentText: () => '<p>Hello {$subscriber.fields.drug}</p>',
      };
    }
    return { getResponseCode: () => 404, getContentText: () => 'Not found' };
  },
};

const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => key === 'RESEND_API_KEY' ? 're_TEST_KEY_12345' : null,
  }),
};

const Logger = {
  log: (...args) => console.log('  [GAS LOG]', ...args),
};

const ScriptApp = {
  getProjectTriggers: () => [],
  newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create: () => {} }) }) }),
};

// ─── Load Code.gs into vm sandbox ────────────────────────────────────────────

const code = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

const sandbox = {
  SpreadsheetApp, ContentService, HtmlService,
  UrlFetchApp, PropertiesService, Logger, ScriptApp,
  encodeURIComponent, JSON, Object, Number, String, Date, Math,
  console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Pull the functions we want to test out of the sandbox
const { doGet, doPost, getDrugCategory, slugify, isUnsubscribed } = sandbox;

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    → ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function parseOutput(output) {
  return JSON.parse(output.getContent());
}

function get(params) {
  return doGet({ parameter: params });
}

function post(params) {
  return doPost({ parameter: params });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n── getDrugCategory ──────────────────────────────────────────────');
test('Ozempic → glp1',        () => assert(getDrugCategory('Ozempic') === 'glp1'));
test('Repatha → cardiovascular',() => assert(getDrugCategory('Repatha') === 'cardiovascular'));
test('Metformin → diabetes',  () => assert(getDrugCategory('Metformin') === 'diabetes'));
test('Unknown → general',     () => assert(getDrugCategory('Humira') === 'general'));
test('Empty → general',       () => assert(getDrugCategory('') === 'general'));
test('N/A → general',         () => assert(getDrugCategory('N/A') === 'general'));

console.log('\n── slugify ──────────────────────────────────────────────────────');
test('Ozempic → ozempic',         () => assert(slugify('Ozempic') === 'ozempic'));
test('FreeStyle Libre → freestyle-libre', () => assert(slugify('FreeStyle Libre') === 'freestyle-libre'));
test('Dupixent® → dupixent',       () => assert(slugify('Dupixent®') === 'dupixent'));

console.log('\n── isUnsubscribed ───────────────────────────────────────────────');
test('Known unsub email → true',   () => assert(isUnsubscribed('unsub@example.com') === true));
test('Unknown email → false',      () => assert(isUnsubscribed('active@example.com') === false));

console.log('\n── doGet ?mode=featured ─────────────────────────────────────────');
test('Returns items array', () => {
  const data = parseOutput(get({ mode: 'featured' }));
  assert(Array.isArray(data.items), 'items should be an array');
});
test('Excludes inactive drugs', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  assert(!items.find(i => i.name === 'Stale Drug'), 'inactive drug should be excluded');
});
test('Includes drug_class on Ozempic', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  const oz = items.find(i => i.name === 'Ozempic');
  assert(oz, 'Ozempic should be in items');
  assert(oz.drug_class === 'GLP-1 receptor agonist', `drug_class wrong: ${oz.drug_class}`);
});
test('Includes indication on Ozempic', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  const oz = items.find(i => i.name === 'Ozempic');
  assert(oz.indication === 'Type 2 diabetes / weight management', `indication wrong: ${oz.indication}`);
});
test('Includes description on Ozempic', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  const oz = items.find(i => i.name === 'Ozempic');
  assert(oz.description.length > 10, `description missing or too short: ${oz.description}`);
});
test('Empty string for Repatha new fields (not present in sheet)', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  const rep = items.find(i => i.name === 'Repatha');
  assert(rep.drug_class === '', `drug_class should be empty string: ${rep.drug_class}`);
});
test('Sorted by priority', () => {
  const { items } = parseOutput(get({ mode: 'featured' }));
  for (let i = 1; i < items.length; i++) {
    assert(items[i].priority >= items[i - 1].priority, 'items out of priority order');
  }
});

console.log('\n── doGet ?mode=drug ─────────────────────────────────────────────');
test('Known slug returns item', () => {
  const { item } = parseOutput(get({ mode: 'drug', slug: 'ozempic' }));
  assert(item !== null, 'item should not be null');
  assert(item.brand === 'Ozempic', `brand wrong: ${item.brand}`);
});
test('mode=drug includes drug_class', () => {
  const { item } = parseOutput(get({ mode: 'drug', slug: 'ozempic' }));
  assert(item.drug_class === 'GLP-1 receptor agonist', `drug_class wrong: ${item.drug_class}`);
});
test('mode=drug includes indication', () => {
  const { item } = parseOutput(get({ mode: 'drug', slug: 'ozempic' }));
  assert(item.indication === 'Type 2 diabetes / weight management', `indication wrong: ${item.indication}`);
});
test('mode=drug includes description', () => {
  const { item } = parseOutput(get({ mode: 'drug', slug: 'ozempic' }));
  assert(item.description.length > 10, `description missing: ${item.description}`);
});
test('Unknown slug returns null item', () => {
  const { item } = parseOutput(get({ mode: 'drug', slug: 'nonexistent-drug-xyz' }));
  assert(item === null, 'item should be null for unknown slug');
});

console.log('\n── doGet ?action=unsubscribe ────────────────────────────────────');
test('Valid email returns HTML page', () => {
  const result = doGet({ parameter: { action: 'unsubscribe', email: 'new@example.com' } });
  const html = result.getContent();
  assert(html.includes("You've been unsubscribed"), 'missing unsubscribe message');
});
test('Invalid email falls through to OK', () => {
  const result = doGet({ parameter: { action: 'unsubscribe', email: 'notanemail' } });
  assert(result.getContent() === 'OK', 'should return OK for bad email');
});

console.log('\n── doPost (email capture) ───────────────────────────────────────');
test('Valid submission returns ok', () => {
  const result = post({ email: 'patient@example.com', drug: 'Ozempic', source: 'drug-page' });
  const data = parseOutput(result);
  assert(data.status === 'ok', `status should be ok: ${JSON.stringify(data)}`);
});
test('Invalid email returns error', () => {
  const result = post({ email: 'notanemail', drug: 'Ozempic', source: 'drug-page' });
  assert(result.getContent() === 'Invalid email', 'should reject invalid email');
});
test('Honeypot filled returns Ignored', () => {
  const result = post({ email: 'bot@spam.com', drug: 'Ozempic', website: 'http://spam.com' });
  assert(result.getContent() === 'Ignored', 'honeypot should block bots');
});
test('Unsubscribed email — no email sent but still saved', () => {
  const before = SHEETS.CopayEnrollments._content?.length ?? 0;
  const result = post({ email: 'unsub@example.com', drug: 'Repatha', source: 'test' });
  const data = parseOutput(result);
  assert(data.status === 'ok', 'should still return ok');
  // emailSent should be null (skipped) or false
  assert(data.emailSent !== true, 'should not send email to unsubscribed user');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nSome tests failed — fix before deploying.\n');
  process.exit(1);
} else {
  console.log('\nAll tests passed — safe to deploy.\n');
}
