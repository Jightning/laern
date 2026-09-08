/* Block tiers, and the lane the reader is in.
 *
 * The spine is the whole course, stated once: definition, rule, mechanism, one
 * canonical instance. `depth` answers "why" and "what if"; `apply` instantiates
 * a concept the spine already states. The spine alone is complete — depth and
 * apply may lean on it, never the other way round — so collapsing them removes
 * repetition rather than material.
 */
import { getItem, setItem, removeItem } from "./store.js";
export const TIERS = ["spine", "depth", "apply"];

export const LANES = [
  { id: "spine", label: "Spine" },
  { id: "apply", label: "Spine + Apply" },
  { id: "all",   label: "All" }
];

const SHOWN = { spine: ["spine"], apply: ["spine", "apply"], all: TIERS };

export const tierOf = b => (TIERS.includes(b.tier) ? b.tier : "spine");

/* One line, one count per tier. The count is the signal, and it is text, so a
 * reader knows what they skipped instead of meeting an invisible hole. */
const NOUN = { depth: n => `${n} in depth`, apply: n => `${n} more application${n === 1 ? "" : "s"}` };

export function stubLabel(items) {
  const n = {};
  for (const it of items) n[tierOf(it.b)] = (n[tierOf(it.b)] || 0) + 1;
  return ["depth", "apply"].filter(t => n[t]).map(t => NOUN[t](n[t])).join(" · ");
}

/** blocks, grouped into runs the lane either shows or collapses into one stub */
export function runsOf(blocks, lane) {
  const shown = SHOWN[lane] || SHOWN.apply;
  const runs = [];
  blocks.forEach((b, i) => {
    const hidden = !shown.includes(tierOf(b));
    const last = runs[runs.length - 1];
    if (last && last.hidden === hidden) last.items.push({ b, i });
    else runs.push({ hidden, items: [{ b, i }] });
  });
  return runs;
}

const KEY = cid => `lane:${cid}`;

/* Spine + Apply, not Spine, is the default: a first read without worked
   instances is the wrong trade for a novice, and the fast pass is one key away
   and persists per course. */
export function laneFor(cid) { return getItem(KEY(cid)) || "apply"; }
export function setLane(cid, lane) { setItem(KEY(cid), lane); }

/** Forget which lane a course was being read in. lib/purge.js is the caller. */
export function dropLane(cid) { removeItem(KEY(cid)); }
