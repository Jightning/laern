/* ============================================================================
 * src/lib/store.js — durable local storage, mirrored in memory
 *
 * localStorage was the wrong home for this and mobile is where it shows.
 * Web Storage caps at 10 MiB; the outcome log alone reaches ~4MB at CAP, and
 * every writer swallowed its own failure:
 *
 *     try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
 *
 * On a phone that is silent data loss — progress stops persisting with no
 * error and no symptom. Worse, the log re-serialised megabytes on every single
 * answer.
 *
 * IndexedDB fixes the quota. Two decisions make it fit the existing code:
 *
 *   1. **Memory is the read model.** Everything is loaded once at boot, so
 *      reads stay synchronous and no call site becomes async. Writes go to
 *      memory immediately and reach disk on a debounce.
 *   2. **The log gets its own store**, one record per row, so appending costs
 *      one small put rather than a rewrite of the whole array.
 *
 * Failures are no longer swallowed. `onError` reports them once so the app can
 * say so, because a study tool that quietly forgets is worse than one that
 * admits it cannot save.
 * ==========================================================================*/
const DB = "learn";
const VERSION = 2;
const KV = "kv";
const LOG = "log";
const COURSES = "courses";
const FLUSH_MS = 400;

/* localStorage keys this owns, for the one-time migration. */
const MINE = [/^study:/, /^retain:v1$/, /^log:v1$/, /^note:/, /^why:/, /^lane:/,
              /^contentZoom$/, /^tuckSidebar$/];

let db = null;
let mem = new Map();      /* kv mirror */
let rows = [];            /* log mirror, ascending by ts */
let books = new Map();    /* imported courses, by id */
let dirty = new Set();
let pending = [];
let timer = null;
let listeners = [];

export const onError = fn => { listeners.push(fn); };
const fail = e => { listeners.forEach(fn => { try { fn(e); } catch {} }); };

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, VERSION);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV);
    if (!d.objectStoreNames.contains(LOG)) d.createObjectStore(LOG, { keyPath: "id" });
    if (!d.objectStoreNames.contains(COURSES)) d.createObjectStore(COURSES, { keyPath: "id" });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

const readAll = store => new Promise((res, rej) => {
  const out = [];
  const r = db.transaction(store).objectStore(store).openCursor();
  r.onsuccess = () => {
    const c = r.result;
    if (!c) return res(out);
    out.push({ key: c.key, value: c.value });
    c.continue();
  };
  r.onerror = () => rej(r.error);
});

/* Everything the old build wrote, moved across once. The originals are left
   in place: a downgrade should find its data, and 10 MiB is not worth the
   risk of deleting the only copy of a semester of review. */
function migrate() {
  let moved = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !MINE.some(re => re.test(k)) || mem.has(k)) continue;
      if (k === "log:v1") {
        /* Rows written before sync existed carry no id, and the log store is
           keyed on one. Deriving it from the timestamp and position keeps a
           re-run idempotent instead of duplicating a reader's history. */
        let legacy = [];
        try { legacy = JSON.parse(localStorage.getItem(k)) || []; }
        catch (e) { fail(new Error("could not read the existing log: " + e.message)); }
        legacy.forEach((r, n) => {
          if (r && typeof r === "object") appendRow(r.id ? r : { ...r, id: `legacy:${r.ts || 0}:${n}` });
        });
      } else {
        mem.set(k, localStorage.getItem(k));
        dirty.add(k);
      }
      moved++;
    }
  } catch { /* storage disabled entirely — memory still works for this session */ }
  return moved;
}

/* Courses now live here, not just progress, so eviction costs material rather
   than a schedule. Browsers discard IndexedDB for origins under storage
   pressure unless the origin is "persisted"; asking is free and, on Chrome,
   granted automatically for an installed or frequently-used site. Safari grants
   it far more sparingly, which is why Add to Home Screen still matters more. */
export async function durable() {
  if (!navigator.storage || !navigator.storage.persisted) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return navigator.storage.persist ? await navigator.storage.persist() : null;
  } catch { return null; }
}

