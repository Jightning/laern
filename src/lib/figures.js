/* Figure and table numbering.
 *
 * A caption can only be cited from prose if it has a number, and a number is
 * only stable if it comes from the data rather than from where the figure
 * happens to land on screen. Numbers are section-scoped — "Figure 3.2" is the
 * second figure in section 3 — so inserting a figure renumbers one section
 * instead of the whole book.
 *
 * A figure earns a citable key by declaring `id:` in its block. Prose then
 * writes <f k="that-id"/> and the engine substitutes the number and the link,
 * exactly as <c k="…"> does for concepts.
 *
 * Tables are numbered on the same rule and in their own sequence. The
 * justification was always general — a caption that cannot be cited is one the
 * prose has to re-describe in words, which is M1 violated by the engine rather
 * than by the author — and `table` was simply never brought under it. Two
 * sequences rather than one, because "Table 3.1" and "Figure 3.1" are how a
 * reader expects them counted, and merging them would renumber every figure in
 * a section when a table is inserted above it.
 */
const KINDS = { figure: "Figure", image: "Figure", table: "Table" };

export function numberFigures(C) {
  const byBlock = new WeakMap(), byKey = {};

  (C.sections || []).forEach(s => {
    const n = { Figure: 0, Table: 0 };
    (s.subs || []).forEach(sub => (sub.blocks || []).forEach(b => {
      if (!b || !KINDS[b.t]) return;
      const kind = KINDS[b.t];
      const num = `${s.num}.${++n[kind]}`;
      byBlock.set(b, num);
      if (b.id) byKey[b.id] = { num, kind, subId: sub.id, cap: b.cap || b.alt || "" };
    }));
  });

  return { numOf: b => byBlock.get(b) || null, kindOf: b => (b && KINDS[b.t]) || null, byKey };
}
