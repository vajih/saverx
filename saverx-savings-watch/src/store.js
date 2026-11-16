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
        // Confirm only the consent rows from the current verification flow: rows a later
        // /start superseded (different checkbox choices) stay unconfirmed, as inactive history.
        db.prepare("UPDATE consents SET confirmed_at=? WHERE request_id=? AND confirmed_at IS NULL AND superseded_at IS NULL AND withdrawn_at IS NULL").bind(atIso, id),
      ]);
    },
    /** A repeated /start replaces the previous unconfirmed consent choices: mark them
     *  superseded (history is kept) so verification cannot confirm choices the visitor
     *  did not make in the current flow. */
    async supersedeUnconfirmedConsents(requestId, atIso) {
      await db.prepare(
        "UPDATE consents SET superseded_at=? WHERE request_id=? AND confirmed_at IS NULL AND superseded_at IS NULL"
      ).bind(atIso, requestId).run();
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
    // ---- suppression / consent withdrawal ----
    async addSuppression(phoneHmac, reason, atIso) {
      await db.prepare("INSERT OR REPLACE INTO suppression (phone_hmac,reason,created_at) VALUES (?,?,?)").bind(phoneHmac, reason, atIso).run();
    },
    async removeSuppression(phoneHmac) {
      await db.prepare("DELETE FROM suppression WHERE phone_hmac=?").bind(phoneHmac).run();
    },
    async withdrawConsents(phoneHmac, atIso) {
      await db.prepare(
        "UPDATE consents SET withdrawn_at=? WHERE withdrawn_at IS NULL AND request_id IN (SELECT id FROM requests WHERE phone_hmac=?)"
      ).bind(atIso, phoneHmac).run();
    },
    async restoreConsents(phoneHmac) {
      await db.prepare(
        "UPDATE consents SET withdrawn_at=NULL WHERE request_id IN (SELECT id FROM requests WHERE phone_hmac=?)"
      ).bind(phoneHmac).run();
    },
    async consentActive(requestId, type) {
      return !!(await db.prepare(
        "SELECT 1 AS x FROM consents WHERE request_id=? AND type=? AND confirmed_at IS NOT NULL AND withdrawn_at IS NULL AND superseded_at IS NULL"
      ).bind(requestId, type).first());
    },

    // ---- admin workflow ----
    async listRequests(status, limit = 100) {
      const where = status ? "WHERE r.status=?" : "";
      const sql =
        "SELECT r.id, r.drug_slug, r.status, r.created_at, r.verified_at, substr(r.phone_e164,-4) AS phone_last4, " +
        "EXISTS(SELECT 1 FROM consents c WHERE c.request_id=r.id AND c.type='watch' AND c.confirmed_at IS NOT NULL AND c.withdrawn_at IS NULL) AS watch_opt_in " +
        `FROM requests r ${where} ORDER BY r.created_at DESC LIMIT ?`;
      const st = db.prepare(sql);
      const { results } = await (status ? st.bind(status, limit) : st.bind(limit)).all();
      return results;
    },
    async setRequestStatus(id, status) {
      await db.prepare("UPDATE requests SET status=? WHERE id=?").bind(status, id).run();
    },
    async createResult(r) {
      await db.prepare(
        "INSERT INTO results (id,request_id,content_json,source_note,verified_by,verified_at,created_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(r.id, r.request_id, r.content_json, r.source_note, r.verified_by, r.verified_at, r.created_at).run();
    },
    async latestResult(requestId) {
      return db.prepare("SELECT * FROM results WHERE request_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1").bind(requestId).first();
    },
    async getResult(id) {
      return db.prepare("SELECT * FROM results WHERE id=?").bind(id).first();
    },
    async setResultToken(id, tokenHash, expiresIso) {
      await db.prepare("UPDATE results SET token_hash=?, expires_at=? WHERE id=?").bind(tokenHash, expiresIso, id).run();
    },
    async getResultByTokenHash(h) {
      return db.prepare("SELECT * FROM results WHERE token_hash=?").bind(h).first();
    },
    async markResultViewed(id, atIso) {
      const r = await db.prepare("UPDATE results SET viewed_at=? WHERE id=? AND viewed_at IS NULL").bind(atIso, id).run();
      return r.meta.changes > 0; // true only on the first view
    },
    async setOutcome(id, outcome, atIso) {
      await db.prepare("UPDATE results SET outcome=?, outcome_at=? WHERE id=?").bind(outcome, atIso, id).run();
    },

    // ---- messages ----
    async updateMessage(id, { sid, status, errorCode }, atIso) {
      await db.prepare(
        "UPDATE messages SET twilio_sid=COALESCE(?,twilio_sid), status=?, error_code=COALESCE(?,error_code), updated_at=? WHERE id=?"
      ).bind(sid ?? null, status, errorCode ?? null, atIso, id).run();
    },
    async getMessageBySid(sid) {
      return db.prepare("SELECT * FROM messages WHERE twilio_sid=?").bind(sid).first();
    },
    /** Atomically reserve one send slot: inserts the message row only when (a) fewer than
     *  maxSends non-failed messages exist for the request and (b) no other send for the
     *  request is currently in flight. A single statement, so two concurrent sends cannot
     *  both pass the limit or both create a link token for the same result. Returns true
     *  when the slot was reserved. Stale "sending" rows (older than 1h, e.g. a crashed
     *  send) are first released so they cannot burn a slot forever. */
    async reserveSendSlot(m, maxSends) {
      const staleCutoff = new Date(Date.parse(m.updated_at) - 3600 * 1000).toISOString();
      await db.prepare(
        "UPDATE messages SET status='failed', error_code='send_stale', updated_at=? WHERE request_id=? AND status='sending' AND updated_at<?"
      ).bind(m.updated_at, m.request_id, staleCutoff).run();
      const r = await db.prepare(
        "INSERT INTO messages (id,request_id,result_id,status,created_at,updated_at) " +
        "SELECT ?,?,?,?, ?,? WHERE (SELECT COUNT(*) FROM messages WHERE request_id=? AND status!='failed') < ? " +
        "AND NOT EXISTS (SELECT 1 FROM messages WHERE request_id=? AND status='sending')"
      ).bind(m.id, m.request_id, m.result_id, m.status, m.created_at, m.updated_at, m.request_id, maxSends, m.request_id).run();
      return r.meta.changes > 0;
    },
    /** True when a send for this request is currently in flight (reserved, not yet resolved). */
    async hasInFlightSend(requestId) {
      return !!(await db.prepare(
        "SELECT 1 AS x FROM messages WHERE request_id=? AND status='sending'"
      ).bind(requestId).first());
    },
    async messagesForRequest(requestId) {
      const { results } = await db.prepare("SELECT id,status,error_code,created_at,updated_at FROM messages WHERE request_id=? ORDER BY created_at").bind(requestId).all();
      return results;
    },

    // ---- analytics + retention ----
    async stats() {
      const { results: totals } = await db.prepare("SELECT name, SUM(count) AS count FROM events GROUP BY name").all();
      const { results: daily } = await db.prepare("SELECT day,name,drug_slug,count FROM events ORDER BY day DESC LIMIT 500").all();
      return { totals: Object.fromEntries(totals.map((t) => [t.name, t.count])), daily };
    },
    /** Daily cron: purge phone numbers and results once no longer needed. */
    async purge(nowMs) {
      const d = (days) => new Date(nowMs - days * 86400000).toISOString();
      const a = await db.prepare(
        "UPDATE requests SET phone_e164=NULL WHERE phone_e164 IS NOT NULL AND ((status='new' AND created_at<?) OR id IN (SELECT request_id FROM results WHERE expires_at IS NOT NULL AND expires_at<?))"
      ).bind(d(2), d(30)).run();
      // Verified/ready/closed requests that never got a successful send have no result
      // expiry to key off, so they get an age-based deadline instead: their phone numbers
      // are purged 45 days after verification (privacy policy's ~45-day promise), not kept
      // indefinitely. Requests with a sent (unexpired) link are untouched here.
      const c = await db.prepare(
        "UPDATE requests SET phone_e164=NULL WHERE phone_e164 IS NOT NULL AND status IN ('verified','ready','closed') AND COALESCE(verified_at,created_at)<? AND id NOT IN (SELECT request_id FROM results WHERE expires_at IS NOT NULL)"
      ).bind(d(45)).run();
      // messages keep their delivery history; only the link to the deleted result is cleared (FK)
      await db.prepare("UPDATE messages SET result_id=NULL WHERE result_id IN (SELECT id FROM results WHERE expires_at IS NOT NULL AND expires_at<?)").bind(d(30)).run();
      const b = await db.prepare("DELETE FROM results WHERE expires_at IS NOT NULL AND expires_at<?").bind(d(30)).run();
      // Unsent result drafts (never given a link) older than 45 days are deleted too.
      await db.prepare("UPDATE messages SET result_id=NULL WHERE result_id IN (SELECT id FROM results WHERE token_hash IS NULL AND created_at<?)").bind(d(45)).run();
      const e = await db.prepare("DELETE FROM results WHERE token_hash IS NULL AND created_at<?").bind(d(45)).run();
      await db.prepare("DELETE FROM rate_limits").run();
      return { phonesPurged: a.meta.changes + c.meta.changes, resultsDeleted: b.meta.changes + e.meta.changes };
    },
  };
}
