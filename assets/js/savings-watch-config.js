// Public (non-secret) configuration for /savings-watch/. Safe to commit.
window.SAVERX_SAVINGS = {
  api: "/api/savings",   // same-origin; Cloudflare routes saverx.ai/api/savings/* to the Worker
  turnstileSiteKey: ""   // paste the public Turnstile site key at launch (see docs/SAVINGS_WATCH_SETUP.md)
};
