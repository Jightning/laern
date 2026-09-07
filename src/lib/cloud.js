/* ============================================================================
 * src/lib/cloud.js — the owner's backup, and the only thing that leaves a device
 *
 * The site is public and works entirely offline: everything a reader does lives
 * in IndexedDB, and that is the whole product for everyone except the person
 * holding the secret. This file is what that one person gets — a copy of the
 * log and the courses on the account's own backend, so a wiped browser is a
 * download rather than a loss.
 *
 * Three properties, in the order they mattered:
 *
 * QUOTA. Cloudflare's free tier is metered per account, so the design spends
 * requests like they are scarce. Everything except a course body is one round
 * trip; a course body is fetched only when its content hash differs; and an
 * automatic sync happens at most once a day, or not at all when there is
 * nothing to send. Two devices cost two requests a day. A reader without the
 * secret makes none, ever — `configured()` is false and no call is attempted,
 * which is what keeps a stranger from spending the budget by opening the site.
 *
 * SECURITY. The payload is AES-GCM ciphertext under a key derived from the
 * secret, so the backend stores the log without being able to read it: item,
 * confidence, outcome, and the course material itself are opaque to it. What
 * it necessarily sees is metadata — row ids, device ids, timestamps, sizes.
 * The secret is therefore a key as well as a password: lose it and the
 * ciphertext is scrap, which is why `courses/` on disk stays the real backup.
 *
 * SIMPLICITY. One secret, pasted once per device. No address, because the
 * endpoint is this same origin; no account, no login, no client to install.
 * ==========================================================================*/
import { getItem, setItem, removeItem, logRows, mergeRows, markSent, flush } from "./store.js";
import { deviceId } from "./device.js";
import { importCourse, importedIndex, filesOf, versionOf, markSynced,
         removeCourse } from "./courses.js";
import { invalidate } from "./replay.js";
import { deriveKey, seal as sealBytes, open as openBytes, versionOfFiles } from "./seal.js";

const SECRET = "cloud:secret";
const CURSOR = "cloud:cursor";      /* server-assigned seq, never a clock */
const LAST   = "cloud:last";        /* last successful sync, ms */
const BIN    = "cloud:deletes";     /* removals waiting to be told to the server */
const SEEN   = "cloud:bin";         /* the account's bin, as of the last sync */

/* A day between automatic syncs. The number is a quota decision rather than a
   freshness one: answers are already durable locally the moment they are made,
   so syncing more often buys a shorter window on device loss and costs a
   multiple of the request budget. Manual sync exists for when that window
   matters — before wiping a phone, say. */
const AUTO_MS = 24 * 60 * 60 * 1000;

export const configured = () => !!getItem(SECRET);
export const lastSync = () => Number(getItem(LAST)) || 0;

/* What the account had in its bin when this device last looked. Kept locally so
   the panel can offer a restore on a cold page load: a safety net you can only
   see in the seconds after pressing a button is not one. */
export const bin = () => { try { return JSON.parse(getItem(SEEN)) || []; } catch { return []; } };

export function configure(secret) {
  const s = (secret || "").trim();
  if (s) setItem(SECRET, s); else removeItem(SECRET);
  key = null;                       /* re-derive on next use */
  /* Written through rather than left to the debounce. Every other write can
     wait 400ms because losing one is losing one answer; losing this is a device
     that silently stopped being connected, or one that still is after you told
     it to forget. */
  return flush();
}

/* The key, derived once per secret and held in memory. Derivation is
   deliberately slow (lib/seal.js), so it must not happen per row. */
let key = null;
const sealer = async () => {
  if (!key) key = await deriveKey(getItem(SECRET));
  return key;
};
const seal = async value => sealBytes(await sealer(), value);
const open = async text => openBytes(await sealer(), text);

/* ----------------------------------------------------------------- calling --*/
class Unauthorized extends Error {}

async function call(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json",
               authorization: `Bearer ${getItem(SECRET) || ""}` },
    body: JSON.stringify(payload)
  });
  if (res.status === 401 || res.status === 404) throw new Unauthorized();
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------- deletions ---
 * A course removed here has to be removed everywhere, so the id is queued and
 * carried on the next sync. It is queued rather than sent immediately for the
 * same reason everything else is: a delete is not worth a request of its own.
 */
const queued = () => { try { return JSON.parse(getItem(BIN)) || []; } catch { return []; } };

export function queueDelete(cid) {
  if (!configured()) return;
  const q = queued();
  if (!q.includes(cid)) setItem(BIN, JSON.stringify([...q, cid]));
}

/* --------------------------------------------------------------- courses ---*/

/* Whether a course this device holds has to be sent up.
 *
 * The account's listing is the only authority on what the account has. A local
 * `version` is a note about where a course *came from*, and it was wrong to
 * read it as "the account has this": a course pulled from a different server
 * carries that server's hash, so every course looked synced and nothing was
 * ever offered. Pure, and separated out, because the truth table is the bug.
 */
export function needsUpload(remote, localVersion, contentVersion) {
  /* Tombstoned there: the reader deleted it on another device and this sync is
     about to remove it here. Re-uploading would resurrect it. */
  if (remote && remote.deleted) return false;
  if (!remote) return true;                         /* the account has never seen it */
  return remote.version !== contentVersion;         /* it has an older copy */
}

