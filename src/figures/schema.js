/* ============================================================================
 * What each figure kind's `spec` may contain.
 *
 * A renderer reads the keys it knows and ignores the rest, which is the right
 * behaviour at read time and the wrong one at authoring time: a key the engine
 * has never heard of is silently dropped, and the figure renders as if the
 * author had not written it. Two ways in, both seen in real courses:
 *
 *   - an unquoted comma inside a YAML flow mapping ends the *pair*, not the
 *     value. `{label: a, note: b, c}` is three keys, two of them null, and the
 *     note renders as "b". The parse succeeds, so nothing downstream notices.
 *   - a plausible value for an enumerated field. `dir: down` is not `col`, so
 *     `flow` falls through to its default and draws a row.
 *
 * So the keys are declared here, next to the renderers that read them, and
 * tools/lib/figures.mjs fails the build on anything else (T30: what can be
 * caught at build time is not left to appear on a reader's page).
 *
 *   keys   spec keys the renderer reads
 *   enums  fields with a closed set of values — an unlisted one is ignored
 *   fmts   template-string formats, "{} ms" — see fmt() in base.js
 *   items  for a key holding a list of mappings, the keys those may contain
 * ==========================================================================*/

/* every chart kind sizes its own canvas and titles its own axes */
const CHART = ["w", "h", "xlabel", "ylabel", "ticks"];

export const SPEC = {
  graph: {
    keys: ["nodes", "edges", "layout", "r", "w", "h"],
    enums: { layout: ["circle", "row", "layered", "manual"] },
    items: {
      nodes: ["id", "label", "x", "y", "accent", "here", "state", "note", "title"],
      edges: ["from", "to", "label", "self", "curve"]
    }
  },

  plot: {
    keys: [...CHART, "series", "xrange", "yrange", "legend", "xfmt", "yfmt"],
    fmts: ["xfmt", "yfmt"],
    items: { series: ["label", "fn", "points", "from", "to", "dash", "samples"] }
  },

  scatter: {
    keys: [...CHART, "series", "xrange", "yrange", "trend", "xfmt", "yfmt"],
    fmts: ["xfmt", "yfmt"],
    items: { series: ["label", "points"] }
  },

  bar: {
    keys: [...CHART, "bars", "max", "baseline", "valueFmt"],
    fmts: ["valueFmt"],
    items: { bars: ["label", "value", "accent"] }
  },

  flow: {
    keys: ["steps", "dir"],
    enums: { dir: ["row", "col"] },
    items: { steps: ["label", "note"] }
  },

  grid: {
    keys: ["rowVars", "colVars", "rowLabels", "colLabels", "cells", "index", "groups"],
    enums: { index: ["binary"] },
    items: { groups: ["label", "cells"] }
  },

  timing: {
    keys: ["signals", "unit"],
    items: { signals: ["name", "wave"] }
  },

  matrix: { keys: ["rows", "label"] },

  /* the escape hatch: `body` is arbitrary SVG, so there is nothing to declare */
  svg: { keys: ["body", "viewBox"] }
};
