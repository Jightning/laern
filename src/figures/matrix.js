/* Figure kind: matrix */
import { esc, tone, attr, txt, round } from "./base.js";

/* ---------- kind: matrix ------------------------------------------------ */
export function matrix (spec) {
  var rows = spec.rows || [];
  return '<div class="fx-mx"><span class="fx-br">[</span><table>' +
    rows.map(function (r) {
      return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
    }).join("") + '</table><span class="fx-br">]</span>' +
    (spec.label ? '<span class="fx-mxl">' + esc(spec.label) + "</span>" : "") + "</div>";
}
