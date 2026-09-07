import { stubLabel } from "../lib/tiers.js";
import { RefChip } from "./MarginNote.jsx";

/* What the lane collapsed, and what it holds.
 *
 * A dashed rule with a count, not a coloured band: colour never carries meaning
 * on its own, and the count is the signal. The stub sits in the row's own
 * leading gap rather than in a block of its own, so expanding it cannot move
 * the next block out of line with its margin card.
 *
 * References inside a collapsed run demote to chips on the stub line. A stub
 * is one line tall, and a margin card anchored to a one-line row is a hole by
 * construction — which is the same reason "used later in" rides a block
 * rather than a heading. */
export default function TierStub({ items, refs, ctx, onExpand }) {
  return (
    <div class="tstub">
      <button class="tstub-b" aria-expanded="false" onClick={onExpand}>
        <span class="tstub-t">{stubLabel(items)}</span>
        <span class="tstub-chev" aria-hidden="true">▸</span>
      </button>
      {refs.length > 0 && (
        <span class="tstub-chips">
          {refs.map(r => <RefChip key={r.kind + r.id} r={r} ctx={ctx} />)}
        </span>
      )}
    </div>
  );
}
