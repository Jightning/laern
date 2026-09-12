/* Reading depth: how much of each block is on the page.
 *
 * Depth is not tier. Tier asks *which blocks belong to the argument* and
 * removes the ones that do not; depth asks *how much of each block* and closes
 * the rest in place. They are orthogonal, and neither can be fixed toward the
 * other — which is what a course whose blocks are 99% spine proves: filtering
 * by tier cannot produce an overview, because there is nothing to filter out.
 *
 *   full    the block entire. What has always shipped.
 *   notes   the block's claim, its development closed. ~a fifth of the prose.
 *   index   the block's name alone. Its claim closed too.
 *
 * Every depth expands per block, in place, at any time, so no depth is ever a
 * subset of the course: it is the same course at a different resolution.
 *
 * The evidence is specific about what this buys and what it does not. A
 * provided outline of a text raises memory (g = 0.61) and does *not* reliably
 * raise comprehension (g = 0.34, n.s.; Ponce, Mayer & Méndez 2023, Educational
 * Research Review). So `notes` and `index` are review and lookup surfaces, and
 * `full` remains what a first read means — which is why `full` is the default
 * and nothing nudges a reader off it.
 */
import { getItem, setItem, removeItem } from "./store.js";

export const DEPTHS = [
  { id: "full",  label: "Full",  hint: "every word" },
  { id: "notes", label: "Notes", hint: "claims only" },
  { id: "index", label: "Index", hint: "names only" }
];

export const DEPTH_IDS = DEPTHS.map(d => d.id);

const KEY = cid => `depth:${cid}`;

/* Full, not Notes, is the default. An outline does not carry comprehension, so
   a reader who has not asked for one should never be handed it in place of the
   material. The fast pass is one key away. */
export function depthFor(cid) {
  const v = getItem(KEY(cid));
  return DEPTH_IDS.includes(v) ? v : "full";
}

export function setDepth(cid, d) {
  if (DEPTH_IDS.includes(d)) setItem(KEY(cid), d);
}

/** the next depth in the cycle, for the single-key binding and the narrow control */
export function nextDepth(d) {
  const i = DEPTH_IDS.indexOf(d);
  return DEPTH_IDS[(i + 1) % DEPTH_IDS.length];
}

/** Forget the depth a course was being read at. lib/purge.js is the caller. */
export function dropDepth(cid) { removeItem(KEY(cid)); }
