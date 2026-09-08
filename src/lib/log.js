/* The outcome log: every answer, with what the scheduler predicted before it.
 *
 * Without it, every claim this site makes about learning is an argument from
 * literature rather than a measurement on this reader. `predictedR` is what
 * makes the log a calibration set for two things at once — the reader's
 * metacognition and the model's parameters.
 *
 * Append-only, and now literally so. It used to be capped at 20,000 rows and
 * truncated from the front, which was necessary when localStorage gave it a
 * few megabytes. Two things changed that:
 *
 *   - IndexedDB (lib/store.js) has room, and appends one record instead of
 *     rewriting the whole array on every answer.
 *   - Loop A and Loop B state are now *derived* from this log (lib/replay.js),
 *     so dropping the oldest rows would silently corrupt every FSRS interval
 *     that depended on them.
 *
 * Pruning still exists, but only behind a checkpoint that already covers the
 * rows being dropped. That is `prune`, and replay.js is the only caller.
 */
import { logRows, appendRow, clearLog, mergeRows, dropRows } from "./store.js";
import { deviceId } from "./device.js";

let seq = 0;

/** {course, loop, concept, type, itemId, format, confidence, correct,
 *   latencyMs, predictedR, lane} — `ts` and `id` are added here */
export function append(row) {
  const ts = Date.now();
  appendRow({ id: `${deviceId()}:${ts}:${seq++}`, ts, ...row });
}

export const all = () => logRows().slice();
export const forCourse = cid => logRows().filter(r => r.course === cid);
export const usage = () => ({ n: logRows().length });
export const toJSON = () => JSON.stringify(logRows(), null, 1);

/**
 * Take an exported log back in. Rows are immutable and carry the id of the
 * device that wrote them, so this is the same union `sync` performs — importing
 * a file twice, or one that overlaps what is already here, changes nothing.
 *
 * Without this an export was a one-way door: a browser's storage is scoped to
 * its origin, so moving the app to a new hostname would otherwise strand every
 * answer on the old one.
 */
export function fromJSON(text) {
  let rows;
  try { rows = JSON.parse(text); } catch { throw new Error("that file is not valid JSON"); }
  if (!Array.isArray(rows)) throw new Error("expected a list of answer rows");
  const good = rows.filter(r => r && typeof r.id === "string" && Number.isFinite(r.ts));
  if (!good.length) throw new Error("no answer rows in that file");
  return { merged: mergeRows(good), skipped: rows.length - good.length };
}
export const clear = () => clearLog();

/**
 * Drop one course's rows. This is the only deletion that is not a checkpoint
 * prune, and it exists because removing a course now means removing what the
 * reader answered in it — the derived state is a fold over these rows, so
 * clearing that and leaving these would simply refold them back.
 */
export const dropCourse = cid => dropRows(r => r.course === cid);

/** Rows at or after `ts`, for an incremental sync push. */
export const since = ts => logRows().filter(r => r.ts >= ts);
