import { MODES, modeOf, nearestMode, modeById } from "../lib/mode.js";

/* What the reader is here to do, in the toolbar where a setting belongs.
 *
 * This replaces two segmented controls that sat in the content flow, above the
 * first paragraph of every section. It is one control because the reader has
 * one intent; the two axes underneath it are still there, still bound to their
 * keys, and reachable from the sidebar for anyone who wants them.
 *
 * When the axes have been moved to a pair that is not a preset, the switch says
 * so — "Review · edited" — rather than showing the nearest intent as though it
 * were exact. The alternative is a control that lies about the state of the
 * page the reader is looking at.
 */
export default function ModeSwitch({ lane, depth, onMode }) {
  const exact = modeOf(lane, depth);
  const shown = exact || nearestMode(lane, depth);
  const i = Math.max(0, MODES.findIndex(m => m.id === shown));

  return (
    <div class="modesw" role="group" aria-label="Reading mode">
      {/* Below the drawer breakpoint the three become one that cycles, named by
          the mode it is in. Three fixed labels plus Menu, Review and Search do
          not fit a 390px bar, and the mode matters more on a phone than on a
          desktop, so it stays in the bar rather than moving into the drawer.
          Both forms render and the stylesheet picks, so neither has to ask the
          viewport a question in JavaScript. */}
      <button class="modesw-b modesw-cycle" aria-label={`Reading mode: ${MODES[i].label}`}
              title={MODES[i].hint}
              onClick={() => onMode(MODES[(i + 1) % MODES.length])}>
        {MODES[i].label}{!exact && <span class="modesw-e">·</span>}
      </button>
      {MODES.map(m => {
        const on = m.id === shown;
        return (
          <button key={m.id} class={"modesw-b" + (on ? " sel" : "")}
                  aria-pressed={on} title={m.hint}
                  onClick={() => onMode(m)}>
            {m.label}
            {on && !exact && <span class="modesw-e" title="the axes have been changed by hand">·</span>}
          </button>
        );
      })}
    </div>
  );
}

export { modeById };
