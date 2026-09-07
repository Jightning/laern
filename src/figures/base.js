/* Shared helpers for every figure kind. */
/* ---------- small helpers ---------- */
function esc(s) {
  return String(s).replace(/[&<>]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
  });
}
var PAL = ["var(--hi)", "var(--lo)", "var(--dc)", "var(--hz)"];
function tone(i) { return PAL[i % PAL.length]; }
function attr(o) {
  return Object.keys(o).map(function (k) {
    return k + '="' + o[k] + '"';
  }).join(" ");
}
function txt(x, y, s, cls, anchor) {
  return '<text x="' + x + '" y="' + y + '" class="fx-t ' + (cls || "") +
    '" text-anchor="' + (anchor || "middle") + '">' + esc(s) + "</text>";
}
function round(v) {
  var a = Math.abs(v);
  if (a >= 1000 || (a < 0.01 && a > 0)) return v.toExponential(1);
  return String(Math.round(v * 100) / 100);
}

export { esc, tone, attr, txt, round, PAL };
