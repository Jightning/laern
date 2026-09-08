#!/usr/bin/env node
/* Removing a course takes its answers with it — all of them, and only its own.
 *
 * The reader's history is spread over seven stores that each key on the course
 * differently: Loop A on the course *code*, Loop B under a shared `retain:v1`
 * blob, notes and reasons as families of prefixed keys, the lane and the replay
 * checkpoint as single keys, and the outcome log as rows. A purge that misses
 * one is worse than no purge at all: the checkpoint alone would refold the log
 * straight back on the next load, and a stale Loop A row would resurface under
 * a different course that happens to share a code.
 *
 * So the assertions are two-sided. Everything about the removed course is gone,
 * and everything about the course beside it is untouched — the second half is
 * the one that catches a prefix sweep written slightly too wide.
 *
 *   node tools/test-purge.mjs
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

/* No indexedDB in node, so store.js keeps everything in its memory mirror and
   never opens a database. That is the same read model the app uses. */
const store = await import("../src/lib/store.js");
const { keys, logRows } = store;
const { stateFor, forget } = await import("../src/lib/state.js");
const R = await import("../src/lib/retention.js");
const { writeNote, readNote, setFolded, isFolded } = await import("../src/lib/notes.js");
const { pushWhy, lastWhy } = await import("../src/lib/why.js");
const { laneFor, setLane } = await import("../src/lib/tiers.js");
const { append, forCourse } = await import("../src/lib/log.js");
const { rebuild } = await import("../src/lib/replay.js");
const { purge } = await import("../src/lib/purge.js");

/* Two courses, so "gone" can be told apart from "everything is gone". `code`
   differs from `id` deliberately: Loop A keys on the code, and a purge that
   assumed the id would silently leave the ratings behind. */
const A = { id: "alpha", code: "AL 101", state: {}, retention: {}, sections: [] };
const B = { id: "beta",  code: "BE 202", state: {}, retention: {}, sections: [] };

/* Live one course, through the same calls the components make. */
function live(C) {
  const st = stateFor(C.id, C);
  st.rate("q1", true, false);
  st.rate("q2", false, true);
  R.answer(C.id, "concept-1", { itemId: "d1", correct: true, conf: "sure" });
  R.answer(C.id, "concept-2", { itemId: "d2", correct: false, conf: "guess" });
  writeNote(C.id, "s1-1", "what the lecture actually said");
  writeNote(C.id, "s1-2#3", "a note anchored to one block");
  setFolded(C.id, "s1-1", true);          /* the fold set is a key of its own */
  pushWhy(C.id, "q1", { text: "because the coefficient is constant", correct: true });
  setLane(C.id, "all");
  append({ course: C.id, loop: "A", itemId: "q1", concept: "concept-1",
           confidence: "sure", correct: false, ts: Date.now() });
  append({ course: C.id, loop: "B", itemId: "d1", concept: "concept-1",
           confidence: "sure", correct: true });
  rebuild(C.id, C);              /* writes the checkpoint */
}
live(A); live(B);

/* What "this course has history" means, asked the way the app asks it. */
const held = C => ({
  study: !!stateFor(C.id, C).get("q1"),
  retain: !!R.get(C.id, "concept-1"),
  note: readNote(C.id, "s1-1"),
  note2: readNote(C.id, "s1-2#3"),
  fold: isFolded(C.id, "s1-1"),
  why: !!lastWhy(C.id, "q1"),
  lane: laneFor(C.id),
  ckpt: keys().includes(`ckpt:${C.id}`),
  rows: forCourse(C.id).length
});

const beforeA = held(A), beforeB = held(B);
check("the fixture actually wrote something",
      beforeA.study && beforeA.retain && beforeA.note && beforeA.why &&
      beforeA.fold && beforeA.lane === "all" && beforeA.ckpt && beforeA.rows === 2,
      JSON.stringify(beforeA));

const dropped = await purge(A.id, A.code);
forget();                        /* stateFor memoises; the app's own drop calls this */

const afterA = held(A), afterB = held(B);

check("Loop A ratings are gone",        afterA.study === false);
check("Loop B schedule is gone",        afterA.retain === false);
check("the subsection note is gone",    afterA.note === "");
check("the block-anchored note is gone", afterA.note2 === "");
check("the stated reason is gone",      afterA.why === false);
/* The fold set is a separate key beside the note bodies, so a prefix sweep of
   the bodies alone would leave it behind. */
check("which notes were folded is gone", afterA.fold === false);
check("the reading lane is forgotten",  afterA.lane === "apply", afterA.lane);
check("the replay checkpoint is gone",  afterA.ckpt === false);
check("the outcome rows are gone",      afterA.rows === 0, String(afterA.rows));
check("purge reports what it dropped",  dropped === 2, String(dropped));

check("the other course keeps everything",
      JSON.stringify(afterB) === JSON.stringify(beforeB),
      `${JSON.stringify(beforeB)} -> ${JSON.stringify(afterB)}`);

/* No keys anywhere still name the purged course. Catches a store this file
   does not know about yet. */
const leftover = keys().filter(k => k.includes(A.id) ||
                                    k === "study:" + A.code.replace(/\s+/g, ""));
check("no key still names the removed course", leftover.length === 0, leftover.join(", "));
check("the log has only the other course's rows",
      logRows().every(r => r.course === B.id), String(logRows().length));

/* The checkpoint is the trap: leave it and the next rebuild returns it
   verbatim, so the reader sees the schedule of a course they deleted. This runs
   last because a rebuild writes an empty checkpoint back, which is fine but
   would show up in the leftover sweep above. */
rebuild(A.id, A);
forget();
check("a rebuild after the purge finds nothing to fold",
      held(A).study === false && held(A).retain === false);

/* Purging a course that was never lived in is a no-op, not a throw: the sync
   path calls it for a tombstone this device may never have opened. */
let threw = null;
try { check("purging an unknown course drops nothing", (await purge("never", "NV 1")) === 0); }
catch (e) { threw = e; }
check("purging an unknown course does not throw", threw === null, threw && threw.message);

console.log(fail.length ? `\n${fail.length} failed` : "\nall passed");
process.exit(fail.length ? 1 : 0);
