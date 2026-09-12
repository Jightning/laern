import { useState, useRef } from "preact/hooks";
import { qid } from "../lib/util.js";
import { laneFor } from "../lib/tiers.js";
import { pushWhy } from "../lib/why.js";
import { append } from "../lib/log.js";
import { recruit as recruitConcept } from "../lib/retention.js";
import WhyField from "./WhyField.jsx";
import Drill from "./Drill.jsx";
import { M } from "../lib/math.js";

/* What the outcome means, in the reader's terms rather than the scheduler's.
 *
 * One word for three outcomes was one word too few. "flagged" was shown when a
 * confident miss pulled a drill up, when a confident miss did nothing because
 * the concept has no bank, and when a reader got something right after saying
 * they were unsure. Those are three different events and only the first of them
 * is the site doing anything.
 *
 * Short on purpose: the note sits at the end of a row of buttons, and a line
 * that wraps there reads as an error message. */
function outcomeNote(conf, got, iv) {
  if (conf === 1 && !got) return "worth another look";
  if (conf === 0 && got) return "you knew it";
  return iv ? `next review in ${iv} day${iv === 1 ? "" : "s"}` : "will come back soon";
}

/* A question card. The reader predicts, states a reason, then reveals and
 * grades themselves. Two gaps get surfaced: prediction against outcome, and
 * the reason they gave against the one the material gives.
 *
 * This is a div rather than a <details> because a <details> cannot refuse to
 * open, and the reveal has to stay inert until the reader has committed to
 * something. */
