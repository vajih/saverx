/**
 * SaveRx.ai - Google Apps Script Backend (Code.gs)
 *
 * Handles form POST from drug pages:
 *   1. Logs to Google Sheet (audit log)
 *   2. Sends welcome email via Resend.com immediately
 *   3. Queues follow-up emails (day 3, day 7) in EmailQueue sheet
 *
 * Time-triggered: processEmailQueue() runs hourly to send due follow-ups.
 *
 * Setup - Script Properties (Project Settings > Script Properties):
 *   RESEND_API_KEY = re_...
 *
 * After deploying, create a time trigger:
 *   Triggers > Add Trigger > processEmailQueue > Time-driven > Hour timer > Every hour
 */

// --- Config ---

var SHEET_ID = "19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE";
var SHEET_NAME = "CopayEnrollments";
var QUEUE_SHEET = "EmailQueue";
var HONEYPOT = "website";
var FROM_EMAIL = "SaveRx.ai <hello@newsletter.saverx.ai>";
var EMAIL_BASE_URL = "https://saverx.ai/emails/";
var SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec";
var UNSUB_SHEET = "Unsubscribes";

// --- Drug category mapping ---

var DRUG_CATEGORY_MAP = {
  glp1: [
    "ozempic",
    "wegovy",
    "mounjaro",
    "zepbound",
    "trulicity",
    "victoza",
    "saxenda",
    "rybelsus",
    "semaglutide",
    "tirzepatide",
    "liraglutide",
  ],
  cardiovascular: [
    "repatha",
    "eliquis",
    "entresto",
    "jardiance",
    "brilinta",
    "xarelto",
    "farxiga",
    "corlanor",
    "camzyos",
    "baqsimi",
    "kevzara",
  ],
  diabetes: [
    "freestylelibre",
    "freestyle libre",
    "dexcom",
    "toujeo",
    "tresiba",
    "basaglar",
    "lantus",
    "levemir",
    "januvia",
    "invokana",
    "metformin",
    "glyxambi",
    "janumet",
    "xultophy",
  ],
};

// --- Email file + subject mapping ---

var EMAIL_FILES = {
  "glp1-welcome": "glp1-welcome.html",
  "glp1-follow-up-1": "glp1-follow-up-1.html",
  "glp1-follow-up-2": "glp1-follow-up-2.html",
  "cardiovascular-welcome": "cardiovascular-welcome.html",
  "cardiovascular-follow-up-1": "cardiovascular-follow-up-1.html",
  "cardiovascular-follow-up-2": "cardiovascular-follow-up-2.html",
  "diabetes-welcome": "diabetes-cgm-welcome.html",
  "diabetes-follow-up-1": "diabetes-cgm-follow-up-1.html",
  "diabetes-follow-up-2": "diabetes-cgm-follow-up-2.html",
  "general-welcome": "welcome.html",
  "general-follow-up-1": "follow-up-1.html",
  "general-follow-up-2": "follow-up-2.html",
};

var EMAIL_SUBJECTS = {
  welcome: "Your {drug} savings are waiting - SaveRx.ai",
  "follow-up-1": "Have you enrolled in your {drug} savings yet?",
  "follow-up-2": "Last reminder: your {drug} savings program",
};

// --- Helpers ---

function getDrugCategory(drug) {
  if (!drug || drug === "N/A" || drug.trim() === "") return "general";
  var lower = drug
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
  var cats = Object.keys(DRUG_CATEGORY_MAP);
  for (var i = 0; i < cats.length; i++) {
    var list = DRUG_CATEGORY_MAP[cats[i]];
    for (var j = 0; j < list.length; j++) {
      if (lower.indexOf(list[j]) !== -1) return cats[i];
    }
  }
  return "general";
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function applyMergeTags(html, drug, toEmail) {
  var slug = slugify(drug);
  html = html.replace(/\{\$subscriber\.fields\.drug\|slugify\}/g, slug);
  html = html.replace(/\{\$subscriber\.fields\.drug\}/g, drug);
  var unsubUrl =
    SCRIPT_URL + "?action=unsubscribe&email=" + encodeURIComponent(toEmail);
  html = html.replace(/\{\$unsubscribe\}/g, unsubUrl);
  return html;
}

function isUnsubscribed(email) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(UNSUB_SHEET);
    if (!sheet) return false;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === email) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// --- Resend ---

