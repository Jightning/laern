/* Every lookup the UI needs, derived from the course data itself. Nothing here
 * is hand-maintained, so none of it can drift from the content. */
import { collect, textOf, strip, qid } from "./util.js";
import { numberFigures } from "./figures.js";

const push = (map, k, v) => {
  (map[k] = map[k] || []);
  if (!map[k].includes(v)) map[k].push(v);
};

/* Which concept a quiz item exercises, for the one seam between the loops: a
 * confident miss in Loop A recruits that concept into Loop B. Quiz items are
 * keyed by type (M9), so the concept is declared where it matters and inferred
 * where the subsection leaves no doubt — exactly one of its mentions has a
 * drill file. Anything else stays unrouted and simply never recruits. */
export function conceptOf(C, q, sub) {
  const bank = C.drills || {};
  if (q.concept) return bank[q.concept] ? q.concept : null;
  const seen = [...new Set([...textOf(sub).matchAll(/<c\s+k="([^"]+)"/g)].map(m => m[1]))]
    .filter(k => bank[k]);
  return seen.length === 1 ? seen[0] : null;
}

export function buildIndex(C) {
  const SUBS = {}, CUSE = {}, XIN = {}, QALL = [], SEARCH = [], CQ = {};

  C.sections.forEach(s => {
    /* Kept in the case it was written in. The index lowercases as it
       tokenises, and the snippet is the reader's own material quoted back at
       them — a lowercased one silently rewrites every symbol and proper noun
       in the course. */
    SEARCH.push({ kind: "section", id: s.id, num: String(s.num), title: s.title,
                  ctx: "Section", text: s.title + " " + (s.blurb || "") });

    s.subs.forEach((sub, k) => {
      const num = `${s.num}.${k + 1}`;
      SUBS[sub.id] = { sec: s, sub, num };

      const txt = textOf(sub);
      for (const m of txt.matchAll(/<c\s+k="([^"]+)"/g)) push(CUSE, m[1], sub.id);
      for (const m of txt.matchAll(/href="#([^"]+)"/g)) if (m[1] !== sub.id) push(XIN, m[1], sub.id);

      (sub.quiz || []).forEach(q => {
        const id = qid(sub.id, q.type);
        CQ[id] = conceptOf(C, q, sub);
        QALL.push({ id, q, subId: sub.id, num, subTitle: sub.title });
      });

      /* The owning section title is searchable from the subsection, so
         "karnaugh" reaches subsections that only ever say "K-map" — and it
         goes at the end, because a snippet is cut around the match and one
         cut at offset zero opened every result by restating the section the
         result already names beside it. */
      SEARCH.push({ kind: "sub", id: sub.id, num, title: sub.title, ctx: s.title,
                    text: strip(txt) + " " + s.title });
    });
  });

  Object.keys(C.concepts || {}).forEach(k =>
    SEARCH.push({ kind: "concept", id: "c/" + k, num: "", title: C.concepts[k].term,
                  ctx: "Core concept", text: strip(C.concepts[k].body) }));

  return { SUBS, CUSE, XIN, QALL, SEARCH, CQ, FIG: numberFigures(C) };
}

export const labelOf = (SUBS, id) => {
  const e = SUBS[id];
  return e ? `${e.num} ${e.sub.title}` : id;
};
