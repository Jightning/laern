/* Shared helpers. Pure functions; no DOM, no framework. */
export const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
/* Flatten a rendered equation to readable text.
 *
 * Two things go wrong if a KaTeX fragment is flattened like ordinary prose.
 * It is emitted twice — MathML for assistive technology, spans for the eye —
 * so the formula appears doubled; and the visual half is one span per glyph,
 * so putting a space between tags turns an integral into "∫ 0 ∞ e −st d t".
 *
 * The MathML twin is removed first (a <math> element does not nest, so a
 * regex is safe there). The visual half is then flattened with no separator,
 * which is what a formula wants, and the surrounding prose keeps the normal
 * space-separated flattening. Finding where a fragment ends needs depth
 * counting rather than a regex, because KaTeX spans nest arbitrarily.
 */
const flattenMath = h => {
  let out = "", i = 0;
  for (;;) {
    const at = h.indexOf('<span class="katex"', i);
    if (at < 0) return out + h.slice(i);
    out += h.slice(i, at);
    /* Jump between tags rather than testing every character: a maths-dense
       course flattens megabytes of spans on open, and startsWith at every
       offset is the whole of that cost. */
    let depth = 0, j = at;
    for (;;) {
      const close = h.indexOf("</span>", j);
      if (close < 0) { j = h.length; break; }
      const open = h.indexOf("<span", j);
      if (open >= 0 && open < close) { depth++; j = open + 5; }
      else { j = close + 7; if (!--depth) break; }
    }
    out += h.slice(at, j).replace(/<[^>]+>/g, "");
    i = j;
  }
};

/* Entities are decoded last, after the tags are gone.
 *
 * Everything strip() feeds renders as *text* — a Preact child, a search token,
 * a JSON-LD description — so a surviving entity is escaped a second time on the
 * way out and the reader sees the source: "x=c is stable ... for all t&gt;0".
 * Decoding before tag removal would be wrong in the other direction, since an
 * encoded "&lt;div&gt;" in authored prose would become a tag and be stripped. */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const entities = t => t.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
  if (e[0] === "#") {
    const n = e[1] === "x" || e[1] === "X"
      ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m;
  }
  return e in ENT ? ENT[e] : m;
});

export const strip = h => entities(flattenMath(String(h)
    .replace(/<span class="katex-mathml">[\s\S]*?<\/math><\/span>/g, ""))
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s+([.;:,)])/g, "$1")   /* tag removal orphans punctuation */
  .replace(/\(\s+/g, "(")
  .trim());
export const clip = (t, n = 168) => (t.length > n ? t.slice(0, n - 2) + "…" : t);
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** stable question id — validate.mjs guarantees types are unique per subsection */
export const qid = (subId, type) => `${subId}#${slug(type)}`;

export function collect(v, out) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach(x => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach(x => collect(x, out));
}
export const textOf = v => { const p = []; collect(v, p); return p.join(" "); };

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** course-scoped route */
export const H = (cid, route) => `#/${cid}${route ? "/" + route : ""}`;

/* Relative time, for learner content the reader wrote earlier. Coarse on
 * purpose: "3 weeks ago" is the useful resolution, not a date. */
export function ago(ts) {
  const d = Math.round((Date.now() - ts) / 864e5);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 21) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}