/** Hand up anything the account does not have, or holds at an older version. */
async function pushCourses(listing) {
  const there = new Map(listing.map(c => [c.id, c]));
  const sent = [];
  for (const id of Object.keys(importedIndex())) {
    const remote = there.get(id);
    /* The cheap path first: the account lists this course at exactly the
       version this device recorded, so there is nothing to hash and nothing to
       send. Only a course that might differ costs a digest. */
    if (remote && !remote.deleted && versionOf(id) === remote.version) continue;
    if (remote && remote.deleted) continue;

    const files = filesOf(id);
    if (!files) continue;
    const version = await versionOfFiles(files);
    if (!needsUpload(remote, versionOf(id), version)) {
      markSynced(id, version);      /* already up there, just labelled wrongly here */
      continue;
    }
    await call("/api/course", { op: "put", id, version, enc: await seal(files) });
    markSynced(id, version);
    sent.push(id);
  }
  return sent;
}

/** Take down anything new, and apply the account's deletions locally. */
async function pullCourses(listing, taken) {
  const installed = [], removed = [];
  for (const c of listing) {
    const here = versionOf(c.id);
    const holding = !!importedIndex()[c.id];

    if (c.deleted) {
      /* The account says this is gone. Removing it here is what makes a
         deletion on one device mean anything on the others; the answer history
         stays, because learner state is keyed on the course code. */
      if (holding) { removeCourse(c.id); removed.push(c.id); }
      continue;
    }
    if (here === c.version) continue;

    const got = await call("/api/course", { op: "get", id: c.id });
    if (!got || !got.enc) continue;
    const files = await open(got.enc);
    const r = importCourse(c.id, files, taken, c.version);
    if (r.ok) installed.push(c.id);
    else console.warn(`${c.id}: ${r.errors.join("; ")}`);
  }
  return { installed, removed };
}

/* ------------------------------------------------------------------ sync ---*/
let running = false;

/**
 * One round trip for the log and the listing, then course bodies only where a
 * version differs. `manual` bypasses the once-a-day rule; nothing else does.
 */
export async function sync({ manual = false } = {}) {
  if (running || !configured() || !navigator.onLine) return null;

  const pending = logRows().filter(r => !r.sent && String(r.id).startsWith(deviceId() + ":"));
  const dropped = queued();
  const due = Date.now() - lastSync() > AUTO_MS;
  /* The cheapest request is the one not made. Automatic syncs run when the day
     is up; anything the reader asked for runs immediately. */
  if (!manual && !due && !dropped.length) return null;

  running = true;
  try {
    await flush();
    const dev = deviceId();
    const sealed = await Promise.all(
      pending.map(async r => ({ id: r.id, ts: r.ts, enc: await seal(r) })));

    let cursor = Number(getItem(CURSOR)) || 0;
    let merged = 0, listing = [], pages = 0, wrote = 0;
    /* Which courses the merged rows belong to: an open course has to be
       refolded rather than merely repainted, or it shows yesterday's schedule
       until the reader navigates away and back. */
    const touched = new Set();

    /* A backlog drains over pages; everything else rides the first one. */
    for (;;) {
      const res = await call("/api/sync", {
        device: dev, since: cursor,
        rows: pages === 0 ? sealed : [],
        deletes: pages === 0 ? dropped : [],
        restores: []
      });
      if (pages === 0) {
        wrote = res.written || 0;
        if (sealed.length) markSent(pending.map(r => r.id));
        if (dropped.length) removeItem(BIN);
        listing = res.courses || [];
      }
      const plain = [];
      for (const r of res.rows || []) {
        try { plain.push(await open(r.enc)); }
        catch { console.warn(`row ${r.id}: could not be decrypted with this secret`); }
      }
      if (plain.length) {
        merged += mergeRows(plain);
        for (const r of plain) if (r.course) { invalidate(r.course); touched.add(r.course); }
      }
      cursor = Number(res.cursor) || cursor;
      setItem(CURSOR, String(cursor));
      if (!res.more || ++pages > 100) break;
    }

    const uploaded = await pushCourses(listing);
    const taken = { ids: Object.keys(importedIndex()), codes: {} };
    const { installed, removed } = await pullCourses(listing, taken);

    setItem(LAST, String(Date.now()));
    setItem(SEEN, JSON.stringify(listing.filter(c => c.deleted)));
    if (merged || installed.length || removed.length)
      dispatchEvent(new CustomEvent("learn:synced", {
        detail: { merged, installed, removed, courses: [...touched] } }));

    return { ok: true, sent: wrote, merged, uploaded, installed, removed,
             bin: listing.filter(c => c.deleted) };
  } catch (e) {
    /* Cursors are only advanced on success, so a failure costs nothing but the
       attempt: the next sync resumes exactly where this one stopped. */
    return { ok: false, unauthorized: e instanceof Unauthorized, error: e.message };
  } finally {
    running = false;
  }
}

/** Bring a course back out of the bin. The body is still there until it is purged. */
export async function restore(cid) {
  if (!configured()) return null;
  try {
    const res = await call("/api/sync", { device: deviceId(), since: Number(getItem(CURSOR)) || 0,
                                          rows: [], deletes: [], restores: [cid] });
    const taken = { ids: Object.keys(importedIndex()), codes: {} };
    const { installed } = await pullCourses((res.courses || []).filter(c => c.id === cid), taken);
    return { ok: true, installed };
  } catch (e) {
    return { ok: false, unauthorized: e instanceof Unauthorized, error: e.message };
  }
}

/** On load, once a day, and only for the owner. No listeners, no polling. */
export function auto() {
  if (!configured()) return;
  sync();
}
