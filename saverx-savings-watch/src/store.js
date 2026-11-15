// D1 repository. The handlers depend only on these method names, so tests use an in-memory twin
// (test/helpers.js) with the same interface.

export function d1Store(db) {
  return {
    async findRecentRequest(phoneHmac, slug, sinceIso) {
      return db.prepare(
        "SELECT * FROM requests WHERE phone_hmac=? AND drug_slug=? AND created_at>=? ORDER BY created_at DESC LIMIT 1"
      ).bind(phoneHmac, slug, sinceIso).first();
    },
    async createRequest(r) {
      await db.prepare(
        "INSERT INTO requests (id,drug_slug,phone_hmac,phone_e164,status,ip_hash,source_page,created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(r.id, r.drug_slug, r.phone_hmac, r.phone_e164, r.status, r.ip_hash, r.source_page, r.created_at).run();
    },
    async getRequest(id) {
      return db.prepare("SELECT * FROM requests WHERE id=?").bind(id).first();
    },
    async bumpVerifyAttempts(id) {
      const row = await db.prepare(
        "UPDATE requests SET verify_attempts=verify_attempts+1 WHERE id=? RETURNING verify_attempts"
      ).bind(id).first();
      return row ? row.verify_attempts : 0;
    },
    async markVerified(id, atIso) {
      await db.batch([
        db.prepare("UPDATE requests SET status='verified', verified_at=? WHERE id=?").bind(atIso, id),
        db.prepare("UPDATE consents SET confirmed_at=? WHERE request_id=?").bind(atIso, id),
      ]);
    },
    async addConsent(c) {
      await db.prepare(
        "INSERT INTO consents (id,request_id,type,text_version,text_shown,checked_at,ip_hash,user_agent) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(c.id, c.request_id, c.type, c.text_version, c.text_shown, c.checked_at, c.ip_hash, c.user_agent).run();
    },
    async isSuppressed(phoneHmac) {
      return !!(await db.prepare("SELECT 1 AS x FROM suppression WHERE phone_hmac=?").bind(phoneHmac).first());
    },
    /** Fixed-window counter; returns the new count for this key. */
    async hit(key) {
      const row = await db.prepare(
        "INSERT INTO rate_limits (key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count"
      ).bind(key).first();
      return row.count;
    },
    async addEvent(day, name, slug) {
      await db.prepare(
        "INSERT INTO events (day,name,drug_slug,count) VALUES (?,?,?,1) ON CONFLICT(day,name,drug_slug) DO UPDATE SET count=count+1"
      ).bind(day, name, slug).run();
    },
  };
}
