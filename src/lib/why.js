/* The reader's own reason, stated before the reveal.
 *
 * M6 and M7 make the author explain why an answer holds and why a wrong one is
 * tempting. Both are the author's reasoning; the reader produces none, so a
 * right answer for a wrong reason and a right answer for a sound reason are the
 * same row in state. This is where the reader's half is kept — learner content,
 * stored and styled apart from the material, like a note.
 */
import { getItem, setItem, removeItem, keys } from "./store.js";
const key = (cid, itemId) => `why:${cid}:${itemId}`;
const KEEP = 5;

const read = k => { try { return JSON.parse(getItem(k)) || []; } catch { return []; } };

/** the reason given last time, or null */
export function lastWhy(cid, itemId) {
  const h = read(key(cid, itemId));
  return h[h.length - 1] || null;
}

/** {text, skipped, correct, conf} — `ts` is added here */
export function pushWhy(cid, itemId, entry) {
  const k = key(cid, itemId);
  const h = read(k).concat({ ts: Date.now(), ...entry }).slice(-KEEP);
  setItem(k, JSON.stringify(h));
}

/** every reason the reader has given for a set of item ids, newest first */
export function whyFor(cid, itemIds) {
  const out = [];
  for (const id of itemIds)
    for (const e of read(key(cid, id))) out.push({ ...e, itemId: id });
  return out.filter(e => e.text).sort((a, b) => b.ts - a.ts);
}

/** Erase every reason the reader gave on one course — one key per item, so a
 *  prefix sweep. lib/purge.js is the caller. */
export function dropWhy(cid) {
  const pre = key(cid, "");
  for (const k of keys()) if (k.startsWith(pre)) removeItem(k);
}
