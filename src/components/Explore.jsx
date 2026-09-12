import { useState, useMemo, useEffect } from "preact/hooks";
import { searchRun } from "../lib/search.js";
import { present } from "../lib/gist.js";
import { decorate } from "../lib/refs.js";
import { renderBlock } from "../blocks/index.js";
import CatChip, { monogram } from "./CatChip.jsx";

/* Explore — search with the facets the overlay deliberately does not have.
 *
 * The overlay stays exactly as it was. It answers "take me there", it opens on
 * `/`, and one input with one list is the right shape for that question: a
 * reader typing a word they half-remember does not want a filter panel in
 * front of them. This page answers the other question — "show me everything of
 * this kind" — which needs facets, needs to be linkable, and needs to be able
 * to return *nothing but* a category.
 *
 * With no query it browses rather than searches, because a category with no
 * search terms is a perfectly good request and returning an empty page for it
 * would be the feature refusing the thing it was built for.
 *
 * Results carry a depth of their own. Reading a whole category at `notes` and
 * opening the two entries you do not recognise is the loop this page is for —
 * which is discovery, and discovery is what an outline measurably helps with
 * (provided outlines raise memory, g = 0.61, and not comprehension, g = 0.34
 * n.s.; Ponce, Mayer & Méndez 2023). So the page starts compact and never
 * pretends to be a substitute for reading the section.
 */

const KINDS = [
  { id: "block",   label: "Items" },
  { id: "sub",     label: "Subsections" },
  { id: "section", label: "Sections" },
  { id: "concept", label: "Concepts" }
];

export default function Explore({ ctx, seed }) {
  const { C, cid, idx } = ctx;
  const CAT = idx.CAT;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(seed && seed.cat ? seed.cat : "");
  const [tag, setTag] = useState(seed && seed.tag ? seed.tag : "");
  const [kinds, setKinds] = useState([]);
  const [depth, setDepth] = useState("notes");

  /* A link into this page carries the facet it meant. Re-seeding on the route
     rather than on mount so following a second tag chip from the results
     actually moves the page. */
  useEffect(() => {
    setCat(seed && seed.cat ? seed.cat : "");
    setTag(seed && seed.tag ? seed.tag : "");
  }, [seed && seed.cat, seed && seed.tag]);

  const filter = useMemo(() => {
    return e => {
      if (kinds.length && !kinds.includes(e.kind)) return false;
      if (cat && e.cat !== cat) return false;
      if (tag && !(e.tags || []).includes(tag)) return false;
      return true;
    };
  }, [kinds, cat, tag]);

  const faceted = cat || tag || kinds.length;

  /* Searching ranks; browsing lists. Both respect the same facets, so the
     controls do not change meaning when the query box empties. */
  const res = useMemo(() => {
    const query = q.trim();
    if (query) return searchRun(idx.SEARCH, query, { filter, limit: 80 });
    if (!faceted) return [];
    return idx.SEARCH.filter(filter).slice(0, 200)
      .map(e => ({ e, parts: null, title: null }));
  }, [q, idx, filter, faceted]);

  const toggleKind = k =>
    setKinds(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]));

  const catKeys = Object.keys(CAT.cats);
  const active = cat ? CAT.cats[cat] : null;

  return (
    <div class="explore">
      <h1>Explore</h1>
      <p class="lede">
        Search and filter everything this course holds — down to the individual
        rule, table or definition, not just the page it sits on.
      </p>

      <div class="xbar">
        <input class="xq" type="search" value={q} placeholder="Search, or leave empty and filter…"
               autocomplete="off" spellcheck={false}
               onInput={e => setQ(e.currentTarget.value)} />
        {(q || faceted) && (
          <button class="lane-b" onClick={() => { setQ(""); setCat(""); setTag(""); setKinds([]); }}>
            Clear
          </button>
        )}
      </div>

      <div class="xfacets">
        <div class="xfacet">
          <span class="lane-l">Kind</span>
          <span class="lane-set">
            {KINDS.map(k => (
              <button key={k.id} class={"lane-b" + (kinds.includes(k.id) ? " sel" : "")}
                      aria-pressed={kinds.includes(k.id)}
                      onClick={() => toggleKind(k.id)}>{k.label}</button>
            ))}
          </span>
        </div>

        {catKeys.length > 0 && (
          <div class="xfacet">
            <span class="lane-l">Category</span>
            <span class="lane-set xwrap">
              {catKeys.map(k => (
                <button key={k} class={"lane-b" + (cat === k ? " sel" : "")}
                        aria-pressed={cat === k}
                        onClick={() => setCat(cat === k ? "" : k)}>
                  <span class="cchip-m" aria-hidden="true">
                    {monogram(CAT.cats[k].name || k, CAT.cats[k].short)}
                  </span>
                  {CAT.cats[k].name || k}
                  <span class="tagn">{(CAT.members[k] || []).length}</span>
                </button>
              ))}
            </span>
          </div>
        )}

        {CAT.tags.length > 0 && (
          <div class="xfacet">
            <span class="lane-l">Tag</span>
            <span class="lane-set xwrap">
              {CAT.tags.map(t => (
                <button key={t} class={"lane-b" + (tag === t ? " sel" : "")}
                        aria-pressed={tag === t}
                        onClick={() => setTag(tag === t ? "" : t)}>
                  #{t}<span class="tagn">{CAT.tagIndex[t].length}</span>
                </button>
              ))}
            </span>
          </div>
        )}

        <div class="xfacet">
          <span class="lane-l">Show</span>
          <span class="lane-set">
            {["index", "notes", "full"].map(d => (
              <button key={d} class={"lane-b" + (d === depth ? " sel" : "")}
                      aria-pressed={d === depth} onClick={() => setDepth(d)}>
                {d === "index" ? "Names" : d === "notes" ? "Claims" : "Everything"}
              </button>
            ))}
          </span>
        </div>
      </div>

      {active && (
        <div class="xcat">
          <h2>{active.name || cat}</h2>
          {active.boundary && <p>{active.boundary}</p>}
          <a class="dbtn ghost" href={`#/${cid}/cat/${cat}`}>Open the category page →</a>
        </div>
      )}

      <p class="xcount">
        {res.length
          ? `${res.length}${res.length === 200 ? "+" : ""} ${res.length === 1 ? "result" : "results"}`
          : q.trim() || faceted ? "Nothing matches." : "Type a query, or pick a facet."}
      </p>

      <div class="xres">
        {res.map(r => <Row key={r.e.id} r={r} ctx={ctx} depth={depth} />)}
      </div>
    </div>
  );
}

