import { LANES } from "../lib/tiers.js";

/* How much of the section the reader wants.
 *
 * It lives at the head of the material rather than in the topbar: the topbar is
 * global chrome and the lane is per-course state, so the control belongs beside
 * what it controls. Below the rail breakpoint the three buttons become one that
 * cycles, named by the lane it is in — both are rendered and the stylesheet
 * picks, so neither needs to ask the viewport a question in JavaScript. */
export default function LaneSelect({ lane, onLane }) {
  const i = Math.max(0, LANES.findIndex(l => l.id === lane));

  return (
    <div class="lane" role="group" aria-label="Reading depth">
      <span class="lane-l">Read</span>
      <span class="lane-set">
        {LANES.map(l => (
          <button key={l.id} class={"lane-b" + (l.id === lane ? " sel" : "")}
                  data-lane={l.id} aria-pressed={l.id === lane}
                  onClick={() => onLane(l.id)}>{l.label}</button>
        ))}
      </span>
      <button class="lane-b lane-cycle" data-lane-cycle
              onClick={() => onLane(LANES[(i + 1) % LANES.length].id)}>
        {LANES[i].label}
      </button>
      <span class="lane-k">1 2 3</span>
    </div>
  );
}
