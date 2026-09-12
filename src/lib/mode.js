/* ============================================================================
 * src/lib/mode.js — three named intents over two axes
 *
 * Lane and depth are orthogonal and both are load-bearing: the lane decides
 * which blocks are in the argument, the depth decides how much of each one is
 * open, and a course whose blocks are 99% spine proves neither can stand in for
 * the other. That reasoning is right and nothing here changes it.
 *
 * What was wrong was where the reader met it. Both selectors sat between a
 * section's blurb and its first word — nine combinations, named after what the
 * engine filters rather than after what the reader is doing, unexplained, on
 * every section. A reader arriving to learn about Laplace transforms was asked
 * two taxonomy questions first.
 *
 * So the axes keep working and a preset layer sits over them. Three intents,
 * named for the reading they support rather than for the mechanism:
 *
 *   Study    the first pass — everything open, worked instances included
 *   Review   claims and structure, development closed — the week before an exam
 *   Index    names only — the lookup surface
 *
 * The third is "Index" rather than "Find": the site already has a Find, it is
 * bound to `/`, and it answers a different question. A mode is a resolution the
 * whole section is drawn at; search takes you somewhere.
 *
 * Nothing is removed. Every intent is a (lane, depth) pair the reader could
 * already have set by hand, `1` `2` `3` and `d` still move the axes directly,
 * and a pair matching no preset is reported as such rather than mislabelled —
 * `modeOf` returns null and the switch shows the nearest intent as edited. A
 * control that silently claims you are in Study while you are reading something
 * else is worse than no control.
 *
 * Study is `apply` × `full` because that is what the two axes already default
 * to, and because the evidence is specific that a provided outline carries
 * memory but not comprehension (g = 0.34, n.s.) — so nothing here nudges a
 * first read off the full text.
 * ==========================================================================*/

export const MODES = [
  { id: "study",  label: "Study",  lane: "apply", depth: "full",
    hint: "The full text — a first pass" },
  { id: "review", label: "Review", lane: "apply", depth: "notes",
    hint: "Claims and structure, development closed" },
  { id: "index",  label: "Index",  lane: "spine", depth: "index",
    hint: "Names only — the lookup surface" }
];

export const MODE_IDS = MODES.map(m => m.id);

export const modeById = id => MODES.find(m => m.id === id) || MODES[0];

/** The intent this (lane, depth) pair *is*, or null when it is neither. */
export function modeOf(lane, depth) {
  const m = MODES.find(x => x.lane === lane && x.depth === depth);
  return m ? m.id : null;
}

/**
 * The intent to show as current for a pair that matches none exactly.
 *
 * Depth is what the reader sees change, so it decides; the lane only narrows
 * within it. This is used for labelling alone — `modeOf` is still what says
 * whether the pair is actually a preset.
 */
export function nearestMode(lane, depth) {
  return (MODES.find(m => m.depth === depth) || MODES[0]).id;
}
