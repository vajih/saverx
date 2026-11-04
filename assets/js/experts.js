
const areas=[{cat:'navigation',icon:'↗︎',title:'Stuck waiting on prior authorization?',desc:'Understand what’s holding things up, what information may be missing, and who to follow up with.',role:'Prior authorization & patient access specialist'},{cat:'medication',icon:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false" style="vertical-align:-.125em"><path d="M12 2v20M2 12h20M5 5l14 14M5 19L19 5"/></svg>',title:'Make sense of medication costs',desc:'Savings programs, coverage, and questions to ask.',role:'Pharmacist'},{cat:'navigation',icon:'↗︎',title:'Navigate insurance and access',desc:'Benefits, prior authorization, and next steps.',role:'Patient access specialist'},{cat:'medication',icon:'＋',title:'Prepare for a medication conversation',desc:'Understand terminology and organize your questions.',role:'Pharmacist'},{cat:'imaging',icon:'◎',title:'Understand the imaging process',desc:'Learn what to expect and prepare questions for your team.',role:'Radiology professional'}];
const list=document.querySelector('#help-list');function render(filter='all'){list.innerHTML=areas.filter(a=>filter==='all'||a.cat===filter).map(a=>`<article class="help-row"><span class="help-icon">${a.icon}</span><div><span class="expert-type">${a.role}</span><h3>${a.title}</h3><p>${a.desc}</p></div><button aria-label="Explore ${a.title}" data-topic="${a.title}">↗︎</button></article>`).join('')}render();document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});render(b.dataset.filter)});
const modal = document.querySelector('#inquiry');
const body = document.querySelector('#dialog-body');
const api = window.SAVERX_EXPERTS_API || '';
const copy = {
  person: ['Find your next step.', 'Request early access to independent healthcare education and navigation.', 'What support are you looking for?', ['Medication affordability','Prior authorization delays or denials','Insurance & patient access','Medication education','Imaging education']],
  expert: ['Your expertise belongs here.', 'Bring your expertise to SaveRx. Sign up to connect with people who need your knowledge and explore paid 1:1 education and navigation opportunities.', 'Your area of expertise', ['Pharmacy','Radiology','Nursing','Pharmacy technology','Patient access','Healthcare operations','Other']]
};
let pending = false;
async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    if (!response.ok) throw new Error('network');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function openFlow(type, topic = '') {
  if (pending) return;
  if (type === 'choose') {
    body.innerHTML = '<div class="eyebrow">Find your path</div><h2 id="inquiry-title">How can we help?</h2><p>Choose the experience that fits you.</p>' + [['person','I’m looking for personal guidance'],['expert','I want to get paid for my expertise']].map(([k,v]) => `<button class="btn light" style="width:100%;margin-top:12px" data-flow="${k}">${v} ↗︎</button>`).join('');
  } else {
    const c = copy[type];
    if (!c) return;
    const id = crypto.randomUUID(); // Kept for this form's entire retry lifecycle.
    const label = type === 'expert' ? 'Sign up as an expert' : 'Request expert support';
    body.innerHTML = `<div class="eyebrow">${type === 'expert' ? 'Expert signup' : 'Patient support'}</div><h2 id="inquiry-title">${c[0]}</h2><p>${c[1]}</p>
      <form id="experts-form"><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required maxlength="100">
      <label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254">
      <label for="interest">${c[2]}</label><select name="selected_topic_or_expertise" id="interest">${c[3].map(s => `<option>${s}</option>`).join('')}</select>
      <label for="note">${type === 'expert' ? 'How can you help people?' : 'Anything else?'} <span style="color:#717185">(optional)</span></label>
      <textarea name="notes" id="note" aria-describedby="privacy-note" placeholder="Please do not include personal health information." maxlength="1500"></textarea>
      <p class="form-note" id="privacy-note">Please do not include medical records, diagnoses, insurance IDs, or other personal health information.</p>
      <div class="experts-hp" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
      <label class="experts-consent"><input type="checkbox" required> <span>I agree that SaveRx may contact me about this ${type === 'expert' ? 'signup' : 'request'}. <a href="/privacy.html" target="_blank" rel="noopener">Privacy policy</a>.</span></label>
      <p class="form-status" id="experts-status" role="status" aria-live="polite"></p><button class="btn" type="submit">${label}</button>
      <button class="btn light" id="experts-retry" type="button" hidden>Retry submission</button></form>`;
    const form = body.querySelector('form');
    if (topic) form.querySelector('textarea').value = topic;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      const values = new FormData(form);
      const status = form.querySelector('#experts-status');
      const button = form.querySelector('[type="submit"]');
      const retry = form.querySelector('#experts-retry');
      pending = true; button.disabled = true; retry.hidden = true;
      form.setAttribute('aria-busy','true'); status.textContent = 'Saving your submission…';
      try {
        // Only the dedicated Experts endpoint may receive these contacts.
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(api)) throw new Error('configuration');
        const health = await requestJson(api + '?mode=experts_health', {cache:'no-store'});
        if (health.version !== 'experts-v1' || health.status !== 'ok') throw new Error('configuration');
        const fields = {form_type:'experts_contact', submission_id:id, submission_type:type === 'expert' ? 'expert_signup' : 'expert_request', name:String(values.get('name')).trim(), email:String(values.get('email')).trim(), selected_topic_or_expertise:String(values.get('selected_topic_or_expertise')), notes:String(values.get('notes') || ''), source_page:'/experts/', website:String(values.get('website') || '')};
        const result = await requestJson(api, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(fields).toString()});
        if (result.status !== 'ok' || result.saved !== true || result.submission_id !== id) throw new Error('save');
        body.innerHTML = `<div class="eyebrow">Submission saved</div><h2 id="inquiry-title">${type === 'expert' ? 'Thanks for sharing your expertise.' : 'Your request is with us.'}</h2><p>${type === 'expert' ? 'Your expert signup has been saved. Our team can contact you about next steps. This is an initial signup; credential review and opportunities come later.' : 'Your support request has been saved. Our team can contact you about next steps. This does not book a session or guarantee a match.'}</p><button type="button" class="btn" id="done">Back to exploring</button>`;
        body.querySelector('#done').onclick = () => modal.close();
        body.querySelector('h2').tabIndex = -1; body.querySelector('h2').focus();
      } catch (error) {
        status.textContent = error.message === 'configuration' ? 'Submissions are not available yet because the dedicated backend is not configured. Your entries are still here. Please retry later or contact help@saverx.ai.' : 'We couldn’t confirm your submission was saved. Your entries are still here. Retry below, or contact help@saverx.ai.';
        retry.hidden = false;
      } finally {
        pending = false; button.disabled = false; form.removeAttribute('aria-busy');
      }
    });
    form.querySelector('#experts-retry').onclick = () => form.requestSubmit();
  }
  if (!modal.open) modal.showModal();
}
document.addEventListener('click', event => {
  const flow = event.target.closest('[data-flow]');
  if (flow) openFlow(flow.dataset.flow);
  const topic = event.target.closest('[data-topic]');
  if (topic) openFlow('person', topic.dataset.topic);
});
document.querySelector('.close').onclick = () => { if (!pending) modal.close(); };
modal.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
modal.addEventListener('click', event => {
  if (pending || event.target !== modal) return;
  const r = modal.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close();
});
const toggle = document.querySelector('.mobile-toggle');
toggle.onclick = () => {
  const nav = document.querySelector('header nav');
  nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(nav.classList.contains('open')));
};
document.querySelectorAll('header nav a, header nav [data-flow]').forEach(link => link.addEventListener('click', () => {
  document.querySelector('header nav').classList.remove('open'); toggle.setAttribute('aria-expanded','false');
}));

document.querySelector('.guidance-card').addEventListener('click', event => { if (!event.target.closest('[data-flow]')) openFlow('person'); });
