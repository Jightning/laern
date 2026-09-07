/* A D1 binding backed by SQLite, for testing the Functions rather than a mock.
 *
 * The handlers speak `prepare().bind().all()/first()/run()` and `batch()`; this
 * is that surface over node:sqlite, so the SQL in functions/api/* is executed
 * exactly as written. `counter` records how many statements ran, which is what
 * lets a test prove that a refused request never reached the database at all —
 * the ordering property the whole backend rests on.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function d1(db, counter = { n: 0 }) {
  const stmt = sql => {
    const bound = [];
    const run = () => { counter.n++; return db.prepare(sql); };
    const api = {
      bind: (...args) => { bound.push(...args); return api; },
      all: async () => ({ results: run().all(...bound) }),
      first: async () => run().get(...bound) ?? null,
      run: async () => { run().run(...bound); return { success: true }; },
      _exec: () => { run().run(...bound); }
    };
    return api;
  };
  return { prepare: stmt, batch: async list => { for (const s of list) s._exec(); return []; } };
}

export function freshDb(schemaPath) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}
