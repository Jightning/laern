/* ============================================================================
 * functions/api/sync.js — one request, one sync
 *
 * The old design spent four or more requests per sync: push rows, page the
 * pulls, list the courses, fetch each one. On a metered account that is the
 * wrong shape, so everything that is not a course *body* happens in a single
 * round trip: this device's new rows go up, the other devices' rows come back,
 * and the course listing rides along in the same response.
 *
 * Two devices syncing once a day is therefore two requests a day. The client
 * will not even call this when it has nothing to say and the day is not up —
 * see src/lib/cloud.js, where the policy lives.
 *
 * What the server can read: row ids, device ids, timestamps, sizes. The bodies
 * are ciphertext it cannot open, so the log is stored rather than known.
 * ==========================================================================*/
import { json, guard, body, purgeBin, okId } from "./_shared.js";

const MAX_ROWS = 2000;      /* per request, in and out */
const PAGE = 500;           /* rows returned before the client is told to come back */

export async function onRequestPost(context) {
  const stop = guard(context.request, context.env);
  if (stop) return stop;

  const db = context.env.DB;
  if (!db) return json({ error: "no database bound" }, 500);

  let payload;
  try { payload = await body(context.request); }
  catch (e) { return json({ error: e.message }, 400); }

  const device = String(payload.device || "");
  if (!/^[\w-]{1,64}$/.test(device)) return json({ error: "device required" }, 400);

  const since = Number(payload.since) || 0;
  const now = Date.now();
  const writes = [];

  /* ---------------------------------------------------------------- rows --
     A device may only write rows whose id it owns. That is what makes a merge
     a union with nothing to resolve: no device can rewrite another's history,
     so there is no conflict to detect and no order to agree on. */
  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, MAX_ROWS) : [];
  let written = 0;
  for (const r of rows) {
    if (!r || typeof r.id !== "string" || !r.id.startsWith(device + ":")) continue;
    if (typeof r.enc !== "string" || !r.enc) continue;
    writes.push(db.prepare(
      "INSERT OR IGNORE INTO log (id, device, ts, enc) VALUES (?, ?, ?, ?)")
      .bind(r.id, device, Number(r.ts) || now, r.enc));
    written++;
  }

  /* ------------------------------------------------------------- courses --
     Deleting a course on one device has to reach the others, so a delete is a
     tombstone rather than a row that disappears. Restoring is the same edit in
     reverse, which is why the body is kept until the bin is purged. */
  const deletes = Array.isArray(payload.deletes) ? payload.deletes.filter(okId) : [];
  for (const id of deletes) {
    writes.push(db.prepare(
      "UPDATE courses SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(now, now, id));
  }

  const restores = Array.isArray(payload.restores) ? payload.restores.filter(okId) : [];
  for (const id of restores) {
    writes.push(db.prepare(
      "UPDATE courses SET deleted_at = NULL, updated_at = ? WHERE id = ?").bind(now, id));
  }

  if (writes.length) await db.batch(writes);

  /* ----------------------------------------------------------- the reply --
     Rows this device has not seen, oldest first, capped so a long backlog
     drains over a few calls rather than timing one out. `not device` because a
     device already holds its own. */
  const page = await db.prepare(
    "SELECT seq, id, ts, enc FROM log WHERE seq > ? AND device != ? ORDER BY seq LIMIT ?")
    .bind(since, device, PAGE).all();
  const out = page.results || [];

  /* Purging first, so the listing below is the truth rather than the truth as
     of a moment ago: sweeping after reading advertised a course that had just
     been deleted in this same request. It is free to do here — the request was
     already happening, and a tombstone past its window is all it touches. */
  const purged = await purgeBin(db, now);

  /* The whole listing, tombstones included: a device cannot act on a deletion
     it is never told about. It is small — one short row per course — so it
     rides along on every sync rather than costing a request of its own. */
  const listing = await db.prepare(
    "SELECT id, version, bytes, deleted_at FROM courses ORDER BY id").all();

  return json({
    ok: true,
    now,
    written,
    cursor: out.length ? out[out.length - 1].seq : since,
    more: out.length === PAGE,
    rows: out.map(({ id, ts, enc }) => ({ id, ts, enc })),
    courses: (listing.results || []).map(c => ({
      id: c.id, version: c.version, bytes: c.bytes, deleted: !!c.deleted_at,
      deletedAt: c.deleted_at || null
    })),
    purged
  });
}
