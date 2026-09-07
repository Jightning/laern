import { strip, clip } from "../lib/util.js";
import { previewSub } from "../lib/refs.js";

/* How much of a card is worth showing.
 *
 * A margin card is a reminder, not a copy: its job is to answer "do I need to
 * go and look?" — three lines does that, and the entry is one click away. The
 * length is also a layout constraint. A reading row is as tall as the taller
 * of the block and the card beside it, which is what keeps a card level with
 * what it annotates; the cost is that an over-long card leaves a hole in the
 * reading column. Measured across the six courses, 168-character previews left
 * a void on 9% of rows, averaging 114px.
 */
const PREVIEW = 76;
const USED_LATER_MAX = 4;

/** one reference rendered beside the block that mentions it */
export default function MarginNote({ r, ctx, hot }) {
  const { C, cid, idx } = ctx;
  const H = route => `#/${cid}/${route}`;

  if (r.kind === "concept") {
    const d = (C.concepts || {})[r.id] || {};
    return (
      <div class={"mnote is-c" + (hot ? " hot" : "")} data-xr={"c:" + r.id}>
        <span class="mn-k">Core concept</span>
        <h5>{d.term || r.id}</h5>
        <p>{clip(strip(d.body || ""), PREVIEW)}</p>
        <a class="mn-go" href={H("c/" + r.id)}>Full entry →</a>
      </div>
    );
  }

  const e = idx.SUBS[r.id];
  const sec = e ? null : C.sections.find(x => x.id === r.id);
  if (!e && !sec) return null;

  return (
    <div class={"mnote" + (hot ? " hot" : "")} data-xr={r.id}>
      <span class="mn-k">{e ? e.num : sec.num}</span>
      <h5>{e ? e.sub.title : sec.title}</h5>
      <p>{clip(e ? previewSub(idx.SUBS, r.id) : sec.blurb, PREVIEW)}</p>
      <a class="mn-go" href={H(r.id)}>Open →</a>
    </div>
  );
}

/* A block may cite several things at once. Beyond a few, the cards stop being
   a margin and become a second column of prose: one block in ECE 27000 cited
   six, stacking 764px of cards beside a two-line paragraph. The first few stay
   cards; the rest become a compact list, which still puts the reference beside
   its mention (T12) without a hole in the reading column. */
const CARDS_MAX = 2;

export function MarginRefs({ refs, ctx }) {
  const cards = refs.slice(0, CARDS_MAX), rest = refs.slice(CARDS_MAX);
  return (
    <>
      {cards.map(r => <MarginNote key={r.kind + r.id} r={r} ctx={ctx} />)}
      {rest.length > 0 && (
        <div class="mnote is-x">
          <span class="mn-k">Also cited here</span>
          <span class="mn-chips">
            {rest.map(r => <RefChip key={r.kind + r.id} r={r} ctx={ctx} />)}
          </span>
        </div>
      )}
    </>
  );
}

export function RefChip({ r, ctx }) {
  const { C, cid, idx } = ctx;
  if (r.kind === "concept") {
    const d = (C.concepts || {})[r.id] || {};
    return <a class="mn-chip" href={`#/${cid}/c/${r.id}`}>{d.term || r.id}</a>;
  }
  const e = idx.SUBS[r.id], sec = e ? null : C.sections.find(x => x.id === r.id);
  if (!e && !sec) return null;
  return <a class="mn-chip" href={`#/${cid}/${r.id}`}>{e ? e.num : sec.num}</a>;
}

/** the inverse direction: which later subsections depend on this one
 *
 * `compact` is the rail's rendering priority made concrete: reference cards
 * are required to sit beside their mention (T12), this card is not, so when
 * the two want the same row this one gives up its titles and becomes chips
 * rather than push the row taller than the block it sits against. */
export function UsedLater({ id, ctx, compact }) {
  const { cid, idx } = ctx;
  const back = idx.XIN[id] || [];
  if (!back.length) return null;
  const shown = back.slice(0, USED_LATER_MAX), rest = back.length - shown.length;
  if (compact) return (
    <div class="mnote is-f">
      <span class="mn-k">Used later in</span>
      <span class="mn-chips">
        {back.map(x => {
          const e = idx.SUBS[x];
          return <a key={x} class="mn-chip" href={`#/${cid}/${x}`}>{e ? e.num : x}</a>;
        })}
      </span>
    </div>
  );
  return (
    <div class="mnote is-f">
      <span class="mn-k">Used later in</span>
      {shown.map(x => {
        const e = idx.SUBS[x];
        return (
          <a key={x} class="mn-go" style="display:block;margin-bottom:4px" href={`#/${cid}/${x}`}>
            {e ? e.num : ""}  {e ? e.sub.title : x}
          </a>
        );
      })}
      {rest > 0 && <span class="mn-more">and {rest} more</span>}
    </div>
  );
}
