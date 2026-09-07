/* TeX, for validation only.
 *
 * This used to render every formula in a course at build time. That moved to
 * the browser (src/lib/math.js) when courses became something a reader imports
 * rather than something the build compiles — pre-rendering cost 16x in size to
 * save tens of milliseconds. What is left is the one thing the build still
 * needs: a parse check, so a formula that will not render fails validation
 * rather than appearing as red error text on a page someone is revising from.
 */
import katex from "katex";

const OPTS = { throwOnError: true, strict: "ignore", output: "htmlAndMathml" };

/** One fragment of TeX as HTML; throws with a readable message if it will not parse. */
export function tex(src, display) {
  return katex.renderToString(String(src).trim(), { ...OPTS, displayMode: !!display });
}
