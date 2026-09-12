import { qid } from "../lib/util.js";
import { sectionEdges } from "../lib/refs.js";
import { transitiveReduction } from "../lib/graph.js";
import { Figures } from "../figures/index.js";

/* The course's real shape, derived from its cross-references. */
export default function DepMap({ ctx, onNode, focus }) {
  const { C, cid, state } = ctx;

  /* A node carries its own name where the shape can hold it.
   *
   * The map answered "what depends on what" with six numbered circles and a
   * legend underneath, so reading it meant holding a number-to-name table in
   * your head — the split-attention cost T12 exists to forbid, on the one page
   * whose entire job is showing relationships.
   *
   * The renderer has always been able to do better: `figures/graph.js` wraps a
   * label on spaces, steps the size down 11 → 8, and grows the node up to ~1.7x
   * rather than distorting the glyphs, and the grown radius then feeds the
   * layout spacing so bigger nodes push each other apart. What was measured and
   * rejected was a *caption under the node*, which collides with its
   * neighbours at fifteen sections; a label inside the node cannot collide with
   * anything, because the layout already accounts for it.
   *
   * It is still a threshold rather than always-on. Past about eight sections
   * the canvas is wide enough that full titles make each node a paragraph, and
   * the number plus the paired list below is the better trade — so the two
   * courses that need it keep what they had. */
  const NAMED_UPTO = 8;
  const named = C.sections.length <= NAMED_UPTO;

  const nodes = C.sections.map(s => {
    const ids = [];
    s.subs.forEach(u => (u.quiz || []).forEach(q => ids.push(qid(u.id, q.type))));
    const ss = state.on ? state.stats(ids) : null;
    const mastered = ss && ss.total && ss.got === ss.total;
    const started = ss && ss.seen;
    return {
      id: s.id, label: named ? s.title : String(s.num), title: s.title,
      here: s.id === focus,
      accent: mastered ? 0 : (started ? 1 : 3),
      /* mastery was carried by stroke colour alone (WCAG 1.4.1). The state
         now also changes the stroke pattern and is named in the tooltip. */
      state: !ss ? null : mastered ? "mastered" : started ? "started" : "not started"
    };
  });

  /* the raw citation graph is dense and mostly implied; the reduction leaves
     the skeleton of what genuinely depends on what */
  const all = sectionEdges(C.sections);
  const edges = transitiveReduction(nodes, all);

  /* Every section stays on the map, including the ones that neither cite nor
     are cited: arriving here from one and not finding it is the map failing at
     the only question it was asked. The layered layout packs those into a band
     rather than columning them, so they cost a strip of height instead of
     stretching the whole canvas. */
  const loose = nodes.length - new Set(edges.flatMap(e => [e.from, e.to])).size;
  /* A titled node needs both a bigger base and room to grow past it: a section
     title is four to six words, which a 24px circle cannot hold at any font
     size the reader can read. */
  const svg = Figures.graph({ nodes, edges, layout: "layered", w: 960,
                              r: named ? 44 : 24, grow: named ? 2.4 : 1.7 });

  /* Light the other half of a pair. The node lives inside injected SVG, so it
     cannot carry a component handler — the same reason the reading column
     keeps one delegated listener. */
  const pair = (e, on) => {
    const row = e.target.closest?.("[data-pair]");
    const id = row && row.getAttribute("data-pair");
    if (!id) return;
    const node = document.querySelector(`.mapwrap [data-node="${id}"]`);
    if (node) node.classList.toggle("is-hot", on);
  };
  const pairFromNode = (e, on) => {
    const n = e.target.closest?.("[data-node]");
    const id = n && n.getAttribute("data-node");
    if (!id) return;
    const row = document.querySelector(`.maplist [data-pair="${id}"]`);
    if (row) row.classList.toggle("is-hot", on);
  };

  return (
    <div class="chub mapview">
      <h1>Dependency map</h1>
      {focus && (
        <p class="maphere">
          Ringed: section {(C.sections.find(s => s.id === focus) || {}).num}{" "}
          {(C.sections.find(s => s.id === focus) || {}).title}
        </p>
      )}
      <div class="figure mapwrap"
           onMouseOver={e => pairFromNode(e, true)}
           onMouseOut={e => pairFromNode(e, false)}
           onClick={e => {
             const n = e.target.closest?.("[data-node]");
             if (n) onNode(n.getAttribute("data-node"));
           }}
           dangerouslySetInnerHTML={{ __html: svg }} />
      {/* The list is an index, not a decoder.
       *
       * Pointing at a row lights its node and pointing at a node lights its
       * row, so the pairing is shown rather than looked up — the same
       * mechanism the reference cards already use for a mention and its card.
       * It stays a plain list of links when nothing is hovered, which is what
       * it has to be for a reader who never uses a pointer. */}
      <div class="maplist"
           onMouseOver={e => pair(e, true)} onMouseOut={e => pair(e, false)}>
        {C.sections.map(s => (
          <a href={`#/${cid}/${s.id}`} key={s.id} data-pair={s.id}
             class={s.id === focus ? "is-here" : ""}><b>{s.num}</b> {s.title}</a>
        ))}
      </div>
    </div>
  );
}
