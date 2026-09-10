#!/usr/bin/env node
/* Figure rendering rules a browser test would otherwise be the only check on:
 * node labels that stay inside the node, large figures that scroll rather than
 * shrink to an unreadable size, value formats a course can actually author,
 * and the spec check that fails a build on a key the renderer never reads.
 *
 *   node tools/test-figures.mjs
 */
import { graph } from "../src/figures/graph.js";
import { bar } from "../src/figures/bar.js";
import { plot } from "../src/figures/plot.js";
import { scatter } from "../src/figures/scatter.js";
import { leftMargin, tickLabels, MARGIN } from "../src/figures/axes.js";
import { checkFigure } from "./lib/figures.mjs";

let failed = 0;
const ck = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
};

/* ---- graph: label fitting ---- */
{
  const radii = s => [...s.matchAll(/class="fx-n"[^>]*\br="([\d.]+)"|\br="([\d.]+)"[^>]*class="fx-n"/g)]
    .map(m => Number(m[1] ?? m[2]));

  const g = graph({
    layout: "row",
    nodes: [
      { id: "a", label: "electroencephalography" },   // one unbreakable long word
      { id: "b", label: "render the materials" }       // several words
    ]
  });
  ck("a long word grows the node instead of distorting the text",
     !/textLength=/.test(g) && Math.max(...radii(g)) > 30,
     `max node r = ${Math.max(...radii(g)).toFixed(0)}, no textLength`);

  const bLines = (g.match(/class="fx-t fx-nl"/g) || []).length;
  ck("a multi-word label wraps onto more than one line", bLines >= 3,
     `${bLines} label <text> elements for 2 nodes`);

  const plain = graph({ layout: "row", nodes: [{ id: "x", label: "hi" }, { id: "y", label: "ok" }] });
  ck("a short label leaves the node at its base radius",
     Math.max(...radii(plain)) <= 28 && !/textLength=/.test(plain),
     `r = ${Math.max(...radii(plain))}`);
}

/* ---- graph: node notes ---- */
{
  /* Four phrases hanging under four nodes. Drawn on one line each they ran
     through one another, and the canvas was measured as if a note were 20px
     tall and nothing wide. */
  const g = graph({
    layout: "row",
    nodes: [
      { id: "a", label: "new", note: "not yet seen" },
      { id: "b", label: "learning", note: "below the criterion count" },
      { id: "c", label: "criterion", note: "3 correct on 3 distinct items" },
      { id: "d", label: "durable", note: "3 spaced relearnings" }
    ]
  });
  const chips = [...g.matchAll(/<rect x="([-\d.]+)"[^>]*width="([\d.]+)"[^>]*class="fx-eh"/g)]
    .map(m => [Number(m[1]), Number(m[1]) + Number(m[2])])
    .sort((x, y) => x[0] - y[0]);
  const clash = chips.some((c, i) => i > 0 && c[0] < chips[i - 1][1]);
  ck("notes under adjacent nodes do not overlap", chips.length === 4 && !clash,
     chips.map(c => c.map(Math.round).join("–")).join("  "));

  const lines = (g.match(/class="fx-t fx-el"/g) || []).length;
  ck("a note longer than its measure wraps before the layout is widened",
     lines > chips.length, `${lines} note lines for ${chips.length} notes`);

  const [vx, , vw] = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(g)
    .slice(1).map(Number);
  ck("the canvas is wide enough to hold them", chips[0][0] >= vx && chips[3][1] <= vx + vw,
     `notes ${Math.round(chips[0][0])}–${Math.round(chips[3][1])} in ${Math.round(vx)}–${Math.round(vx + vw)}`);
}

/* ---- graph: scroll vs shrink ---- */
{
  const many = graph({
    nodes: Array.from({ length: 10 }, (_, i) => ({ id: "n" + i, label: "n" + i })),
    edges: []
  });
  ck("a 10-node graph carries an intrinsic min-width", /style="min-width:\d+px"/.test(many),
     (many.match(/min-width:\d+px/) || ["none"])[0]);

  const few = graph({ nodes: [{ id: "a" }, { id: "b" }, { id: "c" }], edges: [] });
  ck("a 3-node graph does not (it scales to fit)", !/min-width:/.test(few));
}

/* ---- bar: labels and width ---- */
{
  const wide = bar({ bars: Array.from({ length: 15 }, (_, i) => ({ label: "b" + i, value: i + 1 })) });
  ck("a 15-bar chart carries an intrinsic min-width", /style="min-width:\d+px"/.test(wide));

  const narrow = bar({ bars: [{ label: "a", value: 1 }, { label: "b", value: 2 }] });
  ck("a 2-bar chart does not", !/min-width:/.test(narrow));

  const wrapped = bar({
    bars: [
      ...Array.from({ length: 7 }, (_, i) => ({ label: "s" + i, value: i + 1 })),
      { label: "one two three four", value: 9 }
    ]
  });
  ck("a long label in a narrow slot wraps onto two lines",
     wrapped.includes(">one two<") && wrapped.includes(">three four</text>"),
     wrapped.includes(">one two<") ? "split found" : "not split");
}

