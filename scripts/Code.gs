/**
 * SaveRx.ai — Google Apps Script Backend (Code.gs)
 *
 * Handles form POST submissions from the SaveRx.ai email capture modal.
 * - Logs submissions to Google Sheet (existing behavior)
 * - Adds subscriber to MailerLite with drug-based group routing (new)
 *
 * Setup:
 *   Project Settings → Script Properties → Add:
 *     MAILERLITE_API_KEY = your_mailerlite_api_key
 *
 *   Fill in MAILERLITE_GROUPS below after running mailerlite-setup.js
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const SHEET_ID = "19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE";
const SHEET_NAME = "CopayEnrollments";
const HONEYPOT = "website";

const MAILERLITE_GROUPS = {
  glp1: "183927822827390173",
  cardiovascular: "183927823137768840",
  diabetes: "183927823403058777",
  general: "183927823647377106",
  all: "183927823896938337",
};

// ─── Drug category mapping ────────────────────────────────────────────────────
const DRUG_CATEGORY_MAP = {
  glp1: [
    "ozempic",
    "wegovy",
    "mounjaro",
    "trulicity",
    "victoza",
    "saxenda",
    "rybelsus",
    "semaglutide",
    "tirzepatide",
  ],
  cardiovascular: [
    "repatha",
    "eliquis",
    "entresto",
    "jardiance",
    "baqsimi",
    "corlanor",
    "kevzara",
    "vimpat",
    "trulance",
  ],
  diabetes: [
    "freestylelibre",
    "freestyle libre",
    "toujeo",
    "dymista",
    "xultophy",
    "tresiba",
    "basaglar",
    "lantus",
    "levemir",
    "januvia",
    "farxiga",
    "invokana",
  ],
};

function getDrugCategory(drug) {
  if (!drug || drug === "N/A" || drug.trim() === "") return "general";
  var lower = drug.toLowerCase().replace(/[®™]/g, "").trim();
  var categories = Object.keys(DRUG_CATEGORY_MAP);
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var drugs = DRUG_CATEGORY_MAP[cat];
    for (var j = 0; j < drugs.length; j++) {
      if (lower.indexOf(drugs[j]) !== -1) return cat;
    }
  }
  return "general";
}

// ─── MailerLite integration ───────────────────────────────────────────────────
function addToMailerLite(email, drug, source) {
  try {
    var apiKey =
      PropertiesService.getScriptProperties().getProperty("MAILERLITE_API_KEY");
    if (!apiKey) {
      Logger.log("MailerLite: No API key set in Script Properties");
      return;
    }

    var category = getDrugCategory(drug);
    var groupIds = [];
    if (MAILERLITE_GROUPS[category]) groupIds.push(MAILERLITE_GROUPS[category]);
    if (MAILERLITE_GROUPS["all"]) groupIds.push(MAILERLITE_GROUPS["all"]);

    var payload = {
      email: email,
      fields: {
        drug: drug || "N/A",
        lead_source: source || "unknown",
        drug_category: category,
      },
      groups: groupIds,
      status: "active",
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(
      "https://connect.mailerlite.com/api/subscribers",
      options,
    );
    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code === 200 || code === 201) {
      Logger.log("MailerLite: Added " + email + " to group " + category);
    } else {
      Logger.log("MailerLite: Error " + code + " for " + email + " — " + body);
    }
  } catch (e) {
    // Never block the main flow — just log
    Logger.log("MailerLite: Exception — " + e.toString());
  }
}

// ─── Core handlers ────────────────────────────────────────────────────────────
function doGet() {
  return ContentService.createTextOutput("OK");
}

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return ContentService.createTextOutput("No payload");
    }

    var p = e.parameter;

    // Honeypot check — bots fill the hidden 'website' field
    if (p[HONEYPOT] && p[HONEYPOT].trim() !== "") {
      return ContentService.createTextOutput("Ignored");
    }

    var email = (p.email || "").trim().toLowerCase();
    var drug = (p.drug || p.medication || "N/A").trim();
    var source = (p.source || "unknown").trim();
    var ts = new Date().toISOString();

    // Basic email validation
    if (!email || email.indexOf("@") === -1) {
      return ContentService.createTextOutput("Invalid email");
    }

    // 1. Write to Google Sheet (existing behavior — keep audit log)
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        ts,
        email,
        drug,
        source,
        e.parameter["user-agent"] || "",
      ]);
    } catch (sheetErr) {
      Logger.log("Sheet error: " + sheetErr.toString());
    }

    // 2. Add to MailerLite (new — runs after sheet write)
    addToMailerLite(email, drug, source);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
