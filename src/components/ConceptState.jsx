import { useState } from "preact/hooks";
import * as R from "../lib/retention.js";
import { whyFor } from "../lib/why.js";
import { ago } from "../lib/util.js";
import Drill from "./Drill.jsx";

/* Where M13's unit and M27's unit meet: the concept is the thing with one
 * definition site, and it is also the thing the scheduler tracks. This is the
 * page a reader revises one idea from. */
export default function ConceptState({ ctx, k }) {
  const { C, cid, idx, drills } = ctx;
  const [item, setItem] = useState(null);
  const items = drills.byConcept[k];
  if (!items) return null;

  const c = R.get(cid, k);
  const near = (C.concepts[k].confusable_with || []).filter(x => drills.byConcept[x]);
  const ids = [...items.map(d => d.id),
               ...Object.keys(idx.CQ).filter(q => idx.CQ[q] === k)];
  const reasons = whyFor(cid, ids).slice(0, 5);

  const start = () => { R.contact(cid, k); setItem(drills.pick(k, (c && c.items) || [])); };

  return (
    <div class="cstate">
      <div class="cstate-box">
        <span class="mn-k">State</span>
        <b>{R.label(c)}</b>
        {c && c.reps > 0 && c.dueAt && <span class="cstate-due">next in {days(c.dueAt)}</span>}
      </div>

      {near.length > 0 && (
        <p class="cstate-near">
          Confused with{" "}
          {near.map((x, i) => (
            <span key={x}>{i ? " · " : ""}<a href={`#/${cid}/c/${x}`}>{C.concepts[x].term}</a></span>
          ))}
        </p>
      )}

      {item
        ? <Drill cid={cid} C={C} item={item} onDone={() => setItem(null)} />
        : <button class="dbtn" id="c-drill" onClick={start}>
            Drill this  ·  {items.length} item{items.length === 1 ? "" : "s"} →
          </button>}

      {reasons.length > 0 && (
        <div class="appears" data-nosnippet>
          <h4>Your reasons</h4>
          <ol class="creasons">
            {reasons.map(r => (
              <li key={r.ts}>
                <q>{r.text}</q>
                <span class="creason-m">
                  {ago(r.ts)}{r.correct === false ? " · wrong" : r.correct ? " · right" : ""}
                  {r.conf === "sure" ? " · confident" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const days = at => {
  const d = Math.round((at - Date.now()) / 864e5);
  return d <= 0 ? "now" : d === 1 ? "1 day" : `${d} days`;
};
