/* Figure kind: flow */
import { esc } from "./base.js";

/* ---------- kind: flow --------------------------------------------------
 * steps: [{label, note?}]   dir: "row" | "col"
 *
 * An ordered list, because that is what a procedure is — screen readers and
 * the page agree, and the numbering needs no glyph. Connectors are drawn in
 * CSS rather than emitted as arrow characters between the steps: a character
 * in the flow had to be centred against boxes it knew nothing about, which is
 * why the arrows and the boxes never lined up.
 * ----------------------------------------------------------------------*/
export function flow (spec) {
  var steps = spec.steps || [], dir = spec.dir === "col" ? "col" : "row";
  return '<ol class="fx-flow is-' + dir + '">' +
    steps.map(function (s, i) {
      return '<li class="fx-step">' +
        '<span class="fx-si">' + (i + 1) + "</span>" +
        '<span class="fx-sl">' + esc(s.label) + "</span>" +
        (s.note ? '<span class="fx-sn">' + esc(s.note) + "</span>" : "") +
      "</li>";
    }).join("") + "</ol>";
}
