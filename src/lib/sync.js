/* ============================================================================
 * src/lib/sync.js — move the log between devices, and nothing else
 *
 * Only the outcome log crosses the wire. Loop A and Loop B state are folds
 * over it (lib/replay.js), so they are recomputed on arrival rather than
 * transferred — which is what removes conflict resolution from the design.
 * Every row carries the id of the device that wrote it, no device ever writes
 * another's rows, and a merge is therefore a union.
 *
 * Offline is the normal case, not the error case. Writes land in IndexedDB
 * immediately and sync is opportunistic: a failed pull or push leaves the
 * cursors untouched, so the next attempt picks up exactly where this one
 * stopped. Nothing is queued, because the log *is* the queue.
 *
 * The endpoint is guarded by a shared secret, pasted into each device once.
 * It cannot be baked into the build: the site is public, so an inlined secret
 * would be readable by anyone who fetched the JavaScript. Cloudflare Access
 * would remove the secret entirely, but enabling Zero Trust requires a payment
 * method on file, so this is the free path.
 *
 * The token lives on the same origin that renders course HTML, which is only
 * acceptable while the reader authors their own courses — see
 * docs/architecture.md on sanitising course HTML before that stops being true.
 * ==========================================================================*/
import { getItem, setItem, logRows, mergeRows, markSent, flush } from "./store.js";
import { deviceId } from "./device.js";
import { importCourse, versionOf, importedIndex, filesOf, markSynced, unsynced } from "./courses.js";
import { invalidate } from "./replay.js";

/* The server's own sequence number, not a timestamp: two devices have two
   clocks, and a fast one would advance the other's cursor past unseen rows. */
const TOK_KEY = "sync:token";
const CUR_KEY = "sync:cursor";

/* The endpoint is the reader's own sync server, not this origin. There is no
   Function on the deployment: it would draw on an account-wide Workers quota
   shared with other projects, on a hostname anyone can find in Certificate
   Transparency logs. Running it inside a private network instead means there is
   no public endpoint to flood, and no sync at all for anyone who has not set
   one up — which is the intent. */
const URL_KEY = "sync:url";
export const endpoint = () => (getItem(URL_KEY) || "").replace(/\/+$/, "");

export const config = () => ({ url: endpoint(), token: getItem(TOK_KEY) || "" });
export const configured = () => !!(endpoint() && getItem(TOK_KEY));
export function configure({ url, token }) {
  if (url != null) setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
  if (token != null) setItem(TOK_KEY, token.trim());
}

const num = k => Number(getItem(k)) || 0;

class Unauthenticated extends Error {}

