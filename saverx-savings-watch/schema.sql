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

-- Added in later PRs: results, messages (admin workflow, SMS delivery).
