// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Smooth scroll for primary CTA (extra safety; <a href="#coverage"> already works)
document.getElementById('cta-search')?.addEventListener('click', (e) => {
  const target = document.querySelector('#coverage');
  if (target) {
    // Allow native anchor but enhance with smooth behavior
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// Persist coverage choice
const coverageForm = document.getElementById('coverage-form');
coverageForm?.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'coverage') {
    localStorage.setItem('coverage', e.target.value);
  }
});

// Optional: simple success toast for the email form (if you want inline feedback)
// document.getElementById('email-form')?.addEventListener('submit', () => {
//   setTimeout(() => alert('Thanks! Please check your email for confirmation.'), 100);
// });
