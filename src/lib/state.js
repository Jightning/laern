/* Learner state: confidence calibration and spaced review, per course. */
import { getItem, setItem } from "./store.js";
const DAY = 864e5;
const cache = {};

/* One Loop A rating, as a pure function of the previous row. `rate` applies it
   to live state; lib/replay.js applies the same function to logged rows, which
   is the only reason two devices can be merged without losing either. */
export function rateStep(prev, conf, got, now = Date.now()) {
  const r = prev ? { ...prev } : { reps: 0, ease: 2.3, iv: 0, due: 0 };
  if (conf != null) r.conf = conf ? 1 : 0;
  if (got != null) {
    r.got = got ? 1 : 0; r.reps++;
    if (got) {
      r.iv = r.iv ? Math.round(r.iv * r.ease) : 1;
      r.ease = Math.min(3, r.ease + (r.conf ? 0.05 : 0.12));
    } else {
      r.iv = 0; r.ease = Math.max(1.4, r.ease - 0.25);
    }
    r.due = now + r.iv * DAY; r.last = now;
  }
  return r;
}

/** Forget a memoised course, so the next stateFor re-reads storage. Needed
    after lib/replay.js rewrites a course's Loop A rows from the log. */
export const forget = id => { if (id) delete cache[id]; else for (const k in cache) delete cache[k]; };

export function stateFor(id, course) {
  if (cache[id]) return cache[id];
  const on = !!(course.state && course.state.enabled !== false);
  const KEY = "study:" + String(course.code || id).replace(/\s+/g, "");
  let d = { q: {} };
  const raw = on && getItem(KEY);
  if (raw) { try { d = JSON.parse(raw) || d; } catch {} }
  if (!d.q) d.q = {};
  const save = () => { if (on) setItem(KEY, JSON.stringify(d)); };

  return (cache[id] = {
    on,
    get: qi => d.q[qi],
    /* conf: predicted success before revealing.  got: actual outcome. */
    rate(qi, conf, got) {
      d.q[qi] = rateStep(d.q[qi], conf, got);
      save(); return d.q[qi];
    },
    due: qi => { const r = d.q[qi]; return !r || !r.due || r.due <= Date.now(); },
    /* The same tally as `stats`, from a total rather than a list of ids. The
       library shows it before a course is fetched, and the ids live in the
       course. Unanswered questions are due by definition, so the two agree. */
    summary(total) {
      const s = { seen: 0, got: 0, missed: 0, over: 0, under: 0, due: 0, total };
      for (const r of Object.values(d.q)) {
        if (!r || r.got == null) continue;
        s.seen++;
        if (r.got) s.got++; else s.missed++;
        if (r.conf === 1 && !r.got) s.over++;
        if (r.conf === 0 && r.got) s.under++;
        if (r.due <= Date.now()) s.due++;
      }
      s.due += Math.max(0, total - s.seen);
      return s;
    },
    stats(ids) {
      const s = { seen: 0, got: 0, missed: 0, over: 0, under: 0, due: 0, total: ids.length };
      ids.forEach(qi => {
        const r = d.q[qi];
        if (!r || r.got == null) { s.due++; return; }
        s.seen++;
        if (r.got) s.got++; else s.missed++;
        if (r.conf === 1 && !r.got) s.over++;      /* the useful signal */
        if (r.conf === 0 && r.got) s.under++;
        if (r.due <= Date.now()) s.due++;
      });
      return s;
    },
    reset() { d = { q: {} }; save(); }
  });
}
