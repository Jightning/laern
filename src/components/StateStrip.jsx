import { counts, configOf, get } from "../lib/retention.js";
import { retrievability } from "../lib/schedule.js";

/* The two loops, side by side, and the gap between them.
 *
 * "Types cleared 38/43, concepts durable 12/29" is a reader who has understood
 * the material and will not hold it — the exact profile a successful cram
 * produces, and the thing no single number can say. */
/** what the model expects the reader to still hold on the day */
function meanRecall(cid, keys, cfg) {
  const held = keys.map(k => get(cid, k)).filter(c => c && c.reps);
  if (!held.length) return null;
  return held.reduce((m, c) => m + retrievability(c, cfg.deadline, cfg.target), 0) / held.length;
}

export default function StateStrip({ ctx, drills }) {
  const { C, cid, idx, state } = ctx;
  const a = state.on ? state.stats(idx.QALL.map(q => q.id)) : null;
  if (!a && !drills.has) return null;

  const cfg = configOf(C);
  const b = drills.has ? counts(cid, drills.keys) : null;
  const exam = cfg.deadline && b && b.seen ? meanRecall(cid, drills.keys, cfg) : null;

  return (
    <div class="strip">
      {a && <span class="strip-i"><b>{a.got}/{a.total}</b> types cleared</span>}
      {b && <span class="strip-i"><b>{b.durable}/{b.total}</b> concepts durable</span>}
      {b && <span class="strip-i"><b>{b.due}</b> due today</span>}
      {exam != null && (
        <span class="strip-i">
          exam {new Date(cfg.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {" · "}<b>predicted recall {exam.toFixed(2)}</b>
        </span>
      )}
    </div>
  );
}
