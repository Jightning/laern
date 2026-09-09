/* Figure kind: bar — comparing magnitudes across labelled categories.
 * {bars:[{label, value, accent?}], ylabel, xlabel, baseline?} */
import { esc, tone, txt, fmt } from "./base.js";
import { frame, grid, axisLabels, scale } from "./axes.js";

export function bar(spec) {
  const bars = spec.bars || [];
  if (!bars.length) return "";
  /* the domain is settled first, so the frame can size its left margin to the
     tick labels it will actually draw */
  const values = bars.map(b => Number(b.value) || 0);
  const top = spec.max != null ? spec.max : Math.max(...values, 0);
  const base = spec.baseline != null ? spec.baseline : Math.min(0, ...values);
  const dom = [base, top === base ? base + 1 : top];
  const f = frame(spec, dom, spec.ticks || 5);
  const py = scale(dom, [f.m.t + f.ih, f.m.t]);

  const label = fmt(spec.valueFmt, String);

  const slot = f.iw / bars.length;
  const bw = Math.min(slot * 0.62, 74);

  /* A many-bar chart squeezes each category label into a few pixels once the
     browser scales it down, so past a dozen bars it gets an intrinsic minimum
     and the figure frame scrolls instead. */
  const wide = bars.length > 12 || f.w > 720;
  let out = `<svg viewBox="0 0 ${f.w} ${f.h}" class="fx"` +
    (wide ? ` style="min-width:${Math.min(Math.round(f.w), 760)}px"` : ``) +
    ` role="img">`;
  out += grid(f, dom, spec.ticks || 5);

  /* wrap a label that is wider than its slot onto two centred lines */
  const labelLines = s => {
    s = String(s == null ? "" : s);
    const cap = Math.max(6, Math.floor(slot / 6.4));
    if (s.length <= cap || !s.includes(" ")) return [s];
    const w = s.split(/\s+/), mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
  };

  bars.forEach((b, i) => {
    const v = Number(b.value) || 0;
    const x = f.m.l + slot * i + (slot - bw) / 2;
    const y = py(v), y0 = py(dom[0]);
    out += `<rect x="${x.toFixed(1)}" y="${Math.min(y, y0).toFixed(1)}" width="${bw.toFixed(1)}" ` +
      `height="${Math.abs(y0 - y).toFixed(1)}" rx="2" class="fx-bar" ` +
      `style="fill:${tone(b.accent != null ? b.accent : i)}"/>`;
    out += txt(x + bw / 2, y - 7, label(v), "fx-el");
    labelLines(b.label).forEach((ln, li) => {
      out += txt(x + bw / 2, f.m.t + f.ih + 17 + li * 11, ln, "fx-ax");
    });
  });
  out += axisLabels(f, spec);
  return out + "</svg>";
}
