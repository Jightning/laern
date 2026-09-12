/* A block's principal tag, worn where the block sits.
 *
 * The chip is text first, because colour never carries meaning on its own
 * (T26) and because the reader has to be able to say the category's name to
 * look for it again. The monogram beside it is the recognisable part: it is
 * the same two or three characters everywhere that category appears, so a
 * scan down a section reads as a pattern rather than as a column of prose.
 *
 * No per-category hue. The palette is one angle per course, swept for contrast
 * in three colour modes across every view; a hue per category would multiply
 * that sweep to decorate something the text already says. Position and the
 * monogram do the keying instead, and both survive a colourblind reader, a
 * greyscale print and a dark theme without anything being re-measured.
 *
 * Chips do not render at `full` depth. Signalling is a contrast effect and it
 * degrades with density (T13) — a chip on every block during a reading pass is
 * wallpaper. Categorisation is a review-time device, so it appears exactly
 * where review happens.
 */

/** Two or three characters that stand for a category, stable across the site. */
export function monogram(name, short) {
  if (short) return String(short).slice(0, 3).toUpperCase();
  const words = String(name || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CatChip({ ctx, k, count }) {
  const d = (ctx.idx.CAT.cats || {})[k];
  if (!d) return null;
  const name = d.name || k;
  return (
    <a class="cchip" href={`#/${ctx.cid}/cat/${k}`} title={d.boundary || name}>
      <span class="cchip-m" aria-hidden="true">{monogram(name, d.short)}</span>
      <span class="cchip-n">{name}</span>
      {count != null && <span class="cchip-c">{count}</span>}
    </a>
  );
}
