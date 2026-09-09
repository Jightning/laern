#!/usr/bin/env node
/* The backup backend, exercised for real.
 *
 *   node tools/test-cloud.mjs
 *
 * Two halves, and the first one is the security property the whole design
 * rests on: the deployment is a public website, and these two routes are the
 * only part of it that is not. A missing check here publishes the account's
 * coursework, so the tests assert the *order* of operations — that an
 * unauthenticated request is refused before a binding is touched — rather than
 * only that it is refused.
 *
 * The second half is the quota and correctness contract: one round trip per
 * sync, no transfer for an unchanged course, deletions that reach the other
 * devices, a bin that can be restored from and is purged on time.
 *
 * The Functions run against a real SQLite database through a small D1 shim, so
 * the SQL is executed rather than imagined. Encryption runs against Node's own
 * WebCrypto, which is the same implementation the browser uses.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { onRequestPost: syncRoute } = await import("../functions/api/sync.js");
const { onRequestPost: courseRoute } = await import("../functions/api/course.js");
const { deriveKey, seal, open, versionOfFiles } = await import("../src/lib/seal.js");

/* The binding is SQLite through a small shim (tools/lib/d1shim.mjs), so the SQL
 * in functions/api/* runs rather than being imagined, and `counter` can prove
 * that a refused request never reached it. */
const { d1, freshDb } = await import("./lib/d1shim.mjs");
const fresh = () => freshDb(join(ROOT, "tools/schema.sql"));

const SECRET = "s".repeat(40);
const req = (payload, auth = SECRET) => new Request("https://x/api", {
  method: "POST",
  headers: auth ? { authorization: `Bearer ${auth}` } : {},
  body: JSON.stringify(payload)
});

const call = async (route, payload, { auth = SECRET, env = {}, db, counter } = {}) => {
  const res = await route({ request: req(payload, auth),
                            env: { SYNC_SECRET: SECRET, DB: d1(db, counter), ...env } });
  return { status: res.status, body: await res.json() };
};

/* ------------------------------------------------------- the gate comes first */
{
  const db = fresh(), counter = { n: 0 };
  const anon = await call(syncRoute, { device: "a" }, { auth: "", db, counter });
  check("an unauthenticated sync is refused", anon.status === 401, String(anon.status));
  const wrong = await call(syncRoute, { device: "a" }, { auth: "x".repeat(40), db, counter });
  check("a wrong secret is refused", wrong.status === 401, String(wrong.status));
  check("neither one touched the database", counter.n === 0, `${counter.n} statements`);

  const off = await call(syncRoute, { device: "a" },
    { env: { SYNC_SECRET: undefined }, db, counter });
  check("with no secret configured the route does not exist", off.status === 404, String(off.status));

  const anonCourse = await call(courseRoute, { op: "get", id: "demo" }, { auth: "", db, counter });
  check("course bodies are behind the same gate", anonCourse.status === 401);
  check("still nothing read", counter.n === 0, `${counter.n} statements`);

  const closed = await call(syncRoute, { device: "a" },
    { env: { SYNC_OPEN_UNTIL: String(Date.now() - 1000) }, db, counter });
  check("a closed window refuses even the owner", closed.status === 503, String(closed.status));
}

