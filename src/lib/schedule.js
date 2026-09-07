/* The retention scheduler: difficulty, stability, retrievability.
 *
 * One question, asked of one concept: what is the probability this reader
 * recalls it right now? An interval is whatever holds that probability at the
 * course's target. An ease factor cannot answer it, which is why this is a DSR
 * model rather than the Leitner-shaped scheduler Loop A uses for coverage.
 *
 * ts-fsrs owns the fitted parameters; this file owns everything the site needs
 * that a card scheduler does not model — target retention per course, and
 * scheduling backwards from an exam date. Keeping that split means the vendor
 * choice is one import deep.
 */
import { FSRSAlgorithm, generatorParameters } from "ts-fsrs";

const DAY = 864e5;
const cache = {};

const algo = target =>
  (cache[target] ||= new FSRSAlgorithm(
    generatorParameters({ request_retention: target, enable_fuzz: false })));

/** FSRS grades a recall 1-4. Confidence is already captured, so it is used. */
export function grade(correct, conf) {
  if (!correct) return 1;
  return conf === "sure" ? 4 : conf === "guess" ? 2 : 3;
}

const daysBetween = (a, b) => Math.max(0, (b - a) / DAY);

/** probability of recall now, given memory {s} last reviewed at `last` */
export function retrievability(mem, now = Date.now(), target = 0.9) {
  if (!mem || !mem.s) return 0;
  return algo(target).forgetting_curve(daysBetween(mem.last, now), mem.s);
}

/** the memory state after one answer. `mem` is null on first contact. */
export function review(mem, g, now = Date.now(), target = 0.9) {
  const prior = mem && mem.s ? { stability: mem.s, difficulty: mem.d } : null;
  const next = algo(target).next_state(prior, prior ? daysBetween(mem.last, now) : 0, g);
  return { s: next.stability, d: next.difficulty, last: now };
}

/** days until retrievability decays to the target */
export const interval = (mem, target = 0.9) =>
  Math.max(1, algo(target).next_interval(mem.s, 0));

/* Deadline mode. The honest version of cramming: no interval steps over an
 * exam date, so "predicted recall on the day" is a number the reader has
 * actually been asked for rather than a mastery dot that says nothing about
 * Thursday. The cost is one extra review per concept per exam, which is what
 * the mode is for. */
export function due(mem, { target = 0.9, deadline = null } = {}) {
  const at = mem.last + interval(mem, target) * DAY;
  if (!deadline || deadline <= mem.last || at <= deadline) return at;
  return Math.max(mem.last + DAY, deadline - DAY);
}

/** the next exam date still ahead, from a course's configured deadlines */
export function nextDeadline(dates, now = Date.now()) {
  const ahead = (dates || []).map(d => +new Date(d)).filter(t => t > now).sort((a, b) => a - b);
  return ahead[0] || null;
}
