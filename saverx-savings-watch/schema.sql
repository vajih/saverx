-- SaveRx Savings Watch — D1 schema (v1). Apply: wrangler d1 execute saverx-savings-watch --file=schema.sql

CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  drug_slug       TEXT NOT NULL,
  phone_hmac      TEXT NOT NULL,           -- HMAC(phone): dedupe + suppression lookups
  phone_e164      TEXT,                    -- needed to send; purged by retention job
  status          TEXT NOT NULL DEFAULT 'new', -- new|verified|researching|ready|sent|closed
  verify_attempts INTEGER NOT NULL DEFAULT 0,
  ip_hash         TEXT,
  source_page     TEXT,
  created_at      TEXT NOT NULL,
  verified_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_dedupe ON requests (phone_hmac, drug_slug, created_at);

CREATE TABLE IF NOT EXISTS consents (
  id           TEXT PRIMARY KEY,
  request_id   TEXT NOT NULL REFERENCES requests(id),
  type         TEXT NOT NULL,              -- transactional | watch
  text_version TEXT NOT NULL,
  text_shown   TEXT NOT NULL,              -- verbatim copy shown to the visitor
  checked_at   TEXT NOT NULL,
  confirmed_at TEXT,                       -- set when the phone is verified
  withdrawn_at TEXT,                       -- set on STOP; cleared on START
  superseded_at TEXT,                      -- set when a later /start replaces these unconfirmed choices (kept as inactive history)
  ip_hash      TEXT,
  user_agent   TEXT
);

CREATE TABLE IF NOT EXISTS suppression (
  phone_hmac TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,                -- stop | complaint | admin
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key   TEXT PRIMARY KEY,                  -- name:id:window-bucket
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (         -- aggregate funnel, no PII
  day       TEXT NOT NULL,
  name      TEXT NOT NULL,
  drug_slug TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name, drug_slug)
);

CREATE TABLE IF NOT EXISTS results (
  id           TEXT PRIMARY KEY,
  request_id   TEXT NOT NULL REFERENCES requests(id),
  content_json TEXT NOT NULL,              -- admin-verified savings info (validated, https links only)
  source_note  TEXT NOT NULL,              -- what was verified, and where
  verified_by  TEXT NOT NULL,              -- admin email (from Cloudflare Access)
  verified_at  TEXT NOT NULL,
  token_hash   TEXT UNIQUE,                -- set when the link is sent; token itself is never stored
  expires_at   TEXT,                       -- set when the link is sent (send time + 14 days)
  viewed_at    TEXT,
  outcome      TEXT,                       -- worked | not_worked | need_help
  outcome_at   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_request ON results (request_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  result_id  TEXT REFERENCES results(id),
  twilio_sid TEXT UNIQUE,
  status     TEXT NOT NULL,                -- sending|queued|sent|delivered|undelivered|failed
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
