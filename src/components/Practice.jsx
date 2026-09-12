import { useState } from "preact/hooks";
import { shuffle } from "../lib/util.js";
import { buildQueue } from "../lib/queue.js";
import { Question } from "./Quiz.jsx";
import DrillRun from "./DrillRun.jsx";

const Stat = ({ n, label, warn }) => (
  <span class={"dstat" + (warn ? " warn" : "")}><b>{n}</b>{label}</span>
);

/* Interleaving topics is harder than practising one section at a time, and
 * that difficulty is what makes it transfer to an exam that mixes them. */
export default function Practice({ ctx, cat }) {
  const { C, cid, idx, state, drills } = ctx;
  /* A category scopes the drill pool by narrowing the key list handed to the
     queue — buildQueue reads `keys`, `pick` and `cluster` and nothing else, so
     no second code path is needed. The category's concepts are derived from
     its membership, never authored on the items (M27). */
  const catKeys = cat ? (idx.CAT.drillsOf(cat) || []) : null;
  const bank = catKeys ? { ...drills, keys: catKeys, has: catKeys.length > 0 } : drills;
  const catName = cat ? ((idx.CAT.cats[cat] || {}).name || cat) : null;
  const [source, setSource] = useState(bank.has ? "drills" : "types");
  const [scope, setScope] = useState("all");
  /* Scope belongs to the quiz pool: a drill queue is assembled from what is due
     across concepts, which no section filter can narrow. The control is
     therefore disabled in drill mode — and a disabled control holding a stale
     value was a trap, because switching to drills with "3 Laplace transforms"
     selected left it selected and unreachable, so coming back served one
     section's questions with no way to say so. Switching source resets it. */
  const pickSource = v => { setSource(v); setScope("all"); };
  const [count, setCount] = useState("10");
  const [run, setRun] = useState(null);   // {items, i, started, drills}

  const st = state.on ? state.stats(idx.QALL.map(q => q.id)) : null;
  const n = parseInt(count, 10);

  /* What Start will actually do, in words. The controls are behind a
     disclosure, so the page has to say what it is holding rather than leave the
     reader to open it and check. */
  const drawing = source === "drills" && bank.has
    ? "concepts due for recall" : "one question per type";
  const over = scope === "all" ? "every section"
    : scope === "due" ? "what is due"
    : scope === "weak" ? "what you have missed"
    : ((C.sections.find(x => x.id === scope) || {}).title || "one section");
  const summary = source === "drills" && bank.has
    ? `Drawn from ${drawing}, mixed across the course.`
    : `Drawn from ${drawing}, across ${over}.`;

  const quizPool = () => {
    const pool = idx.QALL.filter(q => {
      if (scope === "all") return true;
      if (scope === "due") return state.due(q.id);
      if (scope === "weak") { const r = state.get(q.id); return r && r.got === 0; }
      return idx.SUBS[q.subId] && idx.SUBS[q.subId].sec.id === scope;
    });
    shuffle(pool);
    return n ? pool.slice(0, n) : pool;
  };

  const start = () => {
    const isDrills = source === "drills" && bank.has;
    setRun({
      items: isDrills
        ? buildQueue([{ cid, C, drills: bank }], { limit: n || 200 })
        : quizPool(),
      i: 0, started: Date.now(), drills: isDrills
    });
  };

  return (
    <div class="chub">
      <h1>Mixed practice</h1>
      {catName && (
        <p class="lede">
          Scoped to <a href={`#/${cid}/cat/${cat}`}>{catName}</a> — {catKeys.length}{" "}
          {catKeys.length === 1 ? "concept" : "concepts"} in this category carry a drill bank.
        </p>
      )}

      {/* Start first, settings behind it.
       *
       * This page delivers the largest effect the site has and it opened as a
       * configuration form: three dropdowns, a dead checkbox and a ghost
       * button, on an otherwise empty screen. Four decisions stood between the
       * reader and the one activity the evidence is unambiguous about, and all
       * four already had the right default — drills when the course has them,
       * every section, ten.
       *
       * So the defaults are simply taken, stated in a sentence so nothing is
       * hidden, and the controls that change them are one disclosure away.
       * "Timed" is gone rather than moved: it had no handler and no reader, so
       * it was a promise the page did not keep. */}
      <div class="pgo">
        <button class="dbtn primary" id="p-start" onClick={start}>
          Start {n || "every"} question{n === 1 ? "" : "s"} →
        </button>
        <span class="pgo-w">{summary}</span>
      </div>

      <details class="pcfg">
        <summary>Change what's drawn</summary>
        <div class="pcfg-row">
          {bank.has && (
            <label>Draw from{" "}
              <select id="p-source" value={source} onChange={e => pickSource(e.currentTarget.value)}>
                <option value="drills">Drills</option>
                <option value="types">Question types</option>
              </select>
            </label>
          )}
          <label class={source === "drills" && bank.has ? "off" : ""}>Scope{" "}
            <select id="p-scope" disabled={source === "drills" && bank.has}
                    value={scope} onChange={e => setScope(e.currentTarget.value)}>
              <option value="all">All sections</option>
              {state.on && <option value="due">Due for review</option>}
              {state.on && <option value="weak">Previously missed</option>}
              {C.sections.map(s => <option value={s.id} key={s.id}>{s.num} {s.title}</option>)}
            </select>
          </label>
          <label>Count{" "}
            <select id="p-count" value={count} onChange={e => setCount(e.currentTarget.value)}>
              <option>10</option><option>20</option><option>40</option>
              <option value="0">All</option>
            </select>
          </label>
          {st && <span class="pinfo">{st.due} of {st.total} due</span>}
        </div>
      </details>

      <div id="p-run">
        {run && <Run run={run} setRun={setRun} ctx={ctx} onAgain={() => setRun(null)} />}
      </div>
    </div>
  );
}

