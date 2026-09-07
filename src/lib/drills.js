/* The drill bank, indexed. Repetition for fluency lives here rather than in
 * the quiz, which covers the question surface once per type (M5).
 *
 * Item ids are positional, like every other id in a course, so authors never
 * write one — and the criterion counts distinct ids, so they have to be stable.
 */
const idOf = (key, i) => `${key}:d${i + 1}`;

export function indexDrills(C) {
  const byConcept = {};
  for (const [key, file] of Object.entries(C.drills || {})) {
    const items = (file.items || []).map((it, i) =>
      ({ ...it, id: idOf(key, i), concept: key }));
    if (items.length) byConcept[key] = items;
  }
  const keys = Object.keys(byConcept);

  /* Interleaving pays where categories are confusable and costs where they are
     not (Brunmair & Richter 2019), so a mix is built from a declared cluster
     first and falls back to whatever else is due. */
  const cluster = key => {
    const near = ((C.concepts || {})[key] || {}).confusable_with || [];
    return [key, ...near].filter(k => byConcept[k]);
  };

  /* The criterion needs three *different* items, so a seen id is skipped
     until the bank runs out of unseen ones. */
  const pick = (key, seen = []) => {
    const items = byConcept[key] || [];
    if (!items.length) return null;
    return items.find(it => !seen.includes(it.id)) || items[0];
  };

  return { byConcept, keys, cluster, pick, has: keys.length > 0 };
}
