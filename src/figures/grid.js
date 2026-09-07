/* Figure kind: grid */
import { esc, tone, attr, txt, round } from "./base.js";

/* ---------- kind: grid --------------------------------------------------
 * A labelled 2-D grid with optionally highlighted cell groups.
 * Generic: Karnaugh maps, state tables, payoff matrices, confusion matrices.
 *   {rowVars, colVars, rowLabels, colLabels, cells, index?, groups?}
 * index:"binary" numbers each cell from its row+column labels read as bits.
 * ----------------------------------------------------------------------*/
export function grid (spec) {
  var rl = spec.rowLabels || [], cl = spec.colLabels || [], cells = spec.cells || [];
  var vs = (window.COURSE && window.COURSE.valueStyles) || {};
  var gi = {};
  (spec.groups || []).forEach(function (g, n) {
    (g.cells || []).forEach(function (rc) { gi[rc[0] + "," + rc[1]] = n % 3; });
  });
  function val(v) {
    var t = String(v).trim();
    return vs[t] ? '<span class="' + vs[t] + '">' + esc(t) + "</span>" : esc(t);
  }
  var corner = (spec.rowVars || []).join("") + "\\" + (spec.colVars || []).join("");
  var h = '<div class="fx-grid"><div class="fx-gw" style="grid-template-columns:repeat(' +
    (cl.length + 1) + ',auto)">';
  h += '<div class="fx-gc">' + esc(corner) + "</div>";
  cl.forEach(function (c) { h += '<div class="fx-gh">' + esc(c) + "</div>"; });
  for (var i = 0; i < rl.length; i++) {
    h += '<div class="fx-gh">' + esc(rl[i]) + "</div>";
    for (var j = 0; j < cl.length; j++) {
      var g = gi[i + "," + j];
      var idx = spec.index === "binary"
        ? '<span class="fx-gi">' + parseInt(String(rl[i]) + String(cl[j]), 2) + "</span>" : "";
      h += '<div class="fx-gcell' + (g != null ? " g" + g : "") + '">' + idx +
        val((cells[i] || [])[j]) + "</div>";
    }
  }
  h += "</div>";
  if (spec.groups && spec.groups.length) {
    h += '<div class="fx-gl">' + spec.groups.map(function (g, n) {
      return '<span class="l' + (n % 3) + '">' + esc(g.label) + "</span>";
    }).join("") + "</div>";
  }
  return h + "</div>";
}
