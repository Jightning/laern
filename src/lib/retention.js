/* Loop B state: what the reader still holds, keyed by concept.
 *
 * Loop A (src/lib/state.js) keys on question type and asks whether the surface
 * is covered. This keys on concept and asks whether the idea survives six
 * weeks. The two never mix: a drill success never marks a quiz type cleared.
 *
 * Retrieval runs to a criterion of three correct recalls on three *distinct*
 * items, then relearns across three spaced sessions (Rawson & Dunlosky 2011).
 * Everything a criterion needs is derivable from two lists, so only those are
 * stored — a stored `durable` flag would be derived data by another name.
 */
import { review, grade, due, nextDeadline } from "./schedule.js";
import { getItem, setItem } from "./store.js";

const KEY = "retain:v1";
const DAY = 864e5;
const CRITERION = 3;   /* distinct items recalled correctly */
const RELEARN = 3;     /* spaced sessions after criterion */

const day = t => new Date(t).toISOString().slice(0, 10);

/* How hard this course is held. A one-credit seminar does not need 0.90, and
 * an exam date turns the schedule around to aim at it. */
export const configOf = C => ({
  target: Number((C.retention || {}).target) || 0.9,
  deadline: nextDeadline((C.retention || {}).deadlines)
});

let db;
function load() {
  if (db) return db;
  try { db = JSON.parse(getItem(KEY)) || {}; } catch { db = {}; }
  return db;
}
const save = () => setItem(KEY, JSON.stringify(db));

const blank = () => ({ s: 0, d: 0, last: 0, reps: 0, items: [], relearnDays: [], ok: false });

export function get(cid, key) {
  return (load()[cid] || {})[key] || null;
}

/** A concept enters Loop B on first contact, never before — otherwise day one
 *  is a queue of every concept in every course, and the queue is the product. */
export function contact(cid, key) {
  const d = load();
  d[cid] ||= {};
  if (!d[cid][key]) { d[cid][key] = blank(); save(); }
  return d[cid][key];
}

/** T18: a confident miss in Loop A recruits the concept at a short interval. */
export function recruit(cid, key) {
  const c = contact(cid, key);
  c.dueAt = Date.now() + DAY;
  save();
  return c;
}

/* One Loop B answer, as a pure function of the previous concept state. Both
   `answer` (live) and lib/replay.js (rebuilding from the log) go through this,
   so a replayed schedule is identical to the one that was lived. */
export function step(prev, { itemId, correct, conf, target = 0.9, deadline = null, now = Date.now() }) {
  const c = prev
    ? { ...prev, items: [...(prev.items || [])], relearnDays: [...(prev.relearnDays || [])] }
    : blank();
  Object.assign(c, review(c.reps ? c : null, grade(correct, conf), now, target));
  c.reps++;
  c.ok = !!correct;
  if (correct) {
    if (c.items.length < CRITERION) {
      if (!c.items.includes(itemId)) c.items.push(itemId);
    } else {
      const t = day(now);
      if (!c.relearnDays.includes(t)) c.relearnDays.push(t);
    }
  }
  c.dueAt = due(c, { target, deadline });
  return c;
}

export function answer(cid, key, opts) {
  const c = contact(cid, key);
  Object.assign(c, step(c, opts));
  save();
  return c;
}

/** "new" · "learning" · "criterion" · "durable" — named in text, never by colour */
export function phase(c) {
  if (!c || !c.reps) return "new";
  if (c.items.length < CRITERION) return "learning";
  if (c.relearnDays.length >= RELEARN && c.ok) return "durable";
  return "criterion";
}

export function label(c) {
  switch (phase(c)) {
    case "new": return "not started";
    case "learning": return `learning · ${c.items.length} of ${CRITERION} items`;
    case "criterion": return `at criterion · ${c.relearnDays.length} of ${RELEARN} relearn sessions`;
    default: return "durable";
  }
}

export const isDue = (c, now = Date.now()) => !c || !c.reps || !c.dueAt || c.dueAt <= now;

export function counts(cid, keys) {
  const d = load()[cid] || {};
  const n = { total: keys.length, seen: 0, criterion: 0, durable: 0, due: 0 };
  for (const k of keys) {
    const c = d[k];
    if (!c) continue;                    /* not in contact: not the queue's business */
    if (isDue(c)) n.due++;
    if (!c.reps) continue;
    n.seen++;
    const p = phase(c);
    if (p === "durable") n.durable++;
    else if (p === "criterion") n.criterion++;
  }
  return n;
}

export function reset(cid) {
  const d = load();
  if (cid) delete d[cid]; else db = {};
  save();
}

/** Replace one course's Loop B state wholesale. lib/replay.js is the caller. */
export function install(cid, byKey) {
  const d = load();
  d[cid] = byKey;
  save();
}
