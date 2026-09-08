import { useState, useEffect, useRef } from "preact/hooks";
import { renderBlock, isApart } from "../blocks/index.js";
import { INTERACTIVE } from "../blocks/interactive.js";
import { decorate, refsOf, buildsOn } from "../lib/refs.js";
import { runsOf } from "../lib/tiers.js";
import { MarginRefs, UsedLater } from "./MarginNote.jsx";
import Quiz from "./Quiz.jsx";
import KeyTerms from "./KeyTerms.jsx";
import { useNote, NoteGrip, NoteCard } from "./Notes.jsx";
import LaneSelect from "./LaneSelect.jsx";
import TierStub from "./TierStub.jsx";
import Attempt from "./Attempt.jsx";

/* One reading row: content on the left, its references immediately to the
 * right. Hovering either side highlights both — handled locally per row
 * rather than by a global delegated listener. */
function ReadingRow({ html, notes, noteAt, noteLabel, apart, ctx, children }) {
  const row = useRef(null);
  const [hot, setHot] = useState(null);
  /* The row owns the note because the note is in two of its zones: the grip at
     the foot of the block, and the card in the margin beside it. */
  const note = useNote(ctx.cid, noteAt || null);

  /* The inline mention lives inside injected HTML, so it cannot take a prop.
     One scoped effect marks both sides of the pair within this row only. */
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    el.querySelectorAll("[data-xr]").forEach(n =>
      n.classList.toggle("hot", hot != null && n.getAttribute("data-xr") === hot));
  }, [hot]);

  const track = on => e => {
    const t = e.target.closest?.("[data-xr]");
    setHot(on && t ? t.getAttribute("data-xr") : null);
  };

  return (
    <div class="brow" ref={row} data-apart={apart || undefined}
         onMouseOver={track(true)} onMouseOut={track(false)}>
      <div class="bmain">
        {html != null
          ? <div class="bhtml" dangerouslySetInnerHTML={{ __html: decorate(html, ctx.cid, ctx.idx.FIG.byKey) }} />
          : children}
        {/* Where a note is started: a grip on the block's own bottom edge,
            shown only while there is nothing to show in the margin. */}
        <NoteGrip n={note} />
      </div>
      <aside class="bside">
        {notes}
        {/* Last in the stack. A reference card has to sit level with the
            mention it annotates [T12] and a note does not, so when the two
            want the same row the note is what yields. */}
        <NoteCard n={note} label={noteLabel} />
      </aside>
    </div>
  );
}

/* One subsection's blocks, grouped by what the lane shows. A collapsed run is
 * one stub; expanding it puts its rows back in place without touching the
 * route or the scroll position. */
function Blocks({ sub, ctx, lane, expandAll }) {
  const { cid, idx } = ctx;
  const [open, setOpen] = useState({});
  const runs = runsOf(sub.blocks || [], lane);

  /* "Used later in" is subsection metadata rather than a mention, so it rides
     the first block it can be absorbed by. A stub is one line tall, so it
     cannot be that block. */
  const lead = runs.find(r => !r.hidden || open[r.items[0].i] || expandAll);
  const leadIndex = lead ? lead.items[0].i : -1;

  const row = ({ b, i }) => {
    const refs = refsOf(b);
    const notes = (
      <>
        {i === leadIndex && <UsedLater id={sub.id} ctx={ctx} compact={refs.length > 0} />}
        <MarginRefs refs={refs} ctx={ctx} />
      </>
    );
    const at = `${sub.id}#${i}`;
    if (INTERACTIVE.includes(b.t))
      return (
        <ReadingRow key={i} ctx={ctx} notes={notes} noteAt={at}>
          <Attempt b={b} cid={cid} anchor={`${sub.id}#${i}@attempt`} />
        </ReadingRow>
      );
    return (
      <ReadingRow key={i} ctx={ctx} notes={notes} noteAt={at} apart={isApart(b.t)}
                  html={renderBlock(b, { fignum: idx.FIG.numOf(b) })} />
    );
  };

  return runs.map(run => {
    const at = run.items[0].i;
    if (!run.hidden || open[at] || expandAll) return run.items.map(row);
    return (
      <ReadingRow key={"stub" + at} ctx={ctx} notes={null}>
        <TierStub items={run.items} ctx={ctx}
                  refs={refsOf(run.items.map(x => x.b))}
                  onExpand={() => setOpen(o => ({ ...o, [at]: true }))} />
      </ReadingRow>
    );
  });
}

export default function Section({ section, ctx, expandAll, lane, onLane }) {
  const { C, cid, idx } = ctx;
  const H = r => `#/${cid}/${r}`;
  const prereq = buildsOn(idx.SUBS, C.sections, section);
  const si = C.sections.indexOf(section);
  const prev = C.sections[si - 1], next = C.sections[si + 1];

  return (
    <section class="sec-body" id={section.id}>
      <div class="sec-head">
        <span class="eyebrow">Section {String(section.num).padStart(2, "0")} of {C.sections.length}</span>
        <h2>{section.title}</h2>
        <p class="sec-blurb">{section.blurb}</p>
        {prereq.length > 0 && (
          <div class="builds">
            <span class="bl">Builds on</span>
            {prereq.map(p => <a key={p.id} href={H(p.id)}>{p.label}</a>)}
          </div>
        )}
        {/* the map answers "what does this sit between", which is a question
            you have here, not back in the course nav */}
        <a class="sec-where" href={H(`map/${section.id}`)}>Where this sits →</a>
      </div>
      <LaneSelect lane={lane} onLane={onLane} />
      <KeyTerms section={section} ctx={ctx} />
      <div class="sec-rule" />

      {section.subs.map((sub, k) => {
        const num = `${section.num}.${k + 1}`;
        return (
          <div class="sub" id={sub.id} key={sub.id}>
            <ReadingRow ctx={ctx}
              notes={(sub.blocks || []).length === 0
                ? <UsedLater id={sub.id} ctx={ctx} />
                : null}
              noteAt={sub.id} noteLabel="Note on this part">
              <h3><span class="sid">{num}</span>{sub.title}</h3>
            </ReadingRow>

            <Blocks sub={sub} ctx={ctx} lane={lane} expandAll={expandAll} />

            {(sub.quiz || []).length > 0 && (
              <ReadingRow ctx={ctx}
                notes={<MarginRefs refs={refsOf(sub.quiz)} ctx={ctx} />}>
                <Quiz sub={sub} num={num} ctx={ctx} expandAll={expandAll} />
              </ReadingRow>
            )}
          </div>
        );
      })}

      <div class="pager">
        {prev
          ? <a href={H(prev.id)}><span class="dir">← Previous</span><span class="pt">{prev.title}</span></a>
          : <div class="sp" />}
        {next
          ? <a class="nx" href={H(next.id)}><span class="dir">Next →</span><span class="pt">{next.title}</span></a>
          : <div class="sp" />}
      </div>
    </section>
  );
}