/** Open, load into memory, migrate on first run. Call once, before render. */
export async function init() {
  try {
    db = await open();
    for (const { key, value } of await readAll(KV)) mem.set(key, value);
    rows = (await readAll(LOG)).map(r => r.value).sort((a, b) => a.ts - b.ts);
    for (const { value } of await readAll(COURSES)) books.set(value.id, value);
  } catch (e) {
    db = null;
    fail(e);
  }
  if (!mem.size && !rows.length) { if (migrate()) schedule(); }
  return { keys: mem.size, rows: rows.length, courses: books.size };
}

function schedule() {
  if (timer || !db) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
}

/** Force everything to disk. Call on pagehide, and before syncing. */
export function flush() {
  if (!db || (!dirty.size && !pending.length)) return Promise.resolve();
  const keys = [...dirty], add = pending;
  dirty = new Set(); pending = [];
  return new Promise((res, rej) => {
    const tx = db.transaction([KV, LOG], "readwrite");
    const kv = tx.objectStore(KV), log = tx.objectStore(LOG);
    try {
      for (const k of keys) mem.has(k) ? kv.put(mem.get(k), k) : kv.delete(k);
      for (const r of add) log.put(r);
    } catch (e) {
      /* put() throws synchronously on a malformed record, which would
         otherwise abandon the rest of the batch without a word. */
      keys.forEach(k => dirty.add(k)); pending = add.concat(pending);
      fail(e); return rej(e);
    }
    tx.oncomplete = () => res();
    tx.onerror = () => {
      /* Put them back so the next flush retries rather than dropping them. */
      keys.forEach(k => dirty.add(k)); pending = add.concat(pending);
      fail(tx.error); rej(tx.error);
    };
  }).catch(() => {});
}

/* ------------------------------------------------- the localStorage shape --
 * Same names and same synchronous contract, so swapping a module over is a
 * one-line change at the top of the file.
 */
export const getItem = k => (mem.has(k) ? mem.get(k) : null);

export function setItem(k, v) {
  mem.set(k, String(v));
  dirty.add(k);
  schedule();
}

export function removeItem(k) {
  mem.delete(k);
  dirty.add(k);
  schedule();
}

/* ---------------------------------------------------- imported courses --
 * Held in memory so the library index stays synchronous; a course is text and
 * a big one is under half a megabyte, so the whole shelf costs little.
 */
export const allBooks = () => [...books.values()];
export const getBook = id => books.get(id) || null;

export function putBook(rec) {
  books.set(rec.id, rec);
  if (db) db.transaction(COURSES, "readwrite").objectStore(COURSES).put(rec);
}

export function dropBook(id) {
  books.delete(id);
  if (db) db.transaction(COURSES, "readwrite").objectStore(COURSES).delete(id);
}

/* --------------------------------------------------------------- the log --*/

/** Rows in timestamp order. The array is shared; callers must not mutate it. */
export const logRows = () => rows;

/** Append one row. `id` must already be set and globally unique. */
export function appendRow(row) {
  if (!row || typeof row.id !== "string" || !row.id)
    throw new Error("a log row needs an id — it is the store's key and the sync unit");
  rows.push(row);
  pending.push(row);
  schedule();
}

/** Merge rows from another device. Returns how many were new. */
export function mergeRows(incoming) {
  const seen = new Set(rows.map(r => r.id));
  let n = 0;
  for (const r of incoming) {
    if (!r || !r.id || seen.has(r.id)) continue;
    seen.add(r.id); rows.push(r); pending.push(r); n++;
  }
  if (n) { rows.sort((a, b) => a.ts - b.ts); schedule(); }
  return n;
}

/* Which of our rows the server has. Local bookkeeping, never part of the
   synced payload: a timestamp cursor cannot express this, because two rows can
   share a millisecond and a device clock can move backwards. */
export function markSent(ids) {
  const set = new Set(ids);
  let n = 0;
  for (const r of rows) if (set.has(r.id) && !r.sent) { r.sent = 1; pending.push(r); n++; }
  if (n) schedule();
  return n;
}

export function clearLog() {
  rows = []; pending = [];
  if (db) db.transaction(LOG, "readwrite").objectStore(LOG).clear();
}
