/* ============================================================================
 * src/lib/purge.js — erase one course's answers from this device
 *
 * Removing a course used to leave everything the reader had answered in it
 * behind, on the reasoning that learner state is keyed on the course code and
 * a re-add should restore it. That is a good property for *hiding* the bundled
 * guide, which is reversible by design. It is the wrong one for Remove: an
 * imported course is the only copy on the device, so "remove" is the reader
 * saying they are done with it, and orphaned state has no way of ever being
 * seen again — it is dead weight in a store that phones evict under pressure.
 *
 * So Remove now destroys, and this is the one place that knows what "destroy"
 * covers. It composes rather than reaches: every module keeps ownership of its
 * own key shape and exports the drop for it, because a purge that spelled the
 * keys out itself would silently miss the next one added.
 *
 *   Loop A ratings      state.drop        study:<code>
 *   Loop B schedule     retention.reset   retain:v1 → [cid]
 *   notes               notes.dropNotes   note:<cid>:*
 *   stated reasons      why.dropWhy       why:<cid>:*
 *   reading lane        tiers.dropLane    lane:<cid>
 *   replay checkpoint   replay.invalidate ckpt:<cid>
 *   outcome rows        log.dropCourse    the log itself
 *
 * The log goes last and matters most: everything above it is a fold over those
 * rows, so clearing the derived state alone would just refold it back on the
 * next load.
 * ==========================================================================*/
import { drop as dropStudy } from "./state.js";
import { reset as resetRetention } from "./retention.js";
import { dropNotes } from "./notes.js";
import { dropWhy } from "./why.js";
import { dropLane } from "./tiers.js";
import { invalidate } from "./replay.js";
import { dropCourse } from "./log.js";

/**
 * Erase everything this device holds about one course except the course
 * itself — lib/courses.removeCourse does that, and the two are always called
 * together. `code` is the course code, because Loop A is keyed on it; the id
 * is used as the fallback exactly as state.js does.
 *
 * Resolves once the rows are gone from disk. Returns how many there were.
 */
export function purge(cid, code) {
  dropStudy(cid, code);
  resetRetention(cid);
  dropNotes(cid);
  dropWhy(cid);
  dropLane(cid);
  invalidate(cid);
  return dropCourse(cid);
}
