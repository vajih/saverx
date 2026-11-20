-- 0002: first-touch campaign attribution on Savings Watch requests (paid-test reporting).
-- Apply ONCE to an existing database (a fresh database gets these columns from schema.sql, so do not run this on it):
--   wrangler d1 execute saverx-savings-watch --remote --file=migrations/0002_utm_attribution.sql
-- Verify:
--   wrangler d1 execute saverx-savings-watch --remote --command "SELECT name FROM pragma_table_info('requests') WHERE name LIKE 'utm_%'"
-- UTM values are sanitized campaign labels, not PII: they need no purge.
ALTER TABLE requests ADD COLUMN utm_source TEXT;
ALTER TABLE requests ADD COLUMN utm_medium TEXT;
ALTER TABLE requests ADD COLUMN utm_campaign TEXT;
ALTER TABLE requests ADD COLUMN utm_content TEXT;
ALTER TABLE requests ADD COLUMN utm_term TEXT;