const Marked = ({ run, plain }) =>
  run ? run.map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : p.t)) : plain;

function Row({ r, ctx, depth }) {
  const { cid, idx } = ctx;
  const [open, setOpen] = useState(false);
  const e = r.e;
  const entry = e.kind === "block" ? idx.BLOCKS[e.id] : null;
  const b = entry && entry.b;
  const p = b ? present(b, open ? "full" : depth) : null;

  return (
    <div class={`xrow k-${e.kind}`}>
      <div class="xrow-h">
        <span class="xnum">{e.num || "◈"}</span>
        <a class="xname" href={`#/${cid}/${e.id}`}>
          <Marked run={r.title} plain={e.title} />
        </a>
        <span class="xctx">{e.kind === "block" ? e.t : e.ctx}</span>
      </div>

      {b && p && p.mode === "full" && (
        <div class="bhtml" dangerouslySetInnerHTML={{
          __html: decorate(renderBlock(b, { fignum: idx.FIG.numOf(b) }), cid, idx.FIG.byKey) }} />
      )}
      {b && p && p.mode !== "full" && p.lead && (
        <div class="glead bhtml" dangerouslySetInnerHTML={{
          __html: decorate(p.lead, cid, idx.FIG.byKey) }} />
      )}
      {!b && r.parts && <p class="xsnip"><Marked run={r.parts} /></p>}

      <div class="gmeta">
        {e.cat && <CatChip ctx={ctx} k={e.cat} />}
        {(e.tags || []).filter(t => t !== e.cat).map(t => (
          <a class="gtag" key={t} href={`#/${cid}/explore/tag/${encodeURIComponent(t)}`}>#{t}</a>
        ))}
        {b && p && p.mode !== "full" && p.more && (
          <button class="gmore" onClick={() => setOpen(true)}>open</button>
        )}
      </div>
    </div>
  );
}
