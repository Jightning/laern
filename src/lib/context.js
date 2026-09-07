/* What the browser's own assistant is told about the page.
 *
 * "Ask Google about this page" cannot be embedded, scoped or blocked. What can
 * be decided is what is in the document when it looks, so this builds one
 * machine-readable record of the current view: the course, where the view sits
 * in it, and the full text of every concept the view references. Without it the
 * assistant has a concept *mention* and a 76-character margin preview, and
 * fills the gap from its own memory of the subject instead of from the course.
 *
 * One rule decides what goes in: course content yes, reader content and
 * unattempted answers no. An answer the reader has not tried for is not put
 * where something else can hand it over, which is the property the quiz card
 * already has by only mounting its body after a reveal.
 *
 * Pure: it returns data. PageContext.jsx writes it into <head>.
 */
import { strip, clip } from "./util.js";
import { buildsOn } from "./refs.js";

const BLOCK_MAX = 600;   /* a record, not a copy of the page */
const term = t => strip(String(t || ""));

/** every concept key mentioned anywhere in a node's content */
const mentioned = node =>
  [...new Set([...JSON.stringify(node).matchAll(/<c\\?"?\s*k=\\?"([^"\\]+)/g)].map(m => m[1]))];

const definedTerms = (C, keys) => keys
  .filter(k => (C.concepts || {})[k])
  .map(k => ({ "@type": "DefinedTerm", name: C.concepts[k].term,
               description: strip(C.concepts[k].body) }));

/* Blocks carry the course's claims. Quiz answers do not appear at any tier:
   that is the one exclusion the reading path itself already enforces. */
const blockText = sub => (sub.blocks || [])
  .filter(b => b.h || b.term)
  .map(b => clip([b.label, b.term, strip(b.h)].filter(Boolean).join(" — "), BLOCK_MAX))
  .join("\n");

const courseOf = C => ({
  "@type": "Course", name: C.title, courseCode: C.code,
  description: C.tagline, provider: C.meta || undefined
});

export function pageContext(C, cid, idx, rest, section) {
  const code = C.code ? C.code + " — " : "";

  if (rest && rest.startsWith("c/")) {
    const k = rest.slice(2), d = (C.concepts || {})[k];
    if (!d) return null;
    return {
      title: `${code}${d.term}`,
      description: clip(strip(d.body), 180),
      jsonld: { "@context": "https://schema.org", "@type": "DefinedTerm",
                name: d.term, description: strip(d.body),
                inDefinedTermSet: courseOf(C) }
    };
  }

  if (section) {
    const keys = mentioned(section);
    return {
      title: `${code} · Section ${section.num} ${section.title}`,
      description: clip(term(section.blurb), 180),
      jsonld: {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: `Section ${section.num} ${section.title}`,
        abstract: term(section.blurb),
        isPartOf: courseOf(C),
        position: section.num,
        competencyRequired: buildsOn(idx.SUBS, C.sections, section).map(p => p.label),
        teaches: definedTerms(C, keys),
        hasPart: section.subs.map((sub, i) => ({
          "@type": "LearningResource",
          name: `${section.num}.${i + 1} ${sub.title}`,
          text: blockText(sub),
          /* skill names only. The questions are already on the page; the
             answers are not, and are not added here. */
          assesses: (sub.quiz || []).map(q => q.type)
        }))
      }
    };
  }

  return {
    title: `${code}${C.title || "Study"}`,
    description: clip(term(C.tagline), 180),
    jsonld: { "@context": "https://schema.org", ...courseOf(C),
              hasPart: C.sections.map(s => ({ "@type": "LearningResource",
                name: `Section ${s.num} ${s.title}`, abstract: term(s.blurb) })) }
  };
}
