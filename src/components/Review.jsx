import { useState, useMemo, useEffect } from "preact/hooks";
import { INDEX, ORDER, getAll } from "../lib/library.js";
import { indexDrills } from "../lib/drills.js";
import { buildQueue } from "../lib/queue.js";
import { counts } from "../lib/retention.js";
import DrillRun from "./DrillRun.jsx";
import { peek } from "../lib/place.js";

const SESSION = 20;   /* about ten minutes */

/* The on-the-go surface: one column, one question, no navigation to get lost
 * in. It is cross-course because the scheduler is — a reader with four courses
 * gets one queue, not four — and it is the place the file:// property pays off,
 * because daily review has to survive a train.
 */
export default function Review({ onClose }) {
  /* Only the courses that actually owe something. The index carries the drill
     keys, and whether a concept is due is local state, so the set is decided
     before a single course is fetched — the queue never pulls a library. */
  const wanted = useMemo(() => ORDER.filter(cid => {
    const keys = (INDEX[cid] || {}).drillKeys || [];
    return keys.length && counts(cid, keys).due > 0;
  }), []);

  const [books, setBooks] = useState(null);
  const [queue, setQueue] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let live = true;
    getAll(wanted).then(pairs => {
      if (!live) return;
      const bs = pairs
        .map(([cid, C]) => ({ cid, C, drills: indexDrills(C) }))
        .filter(b => b.drills.has);
      setBooks(bs);
      setQueue(buildQueue(bs, { limit: SESSION }));
    });
    return () => { live = false; };
  }, [wanted]);

  const again = () => { setQueue(buildQueue(books || [], { limit: SESSION })); setI(0); };

  if (books === null && wanted.length) {
    return (
      <div class="review done">
        <ReviewBar i={0} n={0} onClose={onClose} />
        <h1>Loading...</h1>
      </div>
    );
  }

  if (!queue.length || i >= queue.length) {
    /* Somewhere to go from here.
     *
     * An empty queue is the moment a reader decides whether to come back, and
     * "Nothing due." with a paragraph explaining the mechanism is the worst
     * answer the site can give: it is a dead end that reads as a scolding for
     * being early. Nothing due is a *good* state and it is also the only state
     * in which reading ahead is unambiguously the right thing to do.
     *
     * The course offered is the one the reader was last in, from the stored
     * place, falling back to the first on the shelf. It is a link rather than a
     * computed recommendation because the Desk is where that judgement lives —
     * this only has to not be a wall. */
    const p = peek();
    const lastCid = p && (p.hash.match(/^#\/([^/]+)/) || [])[1];
    const backTo = (lastCid && INDEX[lastCid] ? lastCid : null) || ORDER[0] || null;
    const backC = backTo ? INDEX[backTo] : null;

    return (
      <div class="review done">
        <ReviewBar i={queue.length} n={queue.length} onClose={onClose} />
        <h1>{queue.length ? "Session complete." : "Nothing is due."}</h1>
        <p class="lede">
          {queue.length
            ? "Come back tomorrow, a concept recalled once in each of three spaced sessions outlasts one recalled three times today."
            : "You are ahead of the schedule. Concepts arrive here when an interval comes due, or when you miss a question you were confident about."}
        </p>
        {/* Only the forward action. Close lives in the bar above, where it sits
            during the session too, so repeating it here put two identical
            controls on a screen short enough to show both at once. */}
        <div class="review-nav">
          {queue.length > 0 && (
            <button class="dbtn" id="rv-again" onClick={again}>Another set</button>
          )}
          {backC && (
            <a class="dbtn" href={`#/${backTo}`}>
              {queue.length ? "Back to" : "Read ahead in"} {backC.code || backC.title} →
            </a>
          )}
        </div>
      </div>
    );
  }

  const row = queue[i];
  return (
    <div class="review">
      <ReviewBar i={i} n={queue.length} onClose={onClose} />
      <DrillRun row={row} at={i} onNext={() => setI(i + 1)} />
    </div>
  );
}

/* Progress is dots and a count. Dots alone are shape and colour carrying
   meaning with no words, which is what T26 forbids. */
function ReviewBar({ i, n, onClose }) {
  return (
    <div class="review-bar">
      <span class="review-t">Review</span>
      <span class="review-dots" aria-hidden="true">
        {Array.from({ length: Math.min(n, 12) }, (_, k) =>
          <i key={k} class={k < i ? "on" : ""} />)}
      </span>
      <span class="review-n">{Math.min(i + 1, n)} of {n}</span>
      <button class="tbtn" onClick={onClose} aria-label="Leave review">Close</button>
    </div>
  );
}
