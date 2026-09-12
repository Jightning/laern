import { useState } from "preact/hooks";
import { catView } from "../lib/cats.js";
import { present } from "../lib/gist.js";
import { decorate } from "../lib/refs.js";
import { renderBlock } from "../blocks/index.js";
import { monogram } from "./CatChip.jsx";
import { dueCount } from "../lib/queue.js";

/* The category hub and one category's page.
 *
 * A category page is a case comparison. Its members are laid out together
 * rather than met one at a time across the course, which is the condition the
 * effect was measured under (d = 0.50 against sequential or single cases;
 * Alfieri, Nokes-Malach & Schunn 2013) — and the siblings are shown beside
 * them, because a boundary is only visible against what falls the other side
 * of it. Interleaving pays on confusable neighbours and costs on unrelated
 * ones, so a category that declares no sibling gets no comparison strip rather
 * than an arbitrary one.
 */

export function CatHub({ ctx }) {
  const { cid, idx } = ctx;
  const CAT = idx.CAT;
  const keys = Object.keys(CAT.cats);

  if (!keys.length) return (
    <div class="chub">
      <h1>Categories</h1>
      <p class="lede">This course declares none yet. A category groups things by
        what kind they are, wherever they sit in the material.</p>
    </div>
  );

  /* Ranked by size: a category with two members is a label with ambition, and
     the ones that organise the course are the ones with a population. */
  const rows = keys
    .map(k => ({ k, d: CAT.cats[k], n: (CAT.members[k] || []).length }))
    .sort((a, b) => b.n - a.n);

  return (
    <div class="chub cathub">
      <h1>Categories</h1>
      <p class="lede">
        {keys.length} {keys.length === 1 ? "kind" : "kinds"} of thing this course
        sorts its material into. A category is not a section — its members sit
        wherever they were needed.
      </p>
      <div class="cgrid">
        {rows.map(({ k, d, n }) => (
          <a class="ccard catcard" href={`#/${cid}/cat/${k}`} key={k}>
            <span class="cchip-m big" aria-hidden="true">{monogram(d.name || k, d.short)}</span>
            <h3>{d.name || k}</h3>
            <span class="uses">{n} {n === 1 ? "item" : "items"}</span>
            {d.boundary && <p class="cbound">{d.boundary}</p>}
          </a>
        ))}
      </div>
      {CAT.tags.length > 0 && (
        <div class="tagcloud">
          <h2 class="cghead">Tags</h2>
          <p class="lede">Secondary memberships. A thing can carry many.</p>
          <div class="tagrow">
            {CAT.tags.map(t => (
              <a class="gtag" key={t} href={`#/${cid}/explore/tag/${encodeURIComponent(t)}`}>
                #{t}<span class="tagn">{CAT.tagIndex[t].length}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** one member, at the depth the reader has chosen for this page */
function Member({ r, ctx, depth }) {
  const [open, setOpen] = useState(false);
  const { cid, idx } = ctx;

  if (r.kind === "concept")
    return (
      <a class="cmem is-concept" href={`#/${cid}/c/${r.key}`}>
        <span class="gkind">concept</span>
        <span class="gname">{r.name}</span>
      </a>
    );

  const p = present(r.block, open ? "full" : depth);
  const href = `#/${cid}/${r.id}`;

  return (
    <div class={`cmem t-${r.t}`}>
      <div class="cmem-h">
        <span class="gkind">{r.t}</span>
        <span class="gname">{r.name}</span>
        <a class="cmem-at" href={href}>{r.num} →</a>
      </div>
      {p.mode === "full"
        ? <div class="bhtml" dangerouslySetInnerHTML={{
            __html: decorate(renderBlock(r.block, { fignum: idx.FIG.numOf(r.block) }),
                             cid, idx.FIG.byKey) }} />
        : p.lead
          ? <div class="glead bhtml" dangerouslySetInnerHTML={{
              __html: decorate(p.lead, cid, idx.FIG.byKey) }} />
          : null}
      {p.mode !== "full" && p.more && (
        <button class="gmore" onClick={() => setOpen(true)}>open</button>
      )}
    </div>
  );
}

export function CatDetail({ ctx, k, drills }) {
  const { C, cid, idx } = ctx;
  const v = catView(C, idx.CAT, k);
  /* Reading the whole category at once is the lookup case this page exists
     for, so the depth is the page's own and starts compact. */
  const [depth, setDepth] = useState("notes");
  if (!v) return null;

  /* buildQueue and dueCount read only `keys`, `pick` and `cluster`, so a
     category scopes the queue by handing them a narrower key list. Derived
     from the concepts in this category — never authored on the drill item,
     which already names its concept (M27). */
  const due = v.drills.length && drills && drills.has
    ? dueCount([{ cid, C, drills: { ...drills, keys: v.drills } }]) : 0;

  return (
    <div class="cdet catdet">
      <span class="eyebrow">Category</span>
      <h1>
        <span class="cchip-m big" aria-hidden="true">{monogram(v.name, (idx.CAT.cats[k] || {}).short)}</span>
        {v.name}
      </h1>
      {v.boundary && <p class="lede cbound-lg">{v.boundary}</p>}
      {v.note && <div class="body" dangerouslySetInnerHTML={{ __html: decorate(v.note, cid, idx.FIG.byKey) }} />}

      {v.siblings.length > 0 && (
        <div class="csibs">
          <h4>Not to be confused with</h4>
          <div class="csib-row">
            {v.siblings.map(s => (
              <a class="csib" key={s.key} href={`#/${cid}/cat/${s.key}`}>
                <b>{s.name}</b>
                {s.boundary && <span>{s.boundary}</span>}
                <span class="uses">{s.n} items</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div class="catbar">
        <span class="lane-l">Show</span>
        <span class="lane-set">
          {["index", "notes", "full"].map(d => (
            <button key={d} class={"lane-b" + (d === depth ? " sel" : "")}
                    aria-pressed={d === depth} onClick={() => setDepth(d)}>
              {d === "index" ? "Names" : d === "notes" ? "Claims" : "Everything"}
            </button>
          ))}
        </span>
        <span class="catcount">{v.count} {v.count === 1 ? "item" : "items"}</span>
        {v.drills.length > 0 && (
          <a class="dbtn ghost catpractice" href={`#/${cid}/practice/${k}`}>
            Practise this category{due ? ` (${due} due)` : ""} →
          </a>
        )}
      </div>

      {v.groups.map(g => (
        <div class="cgroup" key={g.at || "rest"}>
          <h2 class="cghead">
            {g.sec ? <>{g.sec.num} {g.sec.title}</> : <>Concepts</>}
          </h2>
          <div class="cmems">
            {g.rows.map(r => <Member key={r.id} r={r} ctx={ctx} depth={depth} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
