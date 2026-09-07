import { qid } from "../lib/util.js";
import { sectionEdges } from "../lib/refs.js";
import { transitiveReduction } from "../lib/graph.js";
import { Figures } from "../figures/index.js";

/* The course's real shape, derived from its cross-references. */
export default function DepMap({ ctx, onNode, focus }) {
  const { C, cid, state } = ctx;

  const nodes = C.sections.map(s => {
    const ids = [];
    s.subs.forEach(u => (u.quiz || []).forEach(q => ids.push(qid(u.id, q.type))));
    const ss = state.on ? state.stats(ids) : null;
    const mastered = ss && ss.total && ss.got === ss.total;
    const started = ss && ss.seen;
    return {
      /* titles go in a tooltip, not under the node: at 15 sections the
         captions collided with their neighbours */
      id: s.id, label: String(s.num), title: s.title, here: s.id === focus,
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
  const svg = Figures.graph({ nodes, edges, layout: "layered", r: 24, w: 960 });

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
           onClick={e => {
             const n = e.target.closest?.("[data-node]");
             if (n) onNode(n.getAttribute("data-node"));
           }}
           dangerouslySetInnerHTML={{ __html: svg }} />
      <div class="maplist">
        {C.sections.map(s => (
          <a href={`#/${cid}/${s.id}`} key={s.id}
             class={s.id === focus ? "is-here" : ""}><b>{s.num}</b> {s.title}</a>
        ))}
      </div>
    </div>
  );
}