function sendResendEmail(toEmail, drug, category, type) {
  try {
    var apiKey =
      PropertiesService.getScriptProperties().getProperty("RESEND_API_KEY");
    if (!apiKey) {
      Logger.log("Resend: No RESEND_API_KEY in Script Properties");
      return false;
    }

    var fileKey = category + "-" + type;
    var filename = EMAIL_FILES[fileKey];
    if (!filename) {
      Logger.log("Resend: Unknown email key: " + fileKey);
      return false;
    }

    // Fetch email HTML template from Cloudflare Pages
    var templateUrl = EMAIL_BASE_URL + filename;
    var tmplRes = UrlFetchApp.fetch(templateUrl, { muteHttpExceptions: true });
    if (tmplRes.getResponseCode() !== 200) {
      Logger.log(
        "Resend: Template fetch failed " +
          templateUrl +
          " (" +
          tmplRes.getResponseCode() +
          ")",
      );
      return false;
    }

    // Substitute drug name + unsubscribe URL
    var html = applyMergeTags(tmplRes.getContentText(), drug, toEmail);
    var subject = EMAIL_SUBJECTS[type].replace(/\{drug\}/g, drug);

    var res = UrlFetchApp.fetch("https://api.resend.com/emails", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + apiKey },
      payload: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: subject,
        html: html,
      }),
      muteHttpExceptions: true,
    });

    var code = res.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log("Resend: OK " + type + " -> " + toEmail + " [" + drug + "]");
      return true;
    } else {
      Logger.log(
        "Resend: Error " +
          code +
          " for " +
          toEmail +
          " -- " +
          res.getContentText(),
      );
      return false;
    }
  } catch (e) {
    Logger.log("Resend: Exception -- " + e.toString());
    return false;
  }
}

// --- Follow-up queue ---

function queueFollowUps(email, drug, category) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(QUEUE_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(QUEUE_SHEET);
      sheet.appendRow([
        "email",
        "drug",
        "category",
        "type",
        "send_at",
        "sent_at",
        "status",
      ]);
      sheet.setFrozenRows(1);
    }
    var now = new Date();
    var d3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    var d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    sheet.appendRow([
      email,
      drug,
      category,
      "follow-up-1",
      d3.toISOString(),
      "",
      "pending",
    ]);
    sheet.appendRow([
      email,
      drug,
      category,
      "follow-up-2",
      d7.toISOString(),
      "",
      "pending",
    ]);
  } catch (e) {
    Logger.log("queueFollowUps error: " + e.toString());
  }
}

/**
 * Runs on an hourly time trigger.
 * Sends follow-up emails that are due and marks them sent/failed.
 * Setup: Triggers > Add Trigger > processEmailQueue > Time-driven > Hour timer > Every hour
 */
function processEmailQueue() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(QUEUE_SHEET);
    if (!sheet) return;

    var now = new Date();
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var email = row[0];
      var drug = row[1];
      var category = row[2];
      var type = row[3];
      var sendAt = new Date(row[4]);
      var status = row[6];

      if (status !== "pending") continue;
      if (sendAt > now) continue;
      if (isUnsubscribed(email)) {
        sheet.getRange(i + 1, 7).setValue("unsubscribed");
        continue;
      }

      var sent = sendResendEmail(email, drug, category, type);
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      sheet.getRange(i + 1, 7).setValue(sent ? "sent" : "failed");
    }
  } catch (e) {
    Logger.log("processEmailQueue error: " + e.toString());
  }
}

// --- One-time setup ---

/**
 * Run this ONCE from the Apps Script editor to install the hourly trigger.
 * Editor: select "createHourlyTrigger" from the function dropdown → Run.
 * Safe to re-run — skips if trigger already exists.
 */
function createHourlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processEmailQueue") {
      Logger.log("Trigger already exists — skipping.");
      return;
    }
  }
  ScriptApp.newTrigger("processEmailQueue").timeBased().everyHours(1).create();
  Logger.log("Hourly trigger created for processEmailQueue.");
}

// --- Core handlers ---