/* ------------------------------------------------------------------ the log --*/
{
  const db = fresh(), counter = { n: 0 };
  const rows = n => Array.from({ length: n }, (_, i) =>
    ({ id: `phone:${1000 + i}:1`, ts: 1000 + i, enc: `blob${i}` }));

  const up = await call(syncRoute, { device: "phone", since: 0, rows: rows(3) }, { db, counter });
  check("rows are accepted in the same call that pulls", up.status === 200 && up.body.written === 3,
        JSON.stringify(up.body.written));
  check("a device is told nothing it wrote itself", up.body.rows.length === 0);

  const again = await call(syncRoute, { device: "phone", since: 0, rows: rows(3) }, { db, counter });
  check("re-sending the same rows writes nothing", again.body.written === 3 &&
        db.prepare("SELECT COUNT(*) c FROM log").get().c === 3, "ids are unique");

  const other = await call(syncRoute, { device: "laptop", since: 0, rows: [] }, { db, counter });
  check("the other device receives them", other.body.rows.length === 3);
  check("and a cursor to come back with", other.body.cursor === 3, String(other.body.cursor));

  const nothingNew = await call(syncRoute, { device: "laptop", since: other.body.cursor }, { db, counter });
  check("a second pull at that cursor is empty", nothingNew.body.rows.length === 0);

  const forged = await call(syncRoute,
    { device: "laptop", since: 0, rows: [{ id: "phone:9:9", ts: 9, enc: "x" }] }, { db, counter });
  check("a device may not write another device's rows", forged.body.written === 0);
}

/* --------------------------------------------------------------- courses ----*/
{
  const db = fresh(), counter = { n: 0 };
  const files = { "course.yaml": "code: ZZ\ntitle: Cloud\n", "sections/01-a/1-b.yaml": "title: B\n" };
  const key = await deriveKey(SECRET);
  const version = await versionOfFiles(files);
  const enc = await seal(key, files);

  const put = await call(courseRoute, { op: "put", id: "cloudy", version, enc }, { db, counter });
  check("a course body can be handed up", put.status === 200 && put.body.version === version);

  const listed = await call(syncRoute, { device: "laptop", since: 0 }, { db, counter });
  const row = (listed.body.courses || []).find(c => c.id === "cloudy");
  check("it appears in the sync listing", !!row && row.version === version && !row.deleted);

  const got = await call(courseRoute, { op: "get", id: "cloudy" }, { db, counter });
  check("and comes back byte-identical", got.body.enc === enc);
  check("what is stored cannot be read without the key",
        !JSON.stringify(db.prepare("SELECT part FROM course_chunks").all()).includes("title: Cloud"));
  check("with the key it opens", JSON.stringify(await open(key, got.body.enc)) === JSON.stringify(files));

  const wrongKey = await deriveKey("not the secret");
  let refused = false;
  try { await open(wrongKey, got.body.enc); } catch { refused = true; }
  check("the wrong secret cannot open it", refused);

  let tampered = false;
  const bad = got.body.enc.slice(0, -6) + (got.body.enc.slice(-6) === "AAAAAA" ? "BBBBBB" : "AAAAAA");
  try { await open(key, bad); } catch { tampered = true; }
  check("a modified payload fails rather than opening as something else", tampered);

  /* Chunking is invisible from outside, and a shorter replacement must not keep
     the tail of what it replaced. */
  const big = { "course.yaml": "code: ZZ\n", big: "x".repeat(900 * 1024) };
  const bigEnc = await seal(key, big);
  await call(courseRoute, { op: "put", id: "cloudy", version: "v2", enc: bigEnc }, { db, counter });
  check("a large body is stored in pieces",
        db.prepare("SELECT COUNT(*) c FROM course_chunks WHERE id='cloudy'").get().c > 1);
  const backBig = await call(courseRoute, { op: "get", id: "cloudy" }, { db, counter });
  check("and reassembles exactly", backBig.body.enc === bigEnc);
  await call(courseRoute, { op: "put", id: "cloudy", version, enc }, { db, counter });
  const backSmall = await call(courseRoute, { op: "get", id: "cloudy" }, { db, counter });
  check("replacing it with a shorter one leaves no tail", backSmall.body.enc === enc);

  const nope = await call(courseRoute, { op: "get", id: "../../etc" }, { db, counter });
  check("an id that is a path is refused", nope.status === 400, String(nope.status));
}

