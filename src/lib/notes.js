/* Learner notes, stored per course and anchored to a subsection or to a single
 * block within it.
 *
 * Writing your own explanation of material you have just read is generative
 * rather than passive, and gives a place to record what a lecture said that the
 * text does not. Notes are the learner's, so they are visually distinct from
 * course content and never mixed into it. */
import { getItem, setItem, removeItem, keys } from "./store.js";

/** `anchor` is a subsection id, optionally suffixed with #<block index> */
const key = (cid, anchor) => `note:${cid}:${anchor}`;

/* One anchor, one string. Still used by the pre-question attempt box, which
   holds a single answer and is not a note. */
export function readNote(cid, anchor) { return getItem(key(cid, anchor)) || ""; }

export function writeNote(cid, anchor, text) {
  if (text && text.trim()) setItem(key(cid, anchor), text);
  else removeItem(key(cid, anchor));
}

/* A block can carry several notes: a lecture adds one thing, a past paper
   another, and forcing them into one textarea makes the reader edit around
   what they already wrote.
 *
 * They are stored as a JSON array under the same key a single note used, so a
 * value that does not parse as an array is a note written before this and is
 * read as the one note it was. A reader whose note is literally `["x"]` loses
 * that distinction; nobody has written one. */
export function readNotes(cid, anchor) {
  const raw = getItem(key(cid, anchor));
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter(t => typeof t === "string" && t.trim());
  } catch { /* not JSON at all: the legacy shape */ }
  return [raw];
}

/** Empty notes are dropped rather than stored, so "delete" is "clear it". */
export function writeNotes(cid, anchor, list) {
  const keep = (list || []).filter(t => t && t.trim());
  if (keep.length) setItem(key(cid, anchor), JSON.stringify(keep));
  else removeItem(key(cid, anchor));
}

/* Which of a course's notes the reader has folded shut.
 *
 * A note shows expanded by default, so only the exceptions are worth storing —
 * one small key per course rather than one per note, and nothing at all until
 * the reader folds something. */
const FOLD = cid => `nfold:${cid}`;
const folds = cid => {
  try { return new Set(JSON.parse(getItem(FOLD(cid))) || []); } catch { return new Set(); }
};

export const isFolded = (cid, anchor) => folds(cid).has(anchor);

export function setFolded(cid, anchor, on) {
  const set = folds(cid);
  if (on) set.add(anchor); else set.delete(anchor);
  if (set.size) setItem(FOLD(cid), JSON.stringify([...set]));
  else removeItem(FOLD(cid));
}

/** Erase every note on one course. A note is one key per anchor, so the bodies
 *  are a prefix sweep; the fold set is one key beside them and goes too.
 *  lib/purge.js is the caller. */
export function dropNotes(cid) {
  const pre = key(cid, "");
  for (const k of keys()) if (k.startsWith(pre)) removeItem(k);
  removeItem(FOLD(cid));
}