function Question({ item, ctx, showWhere, forceOpen }) {
  const { C, cid, idx, state, drills } = ctx;
  const saved = state.on ? state.get(item.id) : null;
  const [conf, setConf] = useState(saved ? saved.conf : null);
  const [got, setGot] = useState(saved ? saved.got : null);
  const [why, setWhy] = useState(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [recruit, setRecruit] = useState(null);
  const [graded, setGraded] = useState(false);
  const started = useRef(Date.now());

  /* One answer per attempt.
   *
   * The grade buttons used to stay live after they had been pressed, and every
   * further press was folded in as another answer. `rateStep` multiplies the
   * interval by the ease factor on each correct one, so three presses of
   * "Got it" on a question answered once moved the next review from tomorrow
   * to a fortnight out — and each press wrote a log row, which is the record
   * everything else is a fold over, so the wrong schedule was durable and
   * synced. A second press is not a second recall: the answer is on the screen
   * by then. So the pair settles into a statement of what was recorded, and
   * comes back only when the schedule says this question is due again — which
   * is immediately for a miss, since a missed question's interval is zero. */
  const settled = graded || (state.on && got != null && !state.due(item.id));

  const key = idx.CQ[item.id];
  const shown = forceOpen || open;

  const predict = v => { state.rate(item.id, v, null); setConf(v ? 1 : 0); };

  const commit = entry => { setWhy(entry); setOpen(true); };

  const grade = v => {
    if (settled) return;
    setGraded(true);
    const was = conf;
    const r = state.rate(item.id, null, v);
    const level = was === 1 ? "sure" : was === 0 ? "unsure" : null;
    setGot(v ? 1 : 0);
    if (why) pushWhy(cid, item.id, { ...why, correct: !!v, conf: level });
    append({ course: cid, loop: "A", concept: key, type: item.q.type, itemId: item.id,
             confidence: level, correct: !!v, latencyMs: Date.now() - started.current,
             predictedR: null, lane: laneFor(cid),
             why: why ? (why.skipped ? "skipped" : "given") : null });

    /* A confident miss is corrected, not merely reported: the same concept
       comes back from the drill bank before the reader leaves the section, and
       is queued at a short interval. The seam runs one way — a Loop B success
       never marks a Loop A type cleared. */
    if (was === 1 && !v && key && drills.byConcept[key]) {
      recruitConcept(cid, key);
      setRecruit(drills.pick(key, []));
      setNote("drilling it now");
      return;
    }
    setNote(outcomeNote(was, v, r.iv));
  };

  /* Mastery is a shape as well as a fill, and the title names the state:
     colour never carries meaning on its own. */
  const mastery = got == null ? ["u", "not attempted"]
                : got ? ["g", "answered correctly"] : ["m", "missed — due for review"];

  return (
    <div class={"q" + (shown ? " open" : "")} data-qid={item.id}>
      <div class="qhead">
        {/* Metadata sits on its own row so the question always gets the full
            column. A type label names a skill (M9) and can be long; it must
            never be able to squeeze the content it labels. */}
        <span class="qmeta">
          <span class="qtype">{item.q.type}</span>
          {state.on && (
            <span class="qconf">
              <button class={"cbtn" + (conf === 1 ? " sel" : "")} data-conf="1" data-qid={item.id}
                      title="Predict you know this" onClick={() => predict(true)}>sure</button>
              <button class={"cbtn" + (conf === 0 ? " sel" : "")} data-conf="0" data-qid={item.id}
                      title="Predict you do not" onClick={() => predict(false)}>unsure</button>
            </span>
          )}
          {state.on && <span class={"mdot " + mastery[0]} role="img" aria-label={mastery[1]} title={mastery[1]} />}
          {showWhere && <a class="qwhere" href={`#/${cid}/${item.subId}`}>{item.num}</a>}
          {state.on && conf != null && !shown && (
            <a class="qstuck" href={key ? `#/${cid}/c/${key}` : `#/${cid}/${item.subId}`}
               title="Open the course's own account of this"
               onClick={() => append({ course: cid, loop: "A", concept: key, itemId: item.id,
                                       type: item.q.type, helpSought: true })}>
              stuck?
            </a>
          )}
          {!state.on && !shown && (
            <button class="qmark" onClick={() => setOpen(true)}>reveal</button>
          )}
        </span>
        <span class="qtext" dangerouslySetInnerHTML={{ __html: M(item.q.q) }} />
      </div>

      {state.on && conf != null && !shown && (
        <WhyField cid={cid} itemId={item.id} prompt={item.q.why_prompt || "Why? State it before you reveal."}
                  onCommit={commit} />
      )}

      {shown && (
        <div class="qbody">
          <span class="ans" dangerouslySetInnerHTML={{ __html: M(item.q.a) }} />
          <div dangerouslySetInnerHTML={{ __html: M(item.q.why) }} />
          {state.on && (
            <div class="qgrade">
              <span>Were you right?</span>
              <button class={"gbtn ok" + (got === 1 ? " sel" : "")} data-got="1" data-qid={item.id}
                      disabled={settled} onClick={() => grade(true)}>Got it</button>
              <button class={"gbtn no" + (got === 0 ? " sel" : "")} data-got="0" data-qid={item.id}
                      disabled={settled} onClick={() => grade(false)}>Missed it</button>
              {/* A question graded in an earlier session mounts with an
                  outcome and no note; the row would otherwise settle with two
                  inert buttons and nothing saying why. */}
              <span class="gnote">
                {note || (got != null ? outcomeNote(conf, got, (state.get(item.id) || {}).iv) : "")}
              </span>
            </div>
          )}
          {recruit && (
            <div class="recruit">
              <p class="recruit-l">Here's a similar question: </p>
              <Drill cid={cid} C={C} item={recruit} onDone={() => setRecruit(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { Question };

export default function Quiz({ sub, num, ctx, expandAll, depth = "full" }) {
  const { state } = ctx;
  const [open, setOpen] = useState(false);
  const items = (sub.quiz || []).map(q => ({ id: qid(sub.id, q.type), q, subId: sub.id, num }));
  if (!items.length) return null;
  const st = state.on ? state.stats(items.map(i => i.id)) : null;

  /* At a closed depth the quiz is a line, not a stack of cards.
     A reader reviewing a section at Notes depth is not answering questions —
     and unclosed, the quiz is most of the page: on this project's own courses
     it is roughly three fifths of a subsection's words. It opens in place from
     the same row, like everything else the depth closes. */
  if (depth !== "full" && !expandAll && !open)
    return (
      <button class="quiz-line" onClick={() => setOpen(true)}>
        <span class="quiz-line-n">{items.length}</span>
        <span class="quiz-line-t">
          {items.length === 1 ? "question" : "questions"}
          {st && st.total ? ` · ${st.got}/${st.total} mastered` : ""}
        </span>
        <span class="quiz-line-x">{items.map(i => i.q.type).join(" · ")}</span>
      </button>
    );

  return (
    <div class="quiz">
      <div class="quiz-h">
        Question types<span class="ct">{items.length} distinct</span>
        {st && (
          <span class="qstat">
            {st.got}/{st.total} mastered
            {st.over > 0 && <> · <b class="warn">{st.over} overconfident</b></>}
          </span>
        )}
      </div>
      {/* The explanation of what a quiz is belongs where a reader meets their
          first one, not above every quiz in the course. Fourteen copies of it
          is the engine talking over the material. */}
      {num.startsWith("1.1") && (
        <p class="quiz-note">
          One question per distinct type this subsection can be examined on.{" "}
          {state.on
            ? "Predict before revealing — the gap between prediction and outcome is the useful signal."
            : "No type repeats — learn all of these and the surface is covered."}
        </p>
      )}
      {items.map(i => <Question key={i.id} item={i} ctx={ctx} forceOpen={expandAll} />)}
    </div>
  );
}
