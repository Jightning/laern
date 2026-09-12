/* Pre-training: the names and characteristics of a section's main concepts,
 * presented before the section itself.
 *
 * Mayer's pre-training principle (d ≈ 0.46) holds that learners do better when
 * they already know what the key components are called before they have to
 * reason with them. Everything here is derived from the section's own content
 * — definitions and concept references — so it costs the author nothing.
 */
import { strip, clip } from "./util.js";
import { M } from "./math.js";

/** first sentence of a definition body, which is the definition proper
 *
 * The math is rendered before it is stripped. `strip` knows how to flatten a
 * KaTeX span down to its glyphs, but a block body arrives holding TeX *source*
 * in `<m>…</m>`, and removing the tag leaves the source behind: the panel
 * printed "Let \beta be births per individual" on the first screen of every
 * section. Rendering first costs nothing new — math.js caches on the source and
 * the section is about to render the same formulas anyway. */
function firstSentence(html) {
  const t = strip(M(html || ""));
  const m = t.match(/^(.{20,160}?[.;:])\s/);
  return clip(m ? m[1] : t, 150);
}

export function keyTerms(section, concepts = {}) {
  const terms = [];
  const seen = new Set();

  for (const sub of section.subs || []) {
    for (const b of sub.blocks || []) {
      if (b.t !== "def" || !b.term) continue;
      const key = b.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ term: b.term, gloss: firstSentence(b.h), where: sub.id, kind: "def" });
    }
  }

  /* recurring concepts the section leans on but does not define */
  const text = JSON.stringify(section);
  for (const m of text.matchAll(/<c\\?"?\s*k=\\?"([^"\\]+)/g)) {
    const c = concepts[m[1]];
    if (!c) continue;
    const key = (c.term || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push({ term: c.term, gloss: firstSentence(c.body), concept: m[1], kind: "concept" });
  }

  return terms;
}
