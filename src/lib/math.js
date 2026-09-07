/* ============================================================================
 * src/lib/math.js — TeX rendered when it is shown, not when it is built
 *
 * This used to run at build time, and for a single-user site that was right:
 * an equation is data, and data does not change between page loads. It stops
 * being right the moment a course is something a user imports, because
 * pre-rendering costs 16x in size — ma26600 is 458KB of YAML and was 7.3MB
 * compiled — in a form no human or model can read or edit.
 *
 * Measured on a throttled mobile CPU, rendering the heaviest subsection in
 * ma26600 (123 formulas, cold cache) costs 54ms on a mid-tier phone and 87ms
 * on a low-tier one. The next subsection costs 25-39ms, because the cache is
 * warm by then. That is the whole price of the inversion.
 *
 * The cache is keyed on the TeX source, which is what makes it cheap: ma26600
 * has 4034 formula occurrences and only 2711 distinct ones, and a reader
 * revisits the same definitions constantly.
 * ==========================================================================*/
import katex from "katex";

const OPTS = { throwOnError: false, strict: "ignore", output: "htmlAndMathml" };
const INLINE = /<m>([\s\S]*?)<\/m>/g;

const inline = new Map();
const display = new Map();

const render = (src, cache, displayMode) => {
  const key = String(src).trim();
  let out = cache.get(key);
  if (out === undefined) {
    /* throwOnError is off: a formula that will not parse must not blank the
       page someone is revising from. It renders as KaTeX's own error text,
       and tools/lib/check.mjs is what stops it reaching a reader at all. */
    out = katex.renderToString(key, { ...OPTS, displayMode });
    cache.set(key, out);
  }
  return out;
};

/** A display equation, for the `math` block. */
export const displayTex = src => render(src, display, true);

/** Every `<m>…</m>` in a string. Returns the string untouched when there is none. */
export function M(html) {
  const s = String(html == null ? "" : html);
  return s.includes("<m>") ? s.replace(INLINE, (_, src) => render(src, inline, false)) : s;
}
