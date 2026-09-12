import { qid } from "../lib/util.js";
import { nextUp } from "../lib/next.js";
import { peek } from "../lib/place.js";
import { counts } from "../lib/retention.js";

/* The course's front page: one recommendation, then the shape of the course.
 *
 * What it replaces was an inventory — six counts, two of them saying the same
 * thing, all six zero on the day a reader arrives — above three equal ghost
 * buttons, none of which was "begin". The section list, the only thing a new
 * reader actually wants, was the quietest element on the page and started
 * 1,400px down a phone.
 *
 * `next.js` decides what leads and why; this only draws it. The secondary
 * items are drawn too, so the ranking stays a suggestion rather than a gate.
 */

/* Where a section stands: every question mastered, some answered, or none.
 *
 * A mark rather than a number, because the number is already two columns over
 * and a second copy of it is not a second piece of information. Shape carries
 * it as well as fill, so it survives a reader who cannot separate the accent
 * from the rule (T26). */
function mark(s) {
  if (!s || !s.total) return { cls: "", label: "" };
  if (s.got >= s.total) return { cls: " done", label: "finished" };
  if (s.seen > 0) return { cls: " part", label: "in progress" };
  return { cls: "", label: "not started" };
}

export default function Desk({ ctx }) {
  const { C, cid, idx, state, drills } = ctx;
  const H = r => `#/${cid}${r ? "/" + r : ""}`;

  const items = nextUp({ C, cid, idx, state, drills, place: peek() });
  const [lead, ...rest] = items;

  /* Loop B, stated once. The strip used to print three counts beside three
     more; what a reader can act on is how many are due, and the rest is
     answered on the calibration page by someone who went looking for it. */
  const b = drills.has ? counts(cid, drills.keys) : null;

  return (
    <div class="desk">
      <h1>{C.title}</h1>
      <p class="lede">{C.tagline}</p>

      {/* The recommendation. One action, one reason, one button — and it is a
          link rather than a button because it goes somewhere, which is what a
          keyboard reader and an open-in-new-tab both need. */}
      {/* One variant, not one per kind: the only visual distinction the row
          makes is whether it is a next step or something already decaying,
          which is binary. The eyebrow says which in words regardless. */}
      <a class={"now" + (lead.kind === "review" ? " now-review" : "")} href={lead.href}>
        <span class="now-txt">
          <span class="now-k">{lead.kind === "resume" ? "Pick up here" : "Next"}</span>
          <span class="now-h">{lead.title}</span>
          <span class="now-w">{lead.why}</span>
        </span>
        <span class="now-go" aria-hidden="true">
          {lead.kind === "resume" ? "Continue" : "Open"} →
        </span>
      </a>

      {rest.length > 0 && (
        <div class="also">
          {rest.map(x => (
            <a class="also-i" href={x.href} key={x.href + x.kind}>
              {x.count != null && <b>{x.count}</b>}
              <span>{x.count != null ? x.title.replace(/^\d+\s+/, "") : x.title}</span>
            </a>
          ))}
        </div>
      )}

      {/* The spine. Progress as a column of marks that fills, rather than as a
          percentage: the goal gradient responds to a visible distance closing,
          and a course is a sequence, so its own order is the honest axis. */}
      <ol class="spine">
        {C.sections.map(s => {
          const ids = [];
          s.subs.forEach(u => (u.quiz || []).forEach(q => ids.push(qid(u.id, q.type))));
          const ss = state.on ? state.stats(ids) : null;
          const m = mark(ss);
          const pct = ss && ss.total ? Math.round((ss.got / ss.total) * 100) : 0;
          return (
            <li key={s.id}>
              <a class={"srow" + (m.cls ? " has" : "")} href={H(s.id)}>
                <span class="srow-n">{String(s.num).padStart(2, "0")}</span>
                <span class={"srow-m" + m.cls} aria-hidden="true" />
                <span class="srow-t">{s.title}</span>
                <span class="srow-c">
                  {ss && ss.total
                    ? <><span class="srow-sr">{m.label}, </span>{ss.got}/{ss.total}</>
                    : `${s.subs.length} parts`}
                </span>
                {/* Only once there is something to draw. An empty track under
                    every row is a second horizontal line above the one that
                    already separates them — which is why the dashboard this
                    replaced had no bar at all. A bar that appears when you
                    start is also the clearer signal: the row changes shape the
                    first time you answer anything in it. */}
                {pct > 0 && (
                  <span class="srow-bar"><i style={`width:${pct}%`} /></span>
                )}
                <span class="srow-s">
                  {s.subs.map((u, i) => `${s.num}.${i + 1} ${u.title}`).join(" · ")}
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      {/* Everything that is not the reading path. Quiet, and last, because a
          reader who wants the map goes looking for the map. */}
      <div class="tools">
        <a href={H("practice")}>Mixed practice</a>
        <a href={H("concepts")}>Core concepts</a>
        <a href={H("map")}>Dependency map</a>
        <a href={H("calibration")}>
          Calibration{b && b.seen ? ` · ${b.durable}/${b.total} durable` : ""}
        </a>
      </div>
    </div>
  );
}
