import { useState, useRef } from "preact/hooks";
import * as R from "../lib/retention.js";
import { retrievability } from "../lib/schedule.js";
import { append } from "../lib/log.js";
import { pushWhy } from "../lib/why.js";
import WhyField from "./WhyField.jsx";
import { M } from "../lib/math.js";

/* One drill item: the Loop B unit.
 *
 * Confidence is three-way here, not the quiz's binary prediction, because it
 * feeds the scheduler's grade rather than a calibration count. The two loops
 * ask different questions and their controls say so.
 */
const LEVELS = ["guess", "unsure", "sure"];

export default function Drill({ cid, C, item, cluster, onDone }) {
  const [conf, setConf] = useState(null);
  const [why, setWhy] = useState(null);
  const [got, setGot] = useState(null);
  const [after, setAfter] = useState(null);
  const started = useRef(Date.now());

  const key = item.concept;
  const term = ((C.concepts || {})[key] || {}).term || key;
  const cfg = R.configOf(C);

  const grade = correct => {
    const before = R.get(cid, key);
    const predictedR = before && before.reps ? retrievability(before, Date.now(), cfg.target) : null;
    const next = R.answer(cid, key, { itemId: item.id, correct, conf, ...cfg });
    pushWhy(cid, item.id, { ...why, correct, conf });
    append({ course: cid, loop: "B", concept: key, itemId: item.id, format: item.format,
             confidence: conf, correct, latencyMs: Date.now() - started.current, predictedR,
             why: why.skipped ? "skipped" : "given" });
    setGot(correct);
    setAfter(next);
  };

  return (
    <div class="drill" data-drill={item.id}>
      <div class="drill-h">
        <span class="drill-c">{C.code} · {term}</span>
        <span class="drill-s">{R.label(R.get(cid, key))}</span>
      </div>
      {cluster && cluster.length > 1 && (
        <p class="drill-mix">These get mistaken for each other: {cluster.join(" · ")}.</p>
      )}

      <div class="drill-q" dangerouslySetInnerHTML={{ __html: M(item.stem) }} />

      {why == null ? (
        <>
          <div class="drill-conf">
            {LEVELS.map(l => (
              <button key={l} class={"cbtn" + (conf === l ? " sel" : "")} data-conf={l}
                      onClick={() => setConf(l)}>{l}</button>
            ))}
          </div>
          {conf && <WhyField cid={cid} itemId={item.id} prompt="Why? State it before you check."
                             onCommit={setWhy} />}
        </>
      ) : (
        <div class="drill-a">
          <span class="ans" dangerouslySetInnerHTML={{ __html: M(item.answer) }} />
          {item.steps?.length > 0 && (
            <ol class="drill-steps">
              {item.steps.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: M(s) }} />)}
            </ol>
          )}
          {item.why && <div dangerouslySetInnerHTML={{ __html: M(item.why) }} />}

          {got == null ? (
            <div class="qgrade">
              <span>Were you right?</span>
              <button class="gbtn ok" data-got="1" onClick={() => grade(true)}>Got it</button>
              <button class="gbtn no" data-got="0" onClick={() => grade(false)}>Missed it</button>
            </div>
          ) : (
            <div class="qgrade">
              <span class="gnote">{R.label(after)}</span>
              <button class="dbtn" data-drill-next onClick={onDone}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
