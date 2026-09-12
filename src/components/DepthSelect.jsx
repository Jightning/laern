import { DEPTHS, nextDepth } from "../lib/depth.js";

/* How much of each block is on the page.
 *
 * It sits beside the lane rather than replacing it, because the two ask
 * different questions and a reader wants both answers at once: the lane
 * decides which blocks belong to the argument, the depth decides how much of
 * each one is open. Neither can stand in for the other — a course whose blocks
 * are almost all spine has nothing for the lane to remove and still has four
 * fifths of its prose to close.
 *
 * Bound to `d`, cycling, because `1` `2` `3` already belong to the lane and a
 * reader changing depth is usually stepping one way along it rather than
 * jumping. The narrow form is the same button the wide form cycles with, so
 * neither has to ask the viewport a question in JavaScript. */
export default function DepthSelect({ depth, onDepth }) {
  const i = Math.max(0, DEPTHS.findIndex(d => d.id === depth));

  return (
    <div class="depth" role="group" aria-label="Reading depth">
      <span class="lane-l">Show</span>
      <span class="lane-set">
        {DEPTHS.map(d => (
          <button key={d.id} class={"lane-b" + (d.id === depth ? " sel" : "")}
                  data-depth={d.id} aria-pressed={d.id === depth}
                  title={d.hint} onClick={() => onDepth(d.id)}>{d.label}</button>
        ))}
      </span>
      <button class="lane-b lane-cycle" data-lane-cycle
              onClick={() => onDepth(nextDepth(depth))}>
        {DEPTHS[i].label}
      </button>
      <span class="lane-k">d</span>
    </div>
  );
}
