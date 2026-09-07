/* ============================================================================
 * functions/api/course.js — a course body, up or down
 *
 * Bodies are the only thing kept out of /api/sync, because they are three
 * orders of magnitude larger than everything else and they change rarely. A
 * device asks for one only when the version in the sync listing differs from
 * the version it holds, so an unchanged shelf costs no requests at all.
 *
 * The body is one AES-GCM blob the server cannot open: it stores a string,
 * chunks it to fit D1's per-value ceiling, and hands the same string back.
 * The id is plaintext because it is the key; everything else — titles,
 * material, the file map itself — is inside the ciphertext.
 * ==========================================================================*/
import { json, guard, body, okId } from "./_shared.js";

/* Comfortably under D1's per-value limit, and few enough rows that a course is
   a handful of statements rather than hundreds. */
const CHUNK = 400 * 1024;
const MAX_COURSE = 6 * 1024 * 1024;

export async function onRequestPost(context) {
  const stop = guard(context.request, context.env);
  if (stop) return stop;

  const db = context.env.DB;
  if (!db) return json({ error: "no database bound" }, 500);

  let payload;
  try { payload = await body(context.request, MAX_COURSE + 65536); }
  catch (e) { return json({ error: e.message }, 400); }

  const { op, id } = payload;
  if (!okId(id)) return json({ error: "bad course id" }, 400);

  /* ------------------------------------------------------------------ get --*/
  if (op === "get") {
    const meta = await db.prepare("SELECT version, bytes FROM courses WHERE id = ?")
      .bind(id).first();
    if (!meta) return json({ error: "no such course" }, 404);
    const parts = await db.prepare(
      "SELECT part FROM course_chunks WHERE id = ? ORDER BY n").bind(id).all();
    return json({ id, version: meta.version,
                  enc: (parts.results || []).map(r => r.part).join("") });
  }

  /* ------------------------------------------------------------------ put --*/
  if (op === "put") {
    const enc = payload.enc;
    const version = payload.version;
    if (typeof enc !== "string" || !enc) return json({ error: "enc required" }, 400);
    if (enc.length > MAX_COURSE) return json({ error: "course too large" }, 413);
    if (typeof version !== "string" || !/^[\w-]{1,64}$/.test(version))
      return json({ error: "version required" }, 400);

    const now = Date.now();
    const stmts = [
      /* Replacing a body means dropping the old pieces first: a shorter course
         would otherwise keep the tail of the longer one it replaced. */
      db.prepare("DELETE FROM course_chunks WHERE id = ?").bind(id)
    ];
    for (let i = 0, n = 0; i < enc.length; i += CHUNK, n++) {
      stmts.push(db.prepare("INSERT INTO course_chunks (id, n, part) VALUES (?, ?, ?)")
        .bind(id, n, enc.slice(i, i + CHUNK)));
    }
    /* An upload of a course in the bin brings it back: the reader is holding a
       copy and handing it up, which is a restore by any other name. */
    stmts.push(db.prepare(
      "INSERT INTO courses (id, version, bytes, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL) " +
      "ON CONFLICT(id) DO UPDATE SET version = excluded.version, bytes = excluded.bytes, " +
      "updated_at = excluded.updated_at, deleted_at = NULL")
      .bind(id, version, enc.length, now));

    await db.batch(stmts);
    return json({ ok: true, id, version, bytes: enc.length });
  }

  return json({ error: "op must be get or put" }, 400);
}