function Run({ run, setRun, ctx, onAgain }) {
  const { state, cid } = ctx;
  const n = run.items.length;
  /* An empty drill queue and an empty quiz pool are different facts, and the
     one message answered only the second. A drill queue is empty when nothing
     is *due*, which on a course you have not answered in yet is the normal
     state rather than a mistake: a concept enters the schedule on first
     contact, so an untouched course owes nothing and says so. */
  if (!n) return run.drills
    ? (
      <p class="pempty">
        Nothing is due. A concept enters the review schedule two ways: you open
        its entry from <a href={`#/${cid}/concepts`}>Core concepts</a> and press
        <b>Drill this</b>, or a quiz question you were confident about turns out
        wrong, which queues it for the next day. Until one of those happens
        there is nothing to recall — <b>Question types</b> under <b>Draw from</b>
        is the pool that is ready now.
      </p>
    )
    : <p class="pempty">Nothing matches that scope.</p>;

  if (run.i >= n) {
    const s = !run.drills && state.on ? state.stats(run.items.map(x => x.id)) : null;
    const mins = Math.round((Date.now() - run.started) / 6e4);
    return (
      <div class="pdone">
        <h3>Set complete</h3>
        {s && (
          <>
            <div class="dash">
              <Stat n={s.got} label="got right" />
              <Stat n={s.missed} label="missed" />
              <Stat n={s.over} label="overconfident" warn={s.over > 0} />
              <Stat n={mins} label="minutes" />
            </div>
            {s.over > 0 && (
              <p class="pwarn">
                Overconfidence is the useful number: {s.over} question{s.over === 1 ? "" : "s"} you
                expected to get right and did not. Those are the ones to revisit first.
              </p>
            )}
          </>
        )}
        <button class="dbtn" id="p-again" onClick={onAgain}>Another set</button>
      </div>
    );
  }

  const item = run.items[run.i];
  const next = () => setRun({ ...run, i: run.i + 1 });
  return (
    <div class="prun">
      <div class="pbar"><i style={`width:${Math.round((run.i / n) * 100)}%`} /></div>
      <div class="pmeta">
        {run.drills ? "Drill" : "Question"} {run.i + 1} of {n}
        {!run.drills && <span class="pfrom">{item.num} {item.subTitle}</span>}
      </div>
      {run.drills
        ? <DrillRun row={item} at={run.i} onNext={next} />
        : <>
            <Question key={item.id} item={item} ctx={ctx} showWhere />
            <div class="pnav">
              <button class="dbtn" id="p-next" onClick={next}>Next question →</button>
            </div>
          </>}
    </div>
  );
}
