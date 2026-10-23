/**
 * SaveRx.ai — Enrollment Help intake (demand-validation test)
 * Drives /get-help/ : quiz-style intake, GA4 funnel events, POST to Apps Script.
 *
 * Privacy rules (do not break):
 *  - GA4 events carry CATEGORICAL values only (drug_slug, step ids, tier).
 *  - email / phone / free text go ONLY to the Apps Script backend, never to gtag.
 */
(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  var FORM_API = window.SAVERX_FORM_API ||
    "https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec";

  // Stripe Payment Links — paste live links here once created in the Stripe
  // dashboard. While empty, paid tiers fall back to a no-charge reservation
  // (tier selection + intake are still recorded; checkout events are skipped).
  var STRIPE_LINKS = {
    paid_999: "",   // e.g. "https://buy.stripe.com/XXXX"  ($9.99 guided enrollment)
    paid_1999: ""   // e.g. "https://buy.stripe.com/YYYY"  ($19.99 guided + follow-up)
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {}
  }

  // PII-free funnel beacon → EventLog tab (works even when analytics consent is denied,
  // because it carries no identifiers — event name + drug slug only)
  function beacon(ev, extra) {
    try {
      new Image().src = FORM_API + "?mode=track&ev=" + encodeURIComponent(ev) +
        "&slug=" + encodeURIComponent(state.drug_slug || "none") +
        (extra ? "&x=" + encodeURIComponent(extra) : "") + "&t=" + Date.now();
    } catch (_) {}
  }

  function uuid() {
    try { return crypto.randomUUID(); }
    catch (_) {
      var s = ""; for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
  }

  var qs = new URLSearchParams(location.search);
  var state = {
    intake_id: uuid(),
    drug_slug: (qs.get("drug") || "").toLowerCase().replace(/[^a-z0-9-]/g, ""),
    drug_brand: "",
    insurance_category: "",
    prescription_status: "",
    primary_difficulty: "",
    difficulty_text: "",
    service_preference: "",
    checkout_result: "not_offered",
    started: false,
    submitted: false
  };

  function prettyName(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function updateDrugLabels() {
    $$("[data-drug-name]").forEach(function (el) {
      el.textContent = state.drug_brand || "your medication";
    });
  }

  function postIntake() {
    var body = new URLSearchParams({
      form_type: "enroll_intake",
      intake_id: state.intake_id,
      email: state.email || "",
      phone: state.phone || "",
      drug: state.drug_brand || prettyName(state.drug_slug || "") || "N/A",
      drug_slug: state.drug_slug || "",
      insurance_category: state.insurance_category,
      prescription_status: state.prescription_status,
      primary_difficulty: state.primary_difficulty,
      difficulty_text: state.difficulty_text || "",
      service_preference: state.service_preference,
      checkout_result: state.checkout_result,
      consent_contact: state.consent_contact ? "yes" : "no",
      consent_sms: state.consent_sms ? "yes" : "no",
      visitor_id: (function () { try { return localStorage.getItem("saverx_visitor_id") || ""; } catch (_) { return ""; } })(),
      source: "Enrollment Intake",
      source_page: document.referrer || "",
      utm_source: qs.get("utm_source") || "",
      utm_medium: qs.get("utm_medium") || "",
      utm_campaign: qs.get("utm_campaign") || "",
      useragent: navigator.userAgent || "",
      website: $("#hp") ? $("#hp").value : "" // honeypot
    }).toString();

    try {
      if (navigator.sendBeacon && navigator.sendBeacon(FORM_API, new Blob([body], { type: "application/x-www-form-urlencoded" }))) return Promise.resolve();
      return fetch(FORM_API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, mode: "no-cors", body: body, keepalive: true });
    } catch (error) { return Promise.reject(error); }
  }

  var ORDER = ["insurance", "difficulty", "preference", "contact", "checkout", "done"];
  var current = "insurance";
  var busy = false;
  var items = [];
  var labels = {free_self:"Free self-service checklist",free_only:"Free help only",paid_999:"Guided enrollment · $9.99 service fee",paid_1999:"Guidance + follow-up · $19.99 service fee"};
  var insuranceLabels = {commercial:"Private insurance",medicare:"Medicare",medicaid:"Medicaid / CHIP",uninsured:"No insurance",unsure:"Insurance not sure"};
  function isPaid() { return state.service_preference.indexOf("paid") === 0; }
  function show(id, focus) {
    $$("[data-step]").forEach(function(el){el.hidden=el.getAttribute("data-step")!==id;});
    current=id;
    var idx=ORDER.indexOf(id),stage=idx<2?0:idx===2?1:2;
    $$("[data-stage]").forEach(function(el,i){
      el.removeAttribute("aria-current");
      if(i===stage)el.setAttribute("aria-current","step");
      el.classList.toggle("completed",i<stage);
    });
    var pct=[10,30,55,80,100,100][idx];
    $("#progressBar").style.width=pct+"%";
    $(".progress").setAttribute("aria-valuenow",String(pct));
    if(id==="preference") {
      var gov=state.insurance_category==="medicare"||state.insurance_category==="medicaid";
      $("#routeNote").textContent=gov?"For your coverage, we’ll look at assistance routes rather than manufacturer copay cards. Help does not guarantee eligibility.":state.insurance_category==="uninsured"?"Without insurance, we can help explore patient assistance or cash-price resources. Availability varies by medication.":"We’ll use your coverage and situation to help identify the next steps to explore. The program makes the final eligibility decision.";
    }
    if(id==="contact") {
      $("#recapDrug").textContent=state.drug_brand+" · "+insuranceLabels[state.insurance_category];
      $("#recapService").textContent=labels[state.service_preference];
      $("#contactIntro").textContent=isPaid()?"A guide will review your request and follow up by email, usually within 1 business day.":"Get a confirmation by email and start with your free steps on the next screen.";
      $("#submitIntake").textContent=isPaid()?"Request my guided help →":"Get my free next steps →";
      $("#submitNote").textContent=isPaid()?"No card required. No payment today.":"Free to use. No payment details needed.";
    }
    if(id==="done") {
      $("#doneMessage").textContent=isPaid()?"Your request is on its way. A guide will follow up by email, usually within 1 business day. If you don’t hear from us, contact help@saverx.ai.":"Your free starting steps are below. Look out for a confirmation email, and check spam if it doesn’t arrive.";
      var gov=state.insurance_category==="medicare"||state.insurance_category==="medicaid";
      $("#checklistRoute").textContent=gov?"Explore patient assistance programs and ask your plan about cost support. Medicare users can also check Extra Help eligibility. Manufacturer copay cards generally exclude government coverage.":state.insurance_category==="uninsured"?"Check whether the manufacturer offers an income-based patient assistance program. Compare cash prices if assistance isn’t available.":state.insurance_category==="unsure"?"Check your insurance card or contact your plan to confirm your coverage type before choosing a program.":"Review the manufacturer’s copay program rules, including insurance coverage requirements, savings limits, and excluded plans.";
      $("#checklistRx").textContent=state.prescription_status==="yes"?"Keep your prescription and coverage details ready. Submit only on the official program website; you complete your own eligibility attestations.":"Talk with your prescriber about a valid prescription before applying for medication assistance. SaveRx does not prescribe or dispense medication.";
      $("#doneOfficialLink").href=items.some(function(i){return i.slug===state.drug_slug;})?"/drugs/"+state.drug_slug+"/":"/drugs/";
    }
    if(focus!==false){
      var heading=$('[data-step="'+id+'"] h2');
      if(heading){heading.focus({preventScroll:true}); $(".help-workspace").scrollIntoView({block:"start",behavior:"auto"});}
    }
  }
  function markStarted() {
    if(!state.started){state.started=true;track("intake_start",{drug_slug:state.drug_slug||"none"});beacon("intake_start");}
  }
  function stepComplete(id) {
    markStarted();
    track("intake_step",{step_id:id,drug_slug:state.drug_slug||"none"});
  }
  function wire(group,field,onSelect){
    var root=$('[data-group="'+group+'"]');
    $$(".opt",root).forEach(function(btn){btn.addEventListener("click",function(){
      $$(".opt",root).forEach(function(b){var selected=b===btn;b.classList.toggle("selected",selected);b.setAttribute("aria-pressed",String(selected));});
      markStarted();
      state[field]=btn.getAttribute("data-value");
      if(onSelect)onSelect(state[field]);
    });});
  }
  function error(id,message,target){$(id).textContent=message;if(target)$(target).focus();}
  function init(){
    state.drug_brand=prettyName(state.drug_slug);
    updateDrugLabels();
    $("#drugInput").value=state.drug_brand;
    $("#drugInput").addEventListener("input",markStarted);
    fetch("/data/drugs.json",{cache:"force-cache"}).then(function(r){return r.json();}).then(function(j){
      items=j.items||[];
      items.forEach(function(i){var o=document.createElement("option");o.value=i.brand||i.name;$("#drugList").appendChild(o);});
      var m=items.filter(function(i){return i.slug===state.drug_slug;})[0];
      if(m&&!state.started&&$("#drugInput").value===prettyName(state.drug_slug)){state.drug_brand=m.brand||m.name;$("#drugInput").value=state.drug_brand;updateDrugLabels();}
    }).catch(function(){});
    track("enroll_intake_view",{drug_slug:state.drug_slug||"none"});beacon("enroll_view");
    wire("insurance","insurance_category",function(v){$("#govNotice").hidden=!(v==="medicare"||v==="medicaid");});
    wire("prescription","prescription_status",function(v){$("#rxNotice").hidden=v==="yes";});
    wire("difficulty","primary_difficulty");
    wire("preference","service_preference",function(v){track("price_tier_selected",{tier:v,drug_slug:state.drug_slug||"none"});});
    $("#situationContinue").addEventListener("click",function(){
      var v=$("#drugInput").value.trim();
      if(!v)return error("#drugMsg","Add your medication name to continue.","#drugInput");
      $("#drugMsg").textContent="";
      if(!state.insurance_category)return error("#situationMsg","Choose your insurance type, or select ‘I’m not sure’.",'[data-group="insurance"] .opt');
      if(!state.prescription_status)return error("#situationMsg","Choose your prescription status to continue.",'[data-group="prescription"] .opt');
      var m=items.filter(function(i){return(i.brand||i.name).toLowerCase()===v.toLowerCase();})[0];
      state.drug_brand=v;state.drug_slug=m?m.slug:"";
      updateDrugLabels();$("#situationMsg").textContent="";stepComplete("insurance");stepComplete("prescription");show("difficulty");
    });
    $("#difficultyContinue").addEventListener("click",function(){
      if(!state.primary_difficulty)return error("#difficultyMsg","Choose the closest match to continue.",'[data-group="difficulty"] .opt');
      $("#difficultyMsg").textContent="";stepComplete("difficulty");show("preference");
    });
    $("#preferenceContinue").addEventListener("click",function(){
      if(!state.service_preference)return error("#preferenceMsg","Choose the help you’d like. There’s a free option, too.",'[data-group="preference"] .opt');
      $("#preferenceMsg").textContent="";stepComplete("preference");show("contact");
    });
    $("#phoneInput").addEventListener("input",function(){
      var empty=!this.value.trim();$("#smsConsentRow").hidden=empty;if(empty)$("#smsConsent").checked=false;
    });
    $("#contactForm").addEventListener("submit",function(e){
      e.preventDefault();if(busy||state.submitted)return;
      var email=$("#emailInput").value.trim();
      if(!$("#emailInput").checkValidity()||!/^\S+@\S+\.\S+$/.test(email))return error("#contactMsg","Add a valid email so we can send your next steps.","#emailInput");
      if(!$("#consentCheck").checked)return error("#contactMsg","Please agree to email contact before we send your request.","#consentCheck");
      state.email=email;state.phone=$("#phoneInput").value.trim();state.consent_contact=true;state.consent_sms=!!(state.phone&&$("#smsConsent").checked);state.difficulty_text=$("#difficultyText").value.trim().slice(0,500);
      busy=true;$("#submitIntake").disabled=true;$("#contactMsg").textContent="Sending your request…";
      postIntake().then(function(){
        state.submitted=true;stepComplete("contact");track("intake_complete",{drug_slug:state.drug_slug||"none",insurance_category:state.insurance_category,tier:state.service_preference});
        if(isPaid()){setupCheckout();show("checkout");}else show("done");
      }).catch(function(){error("#contactMsg","We couldn’t send your request. Please try again, or email help@saverx.ai.");}).finally(function(){busy=false;$("#submitIntake").disabled=false;});
    });
    $$("[data-back]").forEach(function(b){b.addEventListener("click",function(){show(ORDER[Math.max(0,ORDER.indexOf(current)-1)]);});});
    $$("[data-edit]").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-edit"));});});
    $("#reserveContinue").addEventListener("click",function(){show("done");});
    $("#checkoutBtn").addEventListener("click",function(){
      var link=STRIPE_LINKS[state.service_preference];if(!link)return;
      state.checkout_result="started";track("checkout_started",{tier:state.service_preference,drug_slug:state.drug_slug||"none"});beacon("checkout_started",state.service_preference);postIntake().catch(function(){});
      window.open(link+(link.indexOf("?")===-1?"?":"&")+"client_reference_id="+encodeURIComponent(state.intake_id),"_blank","noopener");
    });
    $("#checkoutSkip").addEventListener("click",function(e){e.preventDefault();state.checkout_result="abandoned";postIntake().catch(function(){});show("done");});
    show("insurance",false);
    if(qs.get("checkout")==="success"){
      // A URL parameter is not proof of payment; Stripe supplies the receipt.
      track("checkout_returned",{tier:qs.get("tier")==="paid_1999"?"paid_1999":"paid_999",drug_slug:state.drug_slug||"none"});
      show("done",false);$("#doneCheckoutMsg").hidden=false;
    }
  }
  function setupCheckout(){
    var link=STRIPE_LINKS[state.service_preference]||"";
    $("#checkoutPay").hidden=!link;$("#checkoutReserve").hidden=!!link;
    $$("[data-tier-label]").forEach(function(el){el.textContent=labels[state.service_preference];});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
