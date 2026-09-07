#!/usr/bin/env node
/* Replaying the log must reproduce the state that living it produced.
 *
 * This is the invariant the whole sync design rests on: devices exchange only
 * the outcome log, and everything else is refolded from it. If the fold and
 * the live path can disagree, a sync silently rewrites a reader's schedule.
 *
 *   node tools/test-replay.mjs
 */

const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { step } = await import("../src/lib/retention.js");
const { rateStep } = await import("../src/lib/state.js");
const { fold } = await import("../src/lib/replay.js");

const DAY = 864e5;
const T0 = Date.UTC(2026, 0, 1);
const cfg = { target: 0.9, deadline: null };

/* A plausible run: two concepts, mixed outcomes, spread over weeks. */
const script = [
  { loop: "B", concept: "sep", itemId: "sep-1", correct: true,  confidence: "sure",  day: 0 },
  { loop: "B", concept: "sep", itemId: "sep-2", correct: false, confidence: "sure",  day: 2 },
  { loop: "B", concept: "sep", itemId: "sep-2", correct: true,  confidence: "unsure", day: 3 },
  { loop: "B", concept: "lin", itemId: "lin-1", correct: true,  confidence: "guess", day: 3 },
  { loop: "B", concept: "sep", itemId: "sep-3", correct: true,  confidence: "sure",  day: 10 },
  { loop: "B", concept: "sep", itemId: "sep-1", correct: true,  confidence: "sure",  day: 24 },
  { loop: "B", concept: "lin", itemId: "lin-2", correct: false, confidence: "unsure", day: 30 },
  { loop: "A", concept: "sep", itemId: "q-sep-1", correct: true,  confidence: "sure",  day: 1 },
  { loop: "A", concept: "lin", itemId: "q-lin-1", correct: false, confidence: "sure",  day: 5 },
  { loop: "A", concept: "lin", itemId: "q-lin-1", correct: true,  confidence: "unsure", day: 12 }
];
const rows = script
  .map((e, i) => ({ id: `dev:${i}`, ts: T0 + e.day * DAY, course: "c", ...e }))
  .sort((a, b) => a.ts - b.ts);

/* --- the lived path: apply the same transitions as the components do ------ */
const lived = { retain: {}, study: {} };
for (const r of rows) {
  if (r.loop === "B") {
    lived.retain[r.concept] = step(lived.retain[r.concept] || null, {
      itemId: r.itemId, correct: r.correct, conf: r.confidence,
      target: cfg.target, deadline: cfg.deadline, now: r.ts
    });
  } else {
    lived.study[r.itemId] = rateStep(lived.study[r.itemId] || null,
      r.confidence === "sure", r.correct, r.ts);
    if (r.confidence === "sure" && !r.correct) {
      const c = lived.retain[r.concept] || null;
      lived.retain[r.concept] = {
        ...(c || { s: 0, d: 0, last: 0, reps: 0, items: [], relearnDays: [], ok: false }),
        dueAt: r.ts + DAY
      };
    }
  }
}

const replayed = fold(rows, cfg);

console.log("replay vs lived");
check("Loop B state matches",
  JSON.stringify(replayed.retain) === JSON.stringify(lived.retain),
  `\n    lived    ${JSON.stringify(lived.retain.sep)}\n    replayed ${JSON.stringify(replayed.retain.sep)}`);
check("Loop A state matches",
  JSON.stringify(replayed.study) === JSON.stringify(lived.study),
  `\n    lived    ${JSON.stringify(lived.study)}\n    replayed ${JSON.stringify(replayed.study)}`);

/* --- a fold is a fold: splitting it at a checkpoint changes nothing ------- */
const cut = T0 + 5 * DAY;
const first = fold(rows.filter(r => r.ts <= cut), cfg);
const second = fold(rows.filter(r => r.ts > cut), cfg, first);
console.log("checkpoint");
check("resuming from a checkpoint equals one pass",
  JSON.stringify(second.retain) === JSON.stringify(replayed.retain) &&
  JSON.stringify(second.study) === JSON.stringify(replayed.study));

/* --- merge order must not matter: rows arrive from two devices ----------- */
const shuffled = rows.slice().reverse().sort((a, b) => a.ts - b.ts);
const merged = fold(shuffled, cfg);
console.log("merge");
check("union sorted by ts is order-independent",
  JSON.stringify(merged.retain) === JSON.stringify(replayed.retain));

/* --- scheduling actually advanced, so the test is not vacuous ------------ */
console.log("sanity");
check("stability grew across reviews", replayed.retain.sep.s > 0);
check("criterion tracked distinct items", replayed.retain.sep.items.length >= 2);
check("a due date exists", replayed.retain.sep.dueAt > T0);

console.log(fail.length ? `\n${fail.length} failing` : "\nall passing");
process.exit(fail.length ? 1 : 0);
