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

/* A tick or value format is authored as a template string — "{} ms", "{}%" —
   because a course is a folder of data files (T19) and cannot hold a function.
   `{}` stands for the value, already formatted the way the axis would have
   formatted it anyway, so a format only ever adds units or a symbol. A
   function is still accepted, for a caller that is JavaScript to begin with.
   Anything else falls back rather than throwing: a course that gets this
   wrong fails validate.mjs, and the reader is not who should find out. */
function fmt(f, dflt) {
  if (typeof f === "function") return f;
  if (typeof f === "string") return function (v) { return f.replace("{}", function () { return dflt(v); }); };
  return dflt;
}

export { esc, tone, attr, txt, round, fmt, PAL };
