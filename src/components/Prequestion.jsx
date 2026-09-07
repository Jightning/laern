import { useState } from "preact/hooks";
import { M } from "../lib/math.js";

/* A question about a relation the section is about to establish.
 *
 * The primer's term run is prequestioning too, but a term is not a relation,
 * and the prequestion benefit does not generalise past what was asked: it runs
 * around g = .66 on the prequestioned content and g = .01 on everything else.
 * The correction is not optional — a conceptual pretest error left uncorrected
 * is more likely to be repeated later than not asked at all, which is why the
 * answer appears the moment the reader commits. */
export default function Prequestion({ item, onNext, last }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);

  return (
    <div class="primer-card preq">
      <div class="primer-meta">Before you read</div>
      <p class="preq-q">{item.ask}</p>

      {shown ? (
        <div class="preq-a">
          <span class="ans" dangerouslySetInnerHTML={{ __html: M(item.answer) }} />
          {item.why && <div dangerouslySetInnerHTML={{ __html: M(item.why) }} />}
          {text && <p class="preq-mine">You said: <q>{text}</q></p>}
        </div>
      ) : (
        <textarea class="preq-in" rows="2" value={text} placeholder="Guess. Being wrong here is the point."
                  onInput={e => setText(e.currentTarget.value)} />
      )}

      <div class="primer-nav">
        {shown
          ? <button class="dbtn" data-preq-next onClick={onNext}>{last ? "Finish →" : "Next →"}</button>
          : <button class="dbtn" data-preq-check onClick={() => setShown(true)}>Check</button>}
      </div>
    </div>
  );
}
