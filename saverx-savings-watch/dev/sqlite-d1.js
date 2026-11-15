// Minimal D1-compatible wrapper over node:sqlite (Node 22+). D1 is SQLite, so tests and the
// localhost dev server exercise the exact schema.sql and src/store.js SQL used in production.
// Dev/test only: never imported by the Worker bundle.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function sqliteD1(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return {
    prepare: (sql) => wrap(sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try { for (const s of stmts) await s.run(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    raw: db,
  };
}
