/* Concept grouping.
 *
 * A flat list ranked by usage count answers "which of these matters most" and
 * nothing else. Past roughly ten concepts the more useful question is "when do
 * I first need this", so concepts are grouped by the earliest section that
 * uses them — the course's own order, derived from the content rather than
 * declared. Usage count still orders within a group.
 */
/* Below this many concepts, grouping produces a page of one-card groups —
   more headings than content, which is worse than the ranked list it replaced. */
const GROUP_AT = 8;

export function groupConcepts(C, CUSE, SUBS) {
  const firstSec = k => {
    const uses = CUSE[k] || [];
    let best = null;
    for (const id of uses) {
      const e = SUBS[id];
      if (e && (!best || e.sec.num < best.num)) best = e.sec;
    }
    return best;
  };

  const groups = new Map();     /* section id -> {sec, keys} */
  const orphans = [];

  for (const k of Object.keys(C.concepts || {})) {
    const sec = firstSec(k);
    if (!sec) { orphans.push(k); continue; }
    if (!groups.has(sec.id)) groups.set(sec.id, { sec, keys: [] });
    groups.get(sec.id).keys.push(k);
  }

  const byUse = (a, b) => (CUSE[b] || []).length - (CUSE[a] || []).length;

  const all = Object.keys(C.concepts || {});
  if (all.length < GROUP_AT)
    return [{ sec: null, flat: true, keys: all.sort(byUse) }];

  const out = [...groups.values()]
    .sort((a, b) => a.sec.num - b.sec.num)
    .map(g => ({ sec: g.sec, flat: false, keys: g.keys.sort(byUse) }));

  if (orphans.length) out.push({ sec: null, flat: false, keys: orphans.sort(byUse) });
  return out;
}
