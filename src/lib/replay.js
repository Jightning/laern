/* ============================================================================
 * src/lib/replay.js — rebuild learner state from the outcome log
 *
 * Two devices cannot merge mutable state. If the phone and the laptop each
 * advanced a concept's FSRS stability, there is no principled way to combine
 * the two numbers, and picking one silently discards a session.
 *
 * The log has no such problem: rows are immutable, timestamped, and owned by
 * exactly one device, so merging is a union. Everything else is *derived* —
 * Loop A's per-question rows and Loop B's per-concept schedule are both a fold
 * over the log in timestamp order. Sync therefore moves only the log, and this
 * file recomputes the rest.
 *
 * The fold is exact because the transitions are pure and the scheduler takes
 * `now` as an argument: `retention.step` and `state.rateStep` are the same
 * functions the live path uses, fed logged timestamps instead of the clock.
 *
 * A checkpoint keeps it cheap. Replaying a year of rows on every load would be
 * slow, so the result is snapshotted with a watermark and later replays start
 * from there.
 * ==========================================================================*/
import { getItem, setItem, removeItem, logRows } from "./store.js";
import { step as retentionStep, install as installRetention, configOf } from "./retention.js";
import { rateStep, forget, keyFor } from "./state.js";

const DAY = 864e5;
const ckptKey = cid => `ckpt:${cid}`;

const readCkpt = cid => {
  try { return JSON.parse(getItem(ckptKey(cid))) || null; } catch { return null; }
};

/**
 * Fold `rows` (one course, ascending ts) onto a starting state.
 * Pure: no storage, no clock. Exported for tests.
 */
export function fold(rows, cfg, start = { retain: {}, study: {} }) {
  const retain = { ...start.retain };
  const study = { ...start.study };
  let last = start.ts || 0;

  for (const r of rows) {
    if (r.ts < last) continue;
    last = r.ts;

    if (r.loop === "B" && r.concept) {
      retain[r.concept] = retentionStep(retain[r.concept] || null, {
        itemId: r.itemId, correct: r.correct, conf: r.confidence,
        target: cfg.target, deadline: cfg.deadline, now: r.ts
      });
    } else if (r.loop === "A" && r.itemId) {
      /* The quiz records prediction and outcome in one row. */
      study[r.itemId] = rateStep(study[r.itemId] || null,
        r.confidence == null ? null : r.confidence === "sure",
        r.correct, r.ts);

      /* T18: a confident miss recruits the concept into Loop B at a short
         interval. It is re-derived rather than logged, because the event that
         causes it is already here. */
      if (r.concept && r.confidence === "sure" && !r.correct) {
        const c = retain[r.concept] || null;
        retain[r.concept] = { ...(c || blankish()), dueAt: r.ts + DAY };
      }
    }
  }
  return { retain, study, ts: last };
}

const blankish = () =>
  ({ s: 0, d: 0, last: 0, reps: 0, items: [], relearnDays: [], ok: false });

/**
 * Rebuild one course from the log and write it back.
 * `course` is the loaded course object; `cid` its folder id.
 */
export function rebuild(cid, course) {
  const cfg = configOf(course);
  const prior = readCkpt(cid);
  const rows = logRows().filter(r => r.course === cid && (!prior || r.ts > prior.ts));
  if (!rows.length && prior) return prior;

  const next = fold(rows, cfg, prior || undefined);
  installRetention(cid, next.retain);

  setItem(keyFor(cid, course.code), JSON.stringify({ q: next.study }));
  setItem(ckptKey(cid), JSON.stringify(next));
  forget(cid);
  return next;
}

/** Drop a checkpoint, so the next rebuild folds that course's whole log. */
export const invalidate = cid => removeItem(ckptKey(cid));
