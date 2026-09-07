/* Figure kinds. A figure block is {t:"figure", kind, cap, spec}. */
import { bar } from "./bar.js";
import { flow } from "./flow.js";
import { graph } from "./graph.js";
import { grid } from "./grid.js";
import { matrix } from "./matrix.js";
import { plot } from "./plot.js";
import { scatter } from "./scatter.js";
import { svg } from "./svg.js";
import { timing } from "./timing.js";

export const Figures = { bar, flow, graph, grid, matrix, plot, scatter, svg, timing };
export const KINDS = Object.keys(Figures);
