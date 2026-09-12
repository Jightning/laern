/* Categories and tags — the one grouping the site did not have.
 *
 * Everything the engine could group by was positional (a section), argumentative
 * (a tier) or referential (a concept mention). None of those is *membership*:
 * nothing could say "these six things are all X, and X is not Y". That is the
 * relation the middle stage of learning runs on, and it is the one a reader
 * still holds after they have forgotten which subsection something sat in —
 * which is exactly when position fails as an index.
 *
 *   cat:   one per block or concept, optional, and it must be declared.
 *          The *principal* tag: what kind of thing this is.
 *   tags:  many, optional, free-form. What else it would be found under.
 *
 * They are two fields because they serve two stages. A category answers "what
 * kind is this, and what is it not" — it carries a boundary and siblings, and
 * it is what a category page compares. Tags answer "where else would I look for
 * this", which is discovery, and wants no boundary at all.
 *
 * Drill items are not tagged. They already name their concept (M27), so a
 * drill's category is its concept's — derived, never authored, so there is no
 * third record to drift. Quiz items are likewise untouched: `type` is already
 * their identity (M9) and a second one would compete with it.
 *
 * Why a category page puts its members side by side: comparing cases beats
 * meeting them one at a time (d = 0.50; Alfieri, Nokes-Malach & Schunn 2013,
 * Educational Psychologist), and comparing against a declared sibling is what
 * makes the boundary visible rather than merely asserted. The same evidence is
 * why `siblings:` is required rather than nice to have — the contrast is the
 * mechanism, not the decoration.
 */
import { nameOf, present } from "./gist.js";

/** every category a course declares, in declaration order */
export const catsOf = C => (C && C.cats) || {};

/**
 * Membership, derived from the content in one pass.
 *
 *   members[key]  -> [{ kind, id, subId, name, cat, tags }]
 *   tagIndex[tag] -> the same rows, for any tag including the principal one
 *   orphans       -> declared categories nothing joined
 *   undeclared    -> `cat:` values naming no categories/ file
 */
export function indexCats(C) {
  const cats = catsOf(C);
  const members = {}, tagIndex = {}, undeclared = new Set();

  const add = row => {
    if (row.cat) {
      if (cats[row.cat]) (members[row.cat] ||= []).push(row);
      else undeclared.add(row.cat);
    }
    for (const t of row.tags) (tagIndex[t] ||= []).push(row);
  };

  (C.sections || []).forEach(s => (s.subs || []).forEach(sub =>
    (sub.blocks || []).forEach((b, i) => {
      if (!b) return;
      const tags = [...new Set([b.cat, ...(b.tags || [])].filter(Boolean))];
      if (!tags.length) return;
      add({ kind: "block", id: `${sub.id}#${i}`, subId: sub.id, sec: s,
            name: nameOf(b), t: b.t, block: b, cat: b.cat || null, tags });
    })));

  Object.entries(C.concepts || {}).forEach(([k, c]) => {
    const tags = [...new Set([c.cat, ...(c.tags || [])].filter(Boolean))];
    if (!tags.length) return;
    add({ kind: "concept", id: `c/${k}`, key: k, name: c.term || k,
          cat: c.cat || null, tags });
  });

  const orphans = Object.keys(cats).filter(k => !(members[k] || []).length);

  /* A drill item's category is its concept's. Derived rather than authored,
     because the item already names the concept and two records of one fact
     drift. This is what lets a category page offer practice. */
  const drillsOf = key => {
    const out = [];
    for (const row of members[key] || [])
      if (row.kind === "concept" && (C.drills || {})[row.key])
        out.push(row.key);
    return out;
  };

  return { cats, members, tagIndex, orphans, undeclared: [...undeclared], drillsOf,
           tags: Object.keys(tagIndex).sort() };
}

/**
 * One category's page data: its members grouped by section (so the course's
 * own order still reads), and the siblings it is defined against.
 */
export function catView(C, CAT, key) {
  const d = CAT.cats[key];
  if (!d) return null;
  const rows = CAT.members[key] || [];

  const groups = [];
  for (const r of rows) {
    const at = r.sec ? r.sec.id : null;
    let g = groups.find(x => x.at === at);
    if (!g) groups.push((g = { at, sec: r.sec || null, rows: [] }));
    g.rows.push(r);
  }
  groups.sort((a, b) => (a.sec ? a.sec.num : 1e9) - (b.sec ? b.sec.num : 1e9));

  const siblings = (d.siblings || [])
    .filter(k => CAT.cats[k])
    .map(k => ({ key: k, name: CAT.cats[k].name || k,
                 boundary: CAT.cats[k].boundary || "",
                 n: (CAT.members[k] || []).length }));

  return { key, name: d.name || key, boundary: d.boundary || "",
           note: d.note || "", groups, siblings, count: rows.length,
           drills: CAT.drillsOf(key) };
}

/**
 * Everything in a category, as reading rows — "just read all of it", which is
 * the lookup case a category exists for. Honours depth so a category can be
 * skimmed at `notes` and opened where it is not recognised.
 */
export function catRows(rows, depth) {
  return rows.map(r => ({
    ...r,
    at: r.block ? present(r.block, depth === "full" ? "notes" : depth) : null
  }));
}
