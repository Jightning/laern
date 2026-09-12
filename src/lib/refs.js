/* Reference extraction. Pure functions over course data — the margin cards,
 * "builds on" chips and "used later" lists are all derived from two inline
 * forms in the content, never hand-maintained. */
import { M } from "./math.js";
import { textOf, strip, clip } from "./util.js";

export function previewSub(SUBS, id) {
  const e = SUBS[id];
  if (!e) return "";
  const bs = e.sub.blocks || [];
  const b = bs.find(x => x.t === "def" || x.t === "key") || bs.find(x => x.t === "p");
  return b ? clip(strip(b.h || "")) : "";
}

/** every distinct reference inside one block, in order of appearance */
export function refsOf(v) {
  const t = textOf(v), seen = new Set(), out = [];
  for (const m of t.matchAll(/href="#(s[0-9]+(?:-[0-9]+)?)"/g)) {
    if (seen.has("s" + m[1])) continue;
    seen.add("s" + m[1]); out.push({ kind: "sub", id: m[1] });
  }
  for (const m of t.matchAll(/<c\s+k="([^"]+)"/g)) {
    if (seen.has("c" + m[1])) continue;
    seen.add("c" + m[1]); out.push({ kind: "concept", id: m[1] });
  }
  return out;
}

/** earlier sections this one depends on */
export function buildsOn(SUBS, sections, s) {
  const t = textOf(s), seen = new Set(), out = [];
  for (const m of t.matchAll(/href="#(s[0-9]+(?:-[0-9]+)?)"/g)) {
    const id = m[1], e = SUBS[id];
    let num, label;
    if (e) { num = e.sec.num; label = e.num; }
    else {
      const sc = sections.find(x => x.id === id);
      if (!sc) continue;
      num = sc.num; label = String(sc.num);
    }
    if (num >= s.num || seen.has(label)) continue;
    seen.add(label); out.push({ id, label });
  }
  return out.slice(0, 9);
}

/** authored "#s4-2" becomes course-scoped and tagged so hover can pair them,
 *  and <f k="key"/> becomes a link reading "Figure 3.2" */
export const decorate = (html, cid, figs) =>
  M(String(html))
    .replace(/<a href="#(s[0-9]+(?:-[0-9]+)?)"/g,
      `<a class="xr" data-xr="$1" href="#/${cid}/$1"`)
    /* A concept mention is a destination, not an ornament. It rendered as a
       bare <c> with a dashed underline and cursor:pointer, which promised a
       click and did nothing. */
    .replace(/<c\s+k="([^"]+)"\s*>([\s\S]*?)<\/c>/g,
      (_, k, text) =>
        `<a class="cref" data-xr="c:${k}" href="#/${cid}/c/${k}">${text}</a>`)
    /* A citation names the kind it resolves to, so "Table 3.1" and
       "Figure 3.1" read as what they are. The author writes the key either
       way and the engine supplies the noun. */
    .replace(/<f\s+k="([^"]+)"\s*\/?>/g, (_, k) => {
      const f = figs && figs[k];
      if (!f) return `<span class="xr-miss">figure “${k}”?</span>`;
      return `<a class="xr" data-xr="${f.subId}" href="#/${cid}/${f.subId}">${f.kind || "Figure"} ${f.num}</a>`;
    });

/** dependency edges between sections, for the map */
export function sectionEdges(sections) {
  const seen = new Set(), edges = [];
  sections.forEach(s => {
    const t = textOf(s);
    for (const m of t.matchAll(/href="#(s[0-9]+)(?:-[0-9]+)?"/g)) {
      const to = m[1], target = sections.find(x => x.id === to);
      if (!target || target.num >= s.num) continue;
      const key = `${to}>${s.id}`;
      if (seen.has(key)) continue;
      seen.add(key); edges.push({ from: to, to: s.id });
    }
  });
  return edges;
}
