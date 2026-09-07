/* Figure numbering.
 *
 * A caption can only be cited from prose if it has a number, and a number is
 * only stable if it comes from the data rather than from where the figure
 * happens to land on screen. Numbers are section-scoped — "Figure 3.2" is the
 * second figure in section 3 — so inserting a figure renumbers one section
 * instead of the whole course.
 *
 * A figure earns a citable key by declaring `id:` in its block. Prose then
 * writes <f k="that-id"/> and the engine substitutes the number and the link,
 * exactly as <c k="…"> does for concepts.
 */
const NUMBERED = new Set(["figure", "image"]);

export function numberFigures(C) {
  const byBlock = new WeakMap(), byKey = {};

  (C.sections || []).forEach(s => {
    let n = 0;
    (s.subs || []).forEach(sub => (sub.blocks || []).forEach(b => {
      if (!b || !NUMBERED.has(b.t)) return;
      const num = `${s.num}.${++n}`;
      byBlock.set(b, num);
      if (b.id) byKey[b.id] = { num, subId: sub.id, cap: b.cap || b.alt || "" };
    }));
  });

  return { numOf: b => byBlock.get(b) || null, byKey };
}