/* ---- axes: the left margin has to hold the labels it draws ---- */
{
  /* A chart reaching four figures formats its ticks as "2.0e+4", 36px wide.
     The margin was a fixed 56px that also had to hold the rotated axis title,
     so the title was drawn straight through the labels. */
  const big = tickLabels([0, 20000], 5);
  const small = tickLabels([0, 9], 5);
  ck("a big-number chart earns a wider left margin than a small one",
     leftMargin(big, "comparisons") > leftMargin(small, "n"),
     `${leftMargin(big, "comparisons")}px vs ${leftMargin(small, "n")}px`);

  /* the axis title sits at x=14 and the ticks end 9px short of the axis, so
     the widest label must start clear of the title band */
  const m = leftMargin(big, "comparisons");
  const widest = Math.max(...big.map(t => t.length)) * 10 * 0.6;
  ck("the axis title clears the widest tick label",
     m - 9 - widest >= 14, `${Math.round(m - 9 - widest)}px of clearance`);

  ck("a short-label chart keeps the default margin",
     leftMargin(small, "n") === MARGIN.l, leftMargin(small, "n") + "px");

  const rich = bar({ bars: [{ label: "a", value: 20000 }], ylabel: "comparisons" });
  const plain = bar({ bars: [{ label: "a", value: 9 }], ylabel: "n" });
  const axisX = g => Number(/<line x1="([\d.]+)"[^>]*class="fx-g"/.exec(g)?.[1] ?? 0);
  ck("the rendered chart uses the wider margin",
     axisX(rich) > axisX(plain), `${axisX(rich)} vs ${axisX(plain)}`);
}

/* ---- formats: a course is YAML, so a format is a template string ---- */
{
  /* This used to be documented as a spec field and called as a function, so
     the one thing a course could write threw inside the renderer. */
  const pct = bar({ bars: [{ label: "a", value: 40 }], valueFmt: "{}%" });
  ck("a bar value format is a template string", pct.includes(">40%<"));

  const plain = bar({ bars: [{ label: "a", value: 40 }] });
  ck("no format leaves the value bare", plain.includes(">40<"));

  const fn = bar({ bars: [{ label: "a", value: 40 }], valueFmt: v => v + " ms" });
  ck("a function still works, for a caller that is JavaScript", fn.includes(">40 ms<"));

  const p = plot({ series: [{ label: "s", points: [[0, 0], [10, 10]] }], yfmt: "{} ms", xfmt: "t={}" });
  ck("a plot formats both axes", p.includes(">10 ms<") && p.includes(">t=10<"));

  /* scatter declared yfmt and never read it — the frame and the gridlines
     both took the default, so only the horizontal axis could carry units */
  const sc = scatter({ series: [{ points: [[0, 0], [10, 10]] }], yrange: [0, 10], xrange: [0, 10],
                       yfmt: "{} ms", xfmt: "t={}" });
  ck("a scatter formats both axes too", sc.includes(">10 ms<") && sc.includes(">t=10<"));
}

/* ---- spec check: what the renderer silently ignores, the build refuses ---- */
{
  const errsFor = (kind, spec) => {
    const e = [];
    checkFigure({ t: "figure", kind, spec }, "s1-1", e);
    return e;
  };
  const one = (name, kind, spec, needle) => {
    const e = errsFor(kind, spec);
    ck(name, e.length === 1 && e[0].includes(needle), e[0] || "no error raised");
  };

  /* The defect this exists for. `{label: resolve, note: path, credential,
     query}` is four keys, two of them null, and the note renders as "path". */
  const truncated = errsFor("flow",
    { steps: [{ label: "resolve", note: "path", credential: null, query: null }] });
  ck("an unquoted comma in a flow mapping is caught, every truncated key named",
     truncated.length === 2 && truncated.every(e => e.includes("unquoted comma")),
     truncated[0] || "no error raised");

  one("a dir the renderer does not know is caught", "flow", { steps: [], dir: "down" },
      'is not one of row, col');
  one("so is a layout", "graph", { nodes: [], layout: "column" }, "is not one of circle");

  one("a format with no placeholder is caught", "bar", { bars: [], valueFmt: "ms" }, "has no {}");
  one("a format that is not a string is caught", "bar", { bars: [], valueFmt: 5 },
      "must be a format string");
  ck("a well-formed format passes", errsFor("bar", { bars: [], valueFmt: "{}%" }).length === 0);

  one("a misspelt top-level key is caught", "bar", { bars: [], baselne: 0 }, 'unknown key "baselne"');
  one("so is one nested in a list item", "graph", { nodes: [{ id: "a", labe: "x" }] },
      'unknown key "labe"');
  one("an unregistered kind is caught", "sankey", {}, 'unknown figure kind "sankey"');

  ck("a valid spec raises nothing",
     errsFor("graph", { layout: "row", nodes: [{ id: "a", label: "A", note: "n" }],
                        edges: [{ from: "a", to: "a", self: true }] }).length === 0);

  /* the plot fn check moved into lib/figures.mjs with everything else */
  one("a plot fn that does not parse is still caught", "plot", { series: [{ fn: "x*" }] },
      "does not parse");
  one("a plot fn with no finite value is still caught", "plot",
      { series: [{ fn: "Math.log(x - 100)", from: 0, to: 10 }] }, "renders empty");
}

console.log(failed ? `\n${failed} failed` : "\nfigures ok");
process.exit(failed ? 1 : 0);
