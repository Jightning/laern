/* DEMO 001 — the per-course escape hatch (create_course §15).
 *
 * A course that needs a renderer the built-ins cannot express ships one here
 * and nothing else in the project changes. It is loaded automatically; the
 * build then reports "custom blocks" instead of "no code" for this course.
 *
 * This one adds `metric`: a single number with a caption, for stating an
 * effect size where a table would be more than the point needs.
 *
 *   - t: metric
 *     value: <m>g = 0.51</m>
 *     label: retrieval practice vs. restudy
 *     source: Adesope et al. 2017
 */
export default function (Blocks, U) {
  Blocks.register("metric", {
    render: b =>
      `<div class="metric">` +
      `<span class="metric-v">${b.value || ""}</span>` +
      `<span class="metric-l">${b.label || ""}</span>` +
      U.src(b) +
      `</div>`
  });
}
