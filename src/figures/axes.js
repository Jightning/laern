/* Shared plotting frame: scales, gridlines and axis labels.
 * Used by every chart kind so they share one visual language. */
import { esc, round, txt } from "./base.js";

export const MARGIN = { l: 56, r: 20, t: 18, b: 44 };

/* The left margin has to hold three things: the widest tick label, the 9px gap
 * to the axis, and the rotated axis title. It was a fixed 56px, which fits a
 * short label and nothing else — on any chart whose values reach four figures
 * the ticks format as "2.0e+4", 36px wide, and the title was drawn straight
 * through them.
 *
 * Tick labels are monospaced, which is the one case where a text width follows
 * from a character count rather than needing to be measured — so the margin is
 * derived instead of guessed, and a chart with short labels keeps its plotting
 * area rather than paying for a worst case it does not have. */
const TICK_FONT = 10, MONO_ADVANCE = 0.6, TICK_GAP = 9, TITLE_BAND = 20;

/** the tick strings `grid` will draw, so their width can be accounted for */
export function tickLabels(domain, ticks = 5, fmt = round) {
  const out = [];
  for (let i = 0; i <= ticks; i++)
    out.push(String(fmt(domain[0] + ((domain[1] - domain[0]) * i) / ticks)));
  return out;
}

export function leftMargin(labels, ylabel) {
  const widest = Math.max(0, ...labels.map(s => s.length)) * TICK_FONT * MONO_ADVANCE;
  return Math.max(MARGIN.l, Math.ceil(widest) + TICK_GAP + (ylabel ? TITLE_BAND : 6));
}

/** map a data range onto pixels */
export function scale(domain, range) {
  const [d0, d1] = domain, [r0, r1] = range;
  const span = d1 - d0 || 1;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

/** `yDomain` is optional only so a caller with no vertical axis can omit it;
 *  every chart that draws ticks passes it, and gets a margin that fits them. */
export function frame(spec, yDomain, ticks = 5, fmt = round) {
  const w = spec.w || 640, h = spec.h || 320;
  const m = yDomain
    ? { ...MARGIN, l: leftMargin(tickLabels(yDomain, ticks, fmt), spec.ylabel) }
    : MARGIN;
  return { w, h, m, iw: w - m.l - m.r, ih: h - m.t - m.b };
}

/** horizontal gridlines with value labels, plus the two axis rules */
export function grid(f, yDomain, ticks = 5, fmt = round) {
  const py = scale(yDomain, [f.m.t + f.ih, f.m.t]);
  let out = "";
  for (let i = 0; i <= ticks; i++) {
    const v = yDomain[0] + ((yDomain[1] - yDomain[0]) * i) / ticks;
    const y = py(v);
    out += `<line x1="${f.m.l}" y1="${y}" x2="${f.w - f.m.r}" y2="${y}" class="fx-g"/>`;
    out += txt(f.m.l - 9, y + 4, fmt(v), "fx-ax", "end");
  }
  out += `<line x1="${f.m.l}" y1="${f.m.t + f.ih}" x2="${f.w - f.m.r}" y2="${f.m.t + f.ih}" class="fx-ax-l"/>`;
  out += `<line x1="${f.m.l}" y1="${f.m.t}" x2="${f.m.l}" y2="${f.m.t + f.ih}" class="fx-ax-l"/>`;
  return out;
}

/** value labels along the horizontal axis, matching the vertical ones */
export function xTicks(f, xDomain, ticks = 5, fmt = round) {
  let out = "";
  const px = scale(xDomain, [f.m.l, f.w - f.m.r]);
  for (let i = 0; i <= ticks; i++) {
    const v = xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / ticks;
    out += txt(px(v), f.m.t + f.ih + 18, fmt(v), "fx-ax");
  }
  return out;
}

export function axisLabels(f, spec) {
  let out = "";
  if (spec.xlabel) out += txt(f.m.l + f.iw / 2, f.h - 6, spec.xlabel, "fx-al");
  if (spec.ylabel)
    out += `<text transform="translate(14,${f.m.t + f.ih / 2}) rotate(-90)" ` +
           `class="fx-t fx-al" text-anchor="middle">${esc(spec.ylabel)}</text>`;
  return out;
}

export function legend(items, tone) {
  if (items.length < 2) return "";
  return `<div class="fx-leg">` + items.map((l, i) =>
    `<span><i style="background:${tone(i)}"></i>${esc(l)}</span>`).join("") + `</div>`;
}

/** pad a domain so marks do not sit on the frame */
export function padded(values, pad = 0.08) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const d = (hi - lo) * pad;
  return [lo - d, hi + d];
}