function doGet(e) {
  // ── Individual drug lookup ───────────────────────────────────────────────
  if (e && e.parameter && e.parameter.mode === "drug") {
    try {
      var slug = String(e.parameter.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/, "");
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName("Featured");
      var item = null;
      if (sheet && slug) {
        var rows = sheet.getDataRange().getValues();
        var headers = rows[0].map(function (h) {
          return String(h).trim().toLowerCase();
        });
        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var rec = {};
          headers.forEach(function (h, idx) {
            rec[h] = row[idx];
          });
          var nameSlug = String(rec["name"] || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/, "");
          if (nameSlug === slug) {
            item = {
              brand: String(rec["name"] || "").trim(),
              generic: String(rec["generic"] || "").trim(),
              manufacturer: String(rec["manufacturer"] || "").trim(),
              cash_price:
                rec["cash_price"] !== "" ? Number(rec["cash_price"]) : null,
              copay_price:
                rec["as_low_as"] !== "" ? Number(rec["as_low_as"]) : null,
              manufacturerUrl: String(rec["url"] || "").trim(),
            };
            break;
          }
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ item: item }),
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ item: null, error: err.toString() }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── Featured drugs feed ──────────────────────────────────────────────────
  if (e && e.parameter && e.parameter.mode === "featured") {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName("Featured");
      if (!sheet) throw new Error("Featured sheet not found");
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function (h) {
        return String(h).trim().toLowerCase();
      });
      var items = [];
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var rec = {};
        headers.forEach(function (h, idx) {
          rec[h] = row[idx];
        });
        // Skip rows where active is explicitly FALSE
        var activeVal = String(rec["active"]).trim().toUpperCase();
        if (activeVal === "FALSE" || activeVal === "0") continue;
        items.push({
          name: String(rec["name"] || "").trim(),
          generic: String(rec["generic"] || "").trim(),
          manufacturer: String(rec["manufacturer"] || "").trim(),
          cash_price:
            rec["cash_price"] !== "" ? Number(rec["cash_price"]) : null,
          as_low_as: rec["as_low_as"] !== "" ? Number(rec["as_low_as"]) : null,
          url: String(rec["url"] || "").trim(),
          priority: rec["priority"] !== "" ? Number(rec["priority"]) : 999,
          active: true,
        });
      }
      // Sort by priority ascending
      items.sort(function (a, b) {
        return a.priority - b.priority;
      });
      var output = ContentService.createTextOutput(
        JSON.stringify({ items: items }),
      ).setMimeType(ContentService.MimeType.JSON);
      return output;
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: err.toString(), items: [] }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (e && e.parameter && e.parameter.action === "unsubscribe") {
    var email = (e.parameter.email || "").trim().toLowerCase();
    if (email && email.indexOf("@") !== -1) {
      try {
        var ss = SpreadsheetApp.openById(SHEET_ID);
        var sheet = ss.getSheetByName(UNSUB_SHEET);
        if (!sheet) {
          sheet = ss.insertSheet(UNSUB_SHEET);
          sheet.appendRow(["email", "unsubscribed_at"]);
          sheet.setFrozenRows(1);
        }
        if (!isUnsubscribed(email)) {
          sheet.appendRow([email, new Date().toISOString()]);
        }
        Logger.log("Unsubscribed: " + email);
      } catch (err) {
        Logger.log("Unsubscribe error: " + err.toString());
      }
      return HtmlService.createHtmlOutput(
        '<html><head><meta charset="utf-8"><title>Unsubscribed - SaveRx.ai</title>' +
          "<style>body{font-family:sans-serif;text-align:center;padding:80px 20px;color:#333;}" +
          "h1{color:#0b2a4e;font-size:28px;}p{color:#64748b;font-size:16px;margin:12px 0;}" +
          "a{color:#3b82f6;}</style></head><body>" +
          "<h1>You've been unsubscribed</h1>" +
          "<p>You won't receive any more emails from SaveRx.ai.</p>" +
          '<p><a href="https://saverx.ai">Return to SaveRx.ai</a></p>' +
          "</body></html>",
      );
    }
  }
  return ContentService.createTextOutput("OK");
}

function doPost(e) {
  var sheetErr = null;
  var emailResult = null;
  try {
    if (!e || !e.parameter)
      return ContentService.createTextOutput("No payload");

    var p = e.parameter;

    // Honeypot - bots fill hidden 'website' field
    if (p[HONEYPOT] && p[HONEYPOT].trim() !== "")
      return ContentService.createTextOutput("Ignored");

    var email = (p.email || "").trim().toLowerCase();
    var drug = (p.drug || p.medication || "N/A").trim();
    var source = (p.source || "unknown").trim();
    var ts = new Date().toISOString();

    if (!email || email.indexOf("@") === -1)
      return ContentService.createTextOutput("Invalid email");

    // 1. Write to Google Sheet (always - audit log)
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
      sheet.appendRow([ts, email, drug, source, p["user-agent"] || ""]);
    } catch (err) {
      sheetErr = err.toString();
      Logger.log("Sheet error: " + sheetErr);
    }

    // 2. Send welcome email via Resend (skip if previously unsubscribed)
    var category = getDrugCategory(drug);
    if (!isUnsubscribed(email)) {
      emailResult = sendResendEmail(email, drug, category, "welcome");
    }

    // 3. Queue follow-up emails (day 3, day 7)
    queueFollowUps(email, drug, category);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "ok",
        sheetError: sheetErr,
        emailSent: emailResult,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Diagnostics (run from editor to verify setup) ---

/**
 * Run from editor to confirm Google Sheet + Resend are configured correctly.
 * Select "testConnection" in the function dropdown → Run → view Execution log.
 */
function testConnection() {
  var result = { sheet: null, sheetError: null, resendKey: null, tabs: [] };

  // Test sheet access
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    result.sheet = ss.getName();
    result.tabs = ss.getSheets().map(function (s) {
      return s.getName();
    });
  } catch (e) {
    result.sheetError = e.toString();
  }

  // Test Resend key presence (don't log the key itself)
  var key =
    PropertiesService.getScriptProperties().getProperty("RESEND_API_KEY");
  result.resendKey = key ? "SET (length " + key.length + ")" : "NOT SET";

  Logger.log("testConnection result: " + JSON.stringify(result));
  return result;
}

/**
 * Simulates a real form POST from a drug page.
 * Run from editor to add a test row to the sheet + send a test email.
 * Select "testPostSimulation" → Run → check Execution log + Google Sheet.
 */
function testPostSimulation() {
  var fakeEvent = {
    parameter: {
      email: "test-simulation@saverx.ai",
      drug: "Ozempic",
      source: "Editor Test Simulation",
    },
  };
  var result = doPost(fakeEvent);
  Logger.log("testPostSimulation result: " + result.getContent());
}
