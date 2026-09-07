/* Learner notes, stored per course and anchored to a subsection or to a single
 * block within it.
 *
 * Writing your own explanation of material you have just read is generative
 * rather than passive, and gives a place to record what a lecture said that the
 * text does not. Notes are the learner's, so they are visually distinct from
 * course content and never mixed into it. */
import { getItem, setItem, removeItem } from "./store.js";

/** `anchor` is a subsection id, optionally suffixed with #<block index> */
const key = (cid, anchor) => `note:${cid}:${anchor}`;

export function readNote(cid, anchor) { return getItem(key(cid, anchor)) || ""; }

export function writeNote(cid, anchor, text) {
  if (text && text.trim()) setItem(key(cid, anchor), text);
  else removeItem(key(cid, anchor));
}
