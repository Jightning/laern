/* Figure kind: plot */
import { esc, tone, attr, txt, round, fmt } from "./base.js";
import { leftMargin, tickLabels } from "./axes.js";

/* ---------- kind: plot --------------------------------------------------
 * series: [{label, points:[[x,y]…]}] or [{label, fn:"x*x", from, to}]
 * ----------------------------------------------------------------------*/
export function plot (spec) {
  var W = spec.w || 620, H = spec.h || 300,
      m = { l: 52, r: 18, t: 16, b: 40 },
      iw = W - m.l - m.r, ih = H - m.t - m.b,
      series = (spec.series || []).map(function (s) {
        if (s.points) return s;
        var from = s.from != null ? s.from : (spec.xrange ? spec.xrange[0] : 0),
            to = s.to != null ? s.to : (spec.xrange ? spec.xrange[1] : 10),
            n = s.samples || 80, pts = [], f;
        try { f = new Function("x", "return (" + s.fn + ");"); } catch (e) { return { label: s.label, points: [] }; }
        for (var i = 0; i <= n; i++) {
          var x = from + (to - from) * (i / n), y = f(x);
          if (isFinite(y)) pts.push([x, y]);
        }
        return { label: s.label, points: pts, dash: s.dash };
      });

  var xf = fmt(spec.xfmt, round), yf = fmt(spec.yfmt, round);

  var xs = [], ys = [];
  series.forEach(function (s) { s.points.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
  if (!xs.length) return '<svg viewBox="0 0 ' + W + " " + H + '" class="fx"></svg>';
  var x0 = spec.xrange ? spec.xrange[0] : Math.min.apply(null, xs),
      x1 = spec.xrange ? spec.xrange[1] : Math.max.apply(null, xs),
      y0 = spec.yrange ? spec.yrange[0] : Math.min.apply(null, ys),
      y1 = spec.yrange ? spec.yrange[1] : Math.max.apply(null, ys);
  if (x1 === x0) x1 = x0 + 1;
  if (y1 === y0) y1 = y0 + 1;

  /* Now the vertical domain is settled, the left margin can be sized to the
     tick labels it will draw rather than to a fixed guess — see axes.js. This
     is also what brings plot onto the same margin as the other chart kinds,
     which had drifted 4px apart for no reason. */
  m.l = leftMargin(tickLabels([y0, y1], spec.ticks || 5, yf), spec.ylabel);
  iw = W - m.l - m.r;

  var px = function (x) { return m.l + ((x - x0) / (x1 - x0)) * iw; },
      py = function (y) { return m.t + ih - ((y - y0) / (y1 - y0)) * ih; };

  var out = '<svg viewBox="0 0 ' + W + " " + H + '" class="fx" role="img">';
  var ticks = spec.ticks || 5, i;
  for (i = 0; i <= ticks; i++) {
    var gv = y0 + ((y1 - y0) * i) / ticks, gy = py(gv);
    out += '<line x1="' + m.l + '" y1="' + gy + '" x2="' + (W - m.r) + '" y2="' + gy + '" class="fx-g"/>';
    out += txt(m.l - 9, gy + 4, yf(gv), "fx-ax", "end");
  }
  for (i = 0; i <= ticks; i++) {
    var xv = x0 + ((x1 - x0) * i) / ticks, gx = px(xv);
    out += txt(gx, H - m.b + 18, xf(xv), "fx-ax");
  }
  out += '<line x1="' + m.l + '" y1="' + (m.t + ih) + '" x2="' + (W - m.r) +
    '" y2="' + (m.t + ih) + '" class="fx-ax-l"/>';
  out += '<line x1="' + m.l + '" y1="' + m.t + '" x2="' + m.l + '" y2="' + (m.t + ih) + '" class="fx-ax-l"/>';

  series.forEach(function (s, k) {
    if (!s.points.length) return;
    var d = s.points.map(function (p, j) {
      return (j ? "L" : "M") + px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1);
    }).join(" ");
    out += '<path d="' + d + '" class="fx-s" style="stroke:' + tone(k) + '"' +
      (s.dash ? ' stroke-dasharray="5 4"' : "") + "/>";
  });
  if (spec.xlabel) out += txt(m.l + iw / 2, H - 6, spec.xlabel, "fx-al");
  if (spec.ylabel) out += '<text transform="translate(13,' + (m.t + ih / 2) +
    ') rotate(-90)" class="fx-t fx-al" text-anchor="middle">' + esc(spec.ylabel) + "</text>";
  out += "</svg>";
  if (series.length > 1 || spec.legend) {
    out += '<div class="fx-leg">' + series.map(function (s, k) {
      return '<span><i style="background:' + tone(k) + '"></i>' + esc(s.label || "series " + (k + 1)) + "</span>";
    }).join("") + "</div>";
  }
  return out;
}
