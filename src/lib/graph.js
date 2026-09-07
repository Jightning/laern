/* Graph tidying for the dependency map.
 *
 * Cross-references produce a dense graph: if §12 cites §3 and §11, and §11
 * already cites §3, the §12→§3 edge is implied and only adds clutter. Removing
 * every edge that is implied by a longer path (a transitive reduction) leaves
 * the skeleton of what actually depends on what. */

/** drop edges that are implied by a path of two or more other edges */
export function transitiveReduction(nodes, edges) {
  const ids = nodes.map(n => n.id);
  const adj = new Map(ids.map(i => [i, new Set()]));
  edges.forEach(e => adj.get(e.from)?.add(e.to));

  /* reachability excluding the direct hop, computed per source */
  const reachableBeyond = from => {
    const seen = new Set();
    const stack = [...(adj.get(from) || [])].flatMap(m => [...(adj.get(m) || [])]);
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      (adj.get(n) || []).forEach(x => stack.push(x));
    }
    return seen;
  };

  const cache = new Map();
  return edges.filter(e => {
    if (!cache.has(e.from)) cache.set(e.from, reachableBeyond(e.from));
    return !cache.get(e.from).has(e.to);
  });
}