/* ------------------------------------------------- deletion, bin and restore -*/
{
  const db = fresh(), counter = { n: 0 };
  const key = await deriveKey(SECRET);
  const files = { "course.yaml": "code: ZZ\n" };
  await call(courseRoute, { op: "put", id: "doomed", version: "v1",
                            enc: await seal(key, files) }, { db, counter });

  const del = await call(syncRoute, { device: "phone", since: 0, deletes: ["doomed"] }, { db, counter });
  const row = del.body.courses.find(c => c.id === "doomed");
  check("a deletion is a tombstone, not a disappearance", !!row && row.deleted === true);

  const seen = await call(syncRoute, { device: "laptop", since: 0 }, { db, counter });
  check("the other device is told to remove it",
        seen.body.courses.find(c => c.id === "doomed").deleted === true);
  check("the body is kept while it is in the bin",
        db.prepare("SELECT COUNT(*) c FROM course_chunks WHERE id='doomed'").get().c > 0);

  const back = await call(syncRoute, { device: "phone", since: 0, restores: ["doomed"] }, { db, counter });
  check("restoring clears the tombstone",
        back.body.courses.find(c => c.id === "doomed").deleted === false);
  const body = await call(courseRoute, { op: "get", id: "doomed" }, { db, counter });
  check("and the body is still there to come back", body.status === 200);

  /* Purging happens inside a request that was already being made. */
  await call(syncRoute, { device: "phone", since: 0, deletes: ["doomed"] }, { db, counter });
  db.prepare("UPDATE courses SET deleted_at = ? WHERE id = 'doomed'")
    .run(Date.now() - 31 * 864e5);
  const swept = await call(syncRoute, { device: "phone", since: 0 }, { db, counter });
  check("a tombstone past the window is purged", swept.body.purged === 1, String(swept.body.purged));
  check("its body goes with it",
        db.prepare("SELECT COUNT(*) c FROM course_chunks WHERE id='doomed'").get().c === 0);
  check("and it leaves the listing", !swept.body.courses.some(c => c.id === "doomed"));
}

/* ------------------------------------------------------------ one round trip -*/
{
  const db = fresh(), counter = { n: 0 };
  const before = counter.n;
  await call(syncRoute, { device: "phone", since: 0, rows: [
    { id: "phone:1:1", ts: 1, enc: "a" }, { id: "phone:2:1", ts: 2, enc: "b" }] }, { db, counter });
  check("a sync is one request carrying rows, deletions and the listing",
        counter.n - before <= 6, `${counter.n - before} statements in one call`);
}

/* ------------------------------------------------- what to hand up, and why -
 * This table is the bug that shipped. "Has a local version" was read as "the
 * account has it", which is false for a course that arrived from anywhere else
 * — every course looked synced and nothing was ever offered. The account's
 * listing is the only authority, and these are the four cases. */
{
  const { needsUpload } = await import("../src/lib/cloud.js");
  check("a course the account has never seen is sent",
        needsUpload(undefined, null, "abc") === true);
  check("a course whose local version came from somewhere else is still sent",
        needsUpload(undefined, "old-servers-hash", "abc") === true);
  check("a course the account holds at the same content is not sent",
        needsUpload({ id: "x", version: "abc" }, "abc", "abc") === false);
  check("a course the account holds at an older version is sent",
        needsUpload({ id: "x", version: "older" }, "older", "abc") === true);
  /* A tombstone and a local copy: which copy this device holds decides.
     Reading both rows as "never resurrect" is what made a re-import vanish —
     the upload was skipped and the pull then purged the fresh copy. */
  check("a tombstoned course this device got from the account is not sent back up",
        needsUpload({ id: "x", version: "abc", deleted: true }, "abc", "abc") === false);
  check("a tombstoned course just hand-installed here is sent, which restores it",
        needsUpload({ id: "x", version: "abc", deleted: true }, null, "fresh") === true);
}

console.log(fail.length ? `\nFAIL cloud  ${fail.length} failing` : "\nall passing");
process.exitCode = fail.length ? 1 : 0;
