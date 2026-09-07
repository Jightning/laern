/* One review session, assembled across every course.
 *
 * The scheduler is cross-course, so the queue is too: a reader with four
 * courses gets one queue, not four.
 *
 * Order inside a session follows the evidence rather than convenience. A
 * concept below criterion is drilled blocked, because interleaving costs a
 * learner who cannot yet tell the categories apart; a concept at criterion is
 * drilled beside the things it gets confused with, because that is where
 * interleaving pays (Brunmair & Richter 2019).
 */
import { get, isDue, phase, configOf } from "./retention.js";
import { retrievability } from "./schedule.js";

const CRITERION = 3;

/** every concept in contact and due, worst recall first, recruits ahead of all */
function dueConcepts(books, now) {
  const out = [];
  for (const { cid, C, drills } of books) {
    const { target } = configOf(C);
    for (const key of drills.keys) {
      const c = get(cid, key);
      if (!c || !isDue(c, now)) continue;
      out.push({ cid, C, drills, key, c, phase: phase(c),
                 r: c.reps ? retrievability(c, now, target) : -1 });
    }
  }
  return out.sort((a, b) => a.r - b.r);
}

export function buildQueue(books, { limit = 20, now = Date.now() } = {}) {
  const pool = dueConcepts(books, now);
  const taken = new Set();
  const rows = [];

  for (const e of pool) {
    if (rows.length >= limit) break;
    if (taken.has(e.cid + "/" + e.key)) continue;

    if (e.phase === "new" || e.phase === "learning") {
      /* blocked: as many distinct items as the criterion still wants */
      taken.add(e.cid + "/" + e.key);
      const want = CRITERION - e.c.items.length;
      const seen = [...e.c.items];
      for (let i = 0; i < want && rows.length < limit; i++) {
        const item = e.drills.pick(e.key, seen);
        if (!item || seen.includes(item.id)) break;
        seen.push(item.id);
        rows.push({ cid: e.cid, C: e.C, key: e.key, item, phase: e.phase, cluster: null });
      }
    } else {
      /* interleaved: this concept and everything it is confused with, one each */
      const mates = e.drills.cluster(e.key)
        .map(k => pool.find(x => x.cid === e.cid && x.key === k))
        .filter(x => x && !taken.has(x.cid + "/" + x.key));
      const names = mates.length > 1 ? mates.map(m => (m.C.concepts[m.key] || {}).term || m.key) : null;
      for (const m of mates) {
        if (rows.length >= limit) break;
        taken.add(m.cid + "/" + m.key);
        const item = m.drills.pick(m.key, m.c.items);
        if (item) rows.push({ cid: m.cid, C: m.C, key: m.key, item, phase: m.phase, cluster: names });
      }
    }
  }
  return rows;
}

/** how many concepts are waiting, across every course — the topbar's number */
export function dueCount(books, now = Date.now()) {
  return dueConcepts(books, now).length;
}
