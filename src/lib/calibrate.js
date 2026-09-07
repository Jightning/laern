/* Turning the outcome log into the two calibration questions.
 *
 * Metacognitive error is the reason effective strategies go unused: learners
 * misjudge what is working, so surfacing the misjudgement is the intervention.
 * Two judgements are checked here — the reader's confidence against their
 * outcomes, and the scheduler's predicted recall against the same outcomes.
 * Published benchmarks cannot answer the second one on this reader's data.
 */
const LEVELS = ["guess", "unsure", "sure"];
const BANDS = [0.5, 0.7, 0.85, 0.95, 1.01];

const rate = rows => (rows.length ? rows.filter(r => r.correct).length / rows.length : 0);

/** confidence against correctness. Confident-and-wrong is the headline. */
export function confidenceBands(rows) {
  const graded = rows.filter(r => r.correct != null && r.confidence);
  return LEVELS.map(level => {
    const hit = graded.filter(r => r.confidence === level);
    return { label: level, n: hit.length, rate: rate(hit), wrong: hit.filter(r => !r.correct).length };
  });
}

export const confidentMisses = rows =>
  rows.filter(r => r.confidence === "sure" && r.correct === false).length;

/** predicted recall against observed correctness, in bands */
export function modelBands(rows) {
  const graded = rows.filter(r => typeof r.predictedR === "number" && r.correct != null);
  let lo = 0;
  return BANDS.map(hi => {
    const hit = graded.filter(r => r.predictedR >= lo && r.predictedR < hi);
    const band = {
      label: `${lo.toFixed(2)}–${Math.min(hi, 1).toFixed(2)}`,
      n: hit.length,
      predicted: hit.length ? hit.reduce((m, r) => m + r.predictedR, 0) / hit.length : 0,
      observed: rate(hit)
    };
    lo = hi;
    return band;
  }).filter(b => b.n > 0);
}

/** how often the reader declined to state a reason before revealing (T32) */
export function skipRate(rows) {
  const asked = rows.filter(r => r.why);
  const skipped = asked.filter(r => r.why === "skipped").length;
  return { asked: asked.length, skipped, rate: asked.length ? skipped / asked.length : 0 };
}

/* Outside help, counted rather than forbidden. Students using an unrestricted
 * assistant during practice felt better and examined worse; what they lacked
 * was any signal about what it cost. This is that signal, beside the
 * confident-and-wrong number and describing the same thing from the other side. */
export const helpSought = rows => rows.filter(r => r.helpSought).length;
