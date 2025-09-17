// Simple interactions
document.getElementById('year').textContent = new Date().getFullYear();

// CTA scrolls to coverage radios
document.getElementById('cta-search').addEventListener('click', () => {
  document.getElementById('coverage').scrollIntoView({behavior:'smooth'});
});

// Persist coverage choice
const covForm = document.getElementById('coverage-form');
covForm.addEventListener('change', e => {
  if (e.target.name === 'coverage') {
    localStorage.setItem('coverage', e.target.value);
  }
});

// Email form success UX (for Formspree)
const emailForm = document.getElementById('email-form');
emailForm.addEventListener('submit', async (e) => {
  // Let the form POST normally; optional enhancement:
  // Show a quick “Thanks” after submission
});
