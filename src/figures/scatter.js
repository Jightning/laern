/* Figure kind: scatter — showing how two measured quantities relate.
 * {series:[{label, points:[[x,y]…]}], xlabel, ylabel, trend:true} */
import { tone } from "./base.js";
import { frame, grid, xTicks, axisLabels, scale, legend, padded } from "./axes.js";

/** least-squares line, drawn only when asked for */
function fit(points) {
  const n = points.length;
  if (n < 2) return null;
  const sx = points.reduce((a, p) => a + p[0], 0), sy = points.reduce((a, p) => a + p[1], 0);
  const sxx = points.reduce((a, p) => a + p[0] * p[0], 0);
  const sxy = points.reduce((a, p) => a + p[0] * p[1], 0);
  const d = n * sxx - sx * sx;
  if (!d) return null;
  const m = (n * sxy - sx * sy) / d;
  return { m, b: (sy - m * sx) / n };
}

export function scatter(spec) {
  const series = spec.series || [];
  const all = series.flatMap(s => s.points || []);
  if (!all.length) return "";
  const xd = spec.xrange || padded(all.map(p => p[0]));
  const yd = spec.yrange || padded(all.map(p => p[1]));
  const f = frame(spec, yd, spec.ticks || 5);
  const px = scale(xd, [f.m.l, f.w - f.m.r]);
  const py = scale(yd, [f.m.t + f.ih, f.m.t]);

  let out = `<svg viewBox="0 0 ${f.w} ${f.h}" class="fx" role="img">`;
  out += grid(f, yd, spec.ticks || 5);
  /* A scatter is about where a point sits, so the horizontal axis needs values
     on it. It was the only kind drawing an axis rule with nothing against it —
     plot labels its x ticks and bar names its categories. */
  out += xTicks(f, xd, spec.ticks || 5, spec.xfmt || undefined);

  series.forEach((s, i) => {
    const pts = s.points || [];
    if (spec.trend) {
      const line = fit(pts);
      if (line) {
        const x0 = xd[0], x1 = xd[1];
        out += `<line x1="${px(x0)}" y1="${py(line.m * x0 + line.b)}" ` +
          `x2="${px(x1)}" y2="${py(line.m * x1 + line.b)}" class="fx-trend" ` +
          `style="stroke:${tone(i)}"/>`;
      }
    }
    pts.forEach(p => {
      out += `<circle cx="${px(p[0]).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="3.6" ` +
        `class="fx-pt" style="fill:${tone(i)}"/>`;
    });
  });
  out += axisLabels(f, spec) + "</svg>";
  return out + legend(series.map((s, i) => s.label || `series ${i + 1}`), tone);
}
