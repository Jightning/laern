/* Ranked search with a word-prefix fallback so "metastability" finds
 * "metastable". Exact matches score higher than stem matches. */
import { clip } from "./util.js";

function findTerm(hay, w) {
  const i = hay.indexOf(w);
  if (i >= 0) return { i, exact: true };
  if (w.length >= 5) {
    const n = Math.max(5, Math.ceil(w.length * 0.6));
    const stem = w.slice(0, n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp("\\b" + stem).exec(hay);
    if (m) return { i: m.index, exact: false };
  }
  return null;
}
const snippet = (text, i) =>
  i < 0 ? clip(text, 120) : "…" + text.slice(Math.max(0, i - 45), i + 85) + "…";

export function searchRun(SEARCH, qs) {
  const terms = qs.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return SEARCH.map(e => {
    let score = 0, all = true, first = -1;
    const t = e.title.toLowerCase();
    terms.forEach(w => {
      const ht = findTerm(t, w), hx = findTerm(e.text, w);
      if (!ht && !hx) { all = false; return; }
      if (ht) score += ht.exact ? 14 : 8;
      if (hx) {
        score += (hx.exact ? 4 : 2) + Math.max(0, 3 - Math.floor(hx.i / 900));
        if (first < 0) first = hx.i;
      }
    });
    return all ? { e, score, hit: snippet(e.text, first) } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
}
