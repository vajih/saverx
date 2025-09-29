// Shared site script: handles modal + posting leads to Google Apps Script

const { drug, manufacturerUrl, scriptUrl } = window.PAGE_CONFIG || {};
if (!drug || !manufacturerUrl || !scriptUrl) {
  console.warn("PAGE_CONFIG is missing required fields.");
}

// Serialize to x-www-form-urlencoded
function toForm(data) {
  return Object.entries(data)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");
}

// Post lead to Google Apps Script (writes to Sheet1)
async function postLead(email, source) {
  const payload = {
    email,
    drug: drug || "Unknown",
    source,
    useragent: navigator.userAgent || "unknown"
  };

  try {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm(payload),
      mode: "no-cors" // simple, reliable for Apps Script web apps
    });
  } catch (e) {
    console.warn("Lead post failed (continuing redirect):", e);
  }
}

// Modal controls
const modal = document.getElementById("emailModal");
document.querySelectorAll("[data-open-modal]").forEach(btn =>
  btn.addEventListener("click", () => {
    modal.setAttribute("open", "");
    const box = document.getElementById("modalEmail");
    if (box) box.focus();
  })
);
document
  .querySelectorAll("[data-close-modal]")
  .forEach(btn => btn.addEventListener("click", () => modal.removeAttribute("open")));

// Handle modal form
const modalForm = document.getElementById("modalForm");
if (modalForm) {
  modalForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("modalEmail").value.trim();
    if (!email) return;
    document.getElementById("modalSubmit").disabled = true;
    await postLead(email, `${drug.toLowerCase()}-hero-modal`);
    window.location.href = manufacturerUrl;
  });
}

// Handle footer form
const footerForm = document.getElementById("footerForm");
if (footerForm) {
  footerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("footerEmail").value.trim();
    if (!email) return;
    document.getElementById("footerSubmit").disabled = true;
    await postLead(email, `${drug.toLowerCase()}-footer`);
    window.location.href = manufacturerUrl;
  });
}
