/**
 * nav.js — SaveRx.ai shared navigation behaviour
 * Handles: active-page highlight, hamburger toggle, categories dropdown.
 * Include once via <script src="/assets/js/nav.js"></script> before </body>.
 */
(function () {
  'use strict';

  /* ── 1. Active-page highlight ─────────────────────────────────────────── */
  // Sets aria-current="page" on the matching nav link so CSS can highlight it.
  var path = window.location.pathname;
  document.querySelectorAll('#primary-nav a.nav-link').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href) return;
    // Exact match, or prefix match for section roots (e.g. /drugs/ → /drugs/ozempic/)
    if (path === href || (href.length > 1 && path.startsWith(href))) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ── 2. Hamburger toggle ──────────────────────────────────────────────── */
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');

  if (btn && nav) {
    function setOpen(open) {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    // Toggle on button click
    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });

    // Close when clicking outside the nav
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (!nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });

    // Close on resize to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth > 640) setOpen(false);
    });

    // Close when any nav link is tapped (mobile UX)
    nav.querySelectorAll('a.nav-link').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
  }

  /* ── 3. Categories dropdown ───────────────────────────────────────────── */
  var dd = document.getElementById('catDropdown');
  if (!dd) return;

  var ddBtn  = dd.querySelector('.nav-dropdown-toggle');
  var ddMenu = dd.querySelector('.nav-dropdown-menu');
  if (!ddBtn || !ddMenu) return;

  function openDD()  { dd.setAttribute('data-open', '');  ddBtn.setAttribute('aria-expanded', 'true'); }
  function closeDD() { dd.removeAttribute('data-open');    ddBtn.setAttribute('aria-expanded', 'false'); }

  // Toggle on button click
  ddBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dd.hasAttribute('data-open') ? closeDD() : openDD();
  });

  // Close on outside click
  document.addEventListener('click', closeDD);
  // Don't close when clicking inside the menu
  ddMenu.addEventListener('click', function (e) { e.stopPropagation(); });

  // Keyboard: dropdown toggle
  ddBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Escape')    { closeDD(); ddBtn.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); openDD(); ddMenu.querySelector('[role="menuitem"]').focus(); }
  });

  // Keyboard: menu items
  var items = ddMenu.querySelectorAll('[role="menuitem"]');
  items.forEach(function (item, i) {
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape')    { closeDD(); ddBtn.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (items[i + 1]) items[i + 1].focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); if (i === 0) ddBtn.focus(); else items[i - 1].focus(); }
    });
    // GA4 event on category click
    item.addEventListener('click', function () {
      var slug = (item.pathname || '').replace(/.*\/categories\//, '').replace(/\/$/, '');
      if (slug && typeof gtag !== 'undefined') {
        gtag('event', 'category_click', { category: slug, source: 'nav-dropdown' });
      }
    });
  });
})();
