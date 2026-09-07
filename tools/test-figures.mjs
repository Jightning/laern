#!/usr/bin/env node
/* Figure rendering rules a browser test would otherwise be the only check on:
 * node labels that stay inside the node, and large figures that scroll rather
 * than shrink to an unreadable size.
 *
 *   node tools/test-figures.mjs
 */
import { graph } from "../src/figures/graph.js";
import { bar } from "../src/figures/bar.js";
import { leftMargin, tickLabels, MARGIN } from "../src/figures/axes.js";

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

console.log(failed ? `\n${failed} failed` : "\nfigures ok");
process.exit(failed ? 1 : 0);
