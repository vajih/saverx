/** Dedicated Experts contact backend. No legacy lead/email routes. */
var SHEET_ID = "1Dxv5Oz96CAdQzXdqtmHHiPavn1ctSduTci5P6qFcj-w";
function doGet(e) {
  if (e && e.parameter && e.parameter.mode === 'experts_health') return expertContactResponse({status:'ok', version:EXPERT_CONTACT_VERSION});
  return expertContactResponse({status:'error', saved:false, message:'Unsupported request.'});
}
function doPost(e) {
  if (!e || !e.parameter) return expertContactResponse({status:'error', saved:false, message:'Missing form data.'});
  return handleExpertContact(e);
}
// --- Experts initial-contact forms: isolated from existing lead/email routes. ---
var EXPERT_CONTACT_VERSION = 'experts-v1';
var EXPERT_CONTACT_HEADERS = ['submission_id', 'submitted_at', 'submission_type', 'name', 'email', 'selected_topic_or_expertise', 'notes', 'source_page'];
var EXPERT_CONTACT_TOPICS = {
  expert_request: ['Medication affordability', 'Prior authorization delays or denials', 'Insurance & patient access', 'Medication education', 'Imaging education'],
  expert_signup: ['Pharmacy', 'Radiology', 'Nursing', 'Pharmacy technology', 'Patient access', 'Healthcare operations', 'Other']
};
function expertContactResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function handleExpertContact(e) {
  var p = e.parameter || {};
  var allowed = ['form_type', 'submission_id', 'submission_type', 'name', 'email', 'selected_topic_or_expertise', 'notes', 'source_page', 'website'];
  var fail = function(message) { return expertContactResponse({status:'error', saved:false, message:message}); };
  if (Object.keys(p).some(function(key) { return allowed.indexOf(key) === -1 || typeof p[key] !== 'string'; })) return fail('Please reload the page and try again.');
  if (e.parameters && Object.keys(e.parameters).some(function(key) { return e.parameters[key].length !== 1; })) return fail('Invalid form fields.');
  if (String(p.website || '').trim()) return fail('We could not accept this request.');
  if (p.form_type !== 'experts_contact' || ['expert_request','expert_signup'].indexOf(p.submission_type) === -1) return fail('Invalid submission type.');
  if ((p.name || '').length > 100 || (p.email || '').length > 254 || (p.notes || '').length > 1500) return fail('One or more fields exceed the allowed length.');
  var id = p.submission_id || '';
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return fail('Invalid submission ID. Please reopen the form.');
  var name = String(p.name || '').trim(), email = String(p.email || '').trim().toLowerCase();
  var topic = String(p.selected_topic_or_expertise || ''), notes = String(p.notes || '').trim();
  if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) return fail('Enter a name of up to 100 characters.');
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return fail('Enter a valid email address.');
  if (EXPERT_CONTACT_TOPICS[p.submission_type].indexOf(topic) === -1) return fail('Choose one of the listed topics.');
  if (notes.length > 1500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notes)) return fail('Use up to 1500 characters for your note.');
  if (p.source_page !== '/experts/') return fail('Invalid source page.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return fail('We are busy. Please retry; your entries are still here.');
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tab = p.submission_type === 'expert_request' ? 'Expert Requests' : 'Expert Signups';
    var sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
    if (!sheet.getLastRow()) {
      sheet.appendRow(EXPERT_CONTACT_HEADERS.slice());
      sheet.setFrozenRows(1);
    }
    var rows = sheet.getDataRange().getValues();
    if (JSON.stringify(rows[0]) !== JSON.stringify(EXPERT_CONTACT_HEADERS)) return fail('The contact form needs a configuration update. Please contact help@saverx.ai.');
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === id) return expertContactResponse({status:'ok', saved:true, submission_id:id, sheet:tab, submitted_at:String(rows[i][1]), duplicate:true});
    }
    // Plain-text formatting AND apostrophe escaping stop Sheets formula evaluation.
    // IDs, timestamps, and type are server-validated; all visitor strings are escaped.
    var text = function(value) { return "'" + value; };
    var row = [id, new Date().toISOString(), p.submission_type, text(name), text(email), text(topic), text(notes), text('/experts/')];
    var savedRow = sheet.getLastRow()+1;
    sheet.getRange(savedRow, 1, 1, EXPERT_CONTACT_HEADERS.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
    var confirmed = sheet.getRange(savedRow, 1, 1, EXPERT_CONTACT_HEADERS.length).getValues()[0];
    if (String(confirmed[0]) !== id || String(confirmed[2]) !== p.submission_type) throw new Error('Save not confirmed');
    return expertContactResponse({status:'ok', saved:true, submission_id:id, sheet:tab, submitted_at:String(confirmed[1]), duplicate:false});
  } catch (err) {
    // Do not echo spreadsheet details, credentials, or contact information.
    Logger.log('Expert contact save failed.');
    return fail('We could not confirm your submission was saved. Please retry with the same form.');
  } finally { lock.releaseLock(); }
}