async function call(path, init = {}) {
  const res = await fetch(endpoint() + path, {
    ...init,
    headers: { "content-type": "application/json",
               authorization: `Bearer ${getItem(TOK_KEY) || ""}`, ...init.headers }
  });
  /* A wrong or missing token is not a network fault, and the cure is different:
     one needs the secret re-entered, the other needs nothing. */
  if (res.status === 401 || res.status === 403) throw new Unauthenticated();
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** Everything other devices have written since we last looked. */
export async function pull() {
  let since = num(CUR_KEY);
  let merged = 0, pages = 0;
  const courses = new Set();

  /* Paged by server sequence, so a backlog drains fully and a page boundary can
     never fall inside a millisecond and strand the rest of it. */
  for (;;) {
    const res = await call(`/log?since=${since}&not=${encodeURIComponent(deviceId())}`);
    const rows = (res && res.rows) || [];
    if (rows.length) {
      merged += mergeRows(rows);
      for (const r of rows) if (r.course) courses.add(r.course);
    }
    since = Number(res && res.cursor) || since;
    setItem(CUR_KEY, String(since));
    if (!res || !res.more || ++pages > 100) break;
  }

  /* Merged rows can predate an existing checkpoint, so the affected courses
     must refold from the start rather than resume from a stale watermark. */
  courses.forEach(invalidate);
  return { merged, courses: [...courses] };
}

/** Our own rows the server has not seen. */
export async function push() {
  const dev = deviceId();
  const mine = logRows().filter(r => !r.sent && String(r.id).startsWith(dev + ":"));
  if (!mine.length) return { sent: 0 };

  const payload = mine.map(({ sent, ...row }) => row);
  await call("/log", { method: "POST", body: JSON.stringify({ device: dev, rows: payload }) });
  /* Marked only after the server has them, so a failed push simply retries. */
  markSent(mine.map(r => r.id));
  return { sent: mine.length };
}

/* Courses are mutable, so they cannot be merged the way log rows are — and they
   do not need to be. A course has one writer at a time, so the rule is simply
   "take the newer one". The version is a content hash, so an unchanged course
   costs one listing entry and no transfer at all.

   Which way is "newer" is decided on the server, by clocks that are all its
   own: a staged upload carries its arrival time and a course on disk carries
   its file mtime. This device never asserts an order, because two devices'
   clocks cannot be compared — the same reason the log's cursor is a
   server-assigned seq rather than a timestamp. */
async function pullCourses(list, known = {}) {
  const changed = [];

  for (const c of list) {
    if (!c || !/^[\w-]+$/.test(c.id)) continue;
    if (versionOf(c.id) === c.version) continue;      /* already current */

    /* Identify the fetch: the server retires a staged course once every device
       it knows about has taken a copy. */
    const body = await call(
      `/courses/${encodeURIComponent(c.id)}?device=${encodeURIComponent(deviceId())}`);
    const files = body && body.files;
    if (!files || typeof files !== "object") continue;

    const r = importCourse(c.id, files, known, c.version);
    if (r.ok) changed.push(c.id);
    else console.warn(`${c.id}: ${r.errors.join("; ")}`);
  }
  return { courses: changed, available: list.length };
}

/* A course installed here that the server does not have. `version` is null for
   exactly the courses this device installed by hand, so the candidate set costs
   no clock and no bookkeeping — and anything the server already lists is left
   alone, including a course it authors on disk, which it refuses to have
   overwritten. Uploading is what un-strands a course that arrived on one
   device: the phone was handed a zip, and no other device could reach it. */
async function pushCourses(list) {
  const there = new Set(list.map(c => c.id));
  const sent = [];
  for (const id of unsynced()) {
    if (there.has(id)) continue;
    const files = filesOf(id);
    if (!files) continue;
    try {
      const res = await call(`/courses/${encodeURIComponent(id)}`,
        { method: "POST", body: JSON.stringify({ device: deviceId(), files }) });
      /* Recorded only after the server has it, so a failed upload simply
         retries on the next sync. */
      if (res && res.version && markSynced(id, res.version)) sent.push(id);
    } catch (e) {
      if (e instanceof Unauthenticated) throw e;
      console.warn(`${id}: upload failed — ${e.message}`);
    }
  }
  return sent;
}

let running = false;

/** Push then pull. Safe to call often; overlapping calls collapse into one. */
export async function sync() {
  if (running || !configured() || !navigator.onLine) return null;
  running = true;
  try {
    await flush();
    const sent = await push();
    const got = await pull();

    /* One listing answers both directions: what to hand up is what it does not
       list, and what to take down is what it lists at a version we do not hold. */
    const res = await call("/courses");
    const list = (res && res.courses) || [];

    /* Offer before asking, so a course this device holds and the server does
       not is available to the others in the same pass. */
    const uploaded = await pushCourses(list);

    /* Courses before the event, so a refold after new rows sees the material
       those rows refer to rather than a course that is not installed yet. */
    const taken = { ids: Object.keys(importedIndex()), codes: {} };
    const books = await pullCourses(list, taken);

    if (got.merged || books.courses.length)
      dispatchEvent(new CustomEvent("learn:synced",
        { detail: { ...got, installed: books.courses } }));
    return { ok: true, ...sent, ...got, installed: books.courses,
             uploaded, available: books.available };
  } catch (e) {
    /* Cursors are untouched either way, so the next attempt resumes exactly
       where this one stopped. */
    return { ok: false, needsLogin: e instanceof Unauthenticated };
  } finally {
    running = false;
  }
}

/** Sync on load, when the tab is hidden, and when the network returns. */
export function auto() {
  sync();
  addEventListener("online", sync);
  addEventListener("visibilitychange", () => { if (document.hidden) sync(); });
  addEventListener("pagehide", () => { flush(); sync(); });
}
