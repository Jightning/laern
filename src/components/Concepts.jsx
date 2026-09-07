import { decorate } from "../lib/refs.js";
import { groupConcepts } from "../lib/concepts.js";
import { get, label as phaseLabel } from "../lib/retention.js";
import ConceptState from "./ConceptState.jsx";

/* Concept hub. "Appears in" is computed from the content at load time, so it
 * cannot drift as material is added. */
export function ConceptHub({ ctx }) {
  const { C, cid, idx, drills } = ctx;
  const groups = groupConcepts(C, idx.CUSE, idx.SUBS);

  const card = k => {
    const u = idx.CUSE[k] || [];
    return (
      <a class="ccard" href={`#/${cid}/c/${k}`} key={k}>
        <h3>{C.concepts[k].term}</h3>
        <span class="uses">used in {u.length} subsection{u.length === 1 ? "" : "s"}</span>
        {drills.byConcept[k] && <span class="cphase">{phaseLabel(get(cid, k))}</span>}
        <div class="where">
          {u.slice(0, 4).map(id => (idx.SUBS[id] ? `${idx.SUBS[id].num}` : id)).join(" · ")}
          {u.length > 4 ? " · ..." : ""}
        </div>
      </a>
    );
  };

  return (
    <div class="chub">
      <h1>Core concepts</h1>
      <p class="lede">
        Ideas reused throughout the course{groups.some(g => !g.flat)
          ? " (grouped by where it's first needed)" : ""}.
      </p>
      {groups.map(g => (
        <div class="cgroup" key={g.sec ? g.sec.id : "rest"}>
          {!g.flat && (
            <h2 class="cghead">
              {g.sec
                ? <>First needed in <b>{g.sec.num} {g.sec.title}</b></>
                : <>Not yet referenced from the material</>}
            </h2>
          )}
          <div class="cgrid">{g.keys.map(card)}</div>
        </div>
      ))}
    </div>
  );
}

export function ConceptDetail({ ctx, k }) {
  const { C, cid, idx } = ctx;
  const d = (C.concepts || {})[k];
  if (!d) return null;
  const u = idx.CUSE[k] || [];
  const rel = [...String(d.body).matchAll(/<c\s+k="([^"]+)"/g)].map(m => m[1]).filter(x => x !== k);

  return (
    <div class="cdet">
      <span class="eyebrow">Core concept</span>
      <h1>{d.term}</h1>
      <div class="body" dangerouslySetInnerHTML={{ __html: decorate(d.body, cid, idx.FIG.byKey) }} />

      <ConceptState ctx={ctx} k={k} />

      <div class="appears">
        <h4>Appears in {u.length} subsection{u.length === 1 ? "" : "s"}</h4>
        <ol>
          {u.map(id => {
            const e = idx.SUBS[id];
            return (
              <li key={id}>
                <a href={`#/${cid}/${id}`}>
                  <span class="an">{e ? e.num : ""}</span>
                  <span class="at">{e ? e.sub.title : id}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>

      {rel.length > 0 && (
        <div class="appears">
          <h4>Related concepts</h4>
          <ol>
            {rel.map(x => (
              <li key={x}>
                <a href={`#/${cid}/c/${x}`}>
                  <span class="an">◈</span>
                  <span class="at">{((C.concepts || {})[x] || {}).term || x}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
