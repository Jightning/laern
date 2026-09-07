import { useState, useMemo, useEffect } from "preact/hooks";
import { INDEX, ORDER, getAll } from "../lib/library.js";
import { indexDrills } from "../lib/drills.js";
import { buildQueue } from "../lib/queue.js";
import { counts } from "../lib/retention.js";
import DrillRun from "./DrillRun.jsx";

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
    return (
      <div class="review done">
        <ReviewBar i={queue.length} n={queue.length} onClose={onClose} />
        <h1>{queue.length ? "Session complete." : "Nothing due."}</h1>
        <p class="lede">
          {queue.length
            ? "Come back tomorrow, a concept recalled once in each of three spaced sessions outlasts one recalled three times today."
            : "Concepts enter review two ways: open a concept's entry and drill it, or miss a quiz question you were confident about — that one is queued for the next day."}
        </p>
        {/* Only the forward action. Close lives in the bar above, where it sits
            during the session too, so repeating it here put two identical
            controls on a screen short enough to show both at once. */}
        {queue.length > 0 && (
          <div class="review-nav">
            <button class="dbtn" id="rv-again" onClick={again}>Another set</button>
          </div>
        )}
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
