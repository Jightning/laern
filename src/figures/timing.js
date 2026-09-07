/* Figure kind: timing */
import { esc, tone, attr, txt, round } from "./base.js";

/* ---------- kind: timing ------------------------------------------------
 * Square-wave traces. {signals:[{name, wave:"01011"}], unit?}
 * ----------------------------------------------------------------------*/
export function timing (spec) {
  var u = spec.unit || 26, hh = 22, pad = 3;
  function draw(w) {
    var v = String(w).split(""), width = v.length * u, prev = null, x = 0, path = [];
    var y = function (t) { return t === "1" ? pad : pad + hh; };
    for (var i = 0; i < v.length; i++) {
      var t = v[i] === "1" ? "1" : "0";
      if (prev === null) path.push("M " + x + " " + y(t));
      else if (t !== prev) path.push("L " + x + " " + y(t));
      x += u; path.push("L " + x + " " + y(t)); prev = t;
    }
    return '<svg width="' + width + '" height="' + (hh + pad * 2) + '" aria-hidden="true">' +
      '<path d="' + path.join(" ") + '" fill="none" stroke="var(--hi)" stroke-width="1.8"/></svg>';
  }
  return '<div class="fx-tm">' + (spec.signals || []).map(function (s) {
    return '<div class="fx-tr"><span class="fx-tn">' + esc(s.name) + "</span>" +
      draw(s.wave) + "</div>";
  }).join("") + "</div>";
}
