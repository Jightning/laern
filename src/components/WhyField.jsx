import { useState } from "preact/hooks";
import { lastWhy } from "../lib/why.js";
import { ago } from "../lib/util.js";

/* The reader states why, before the reveal.
 *
 * Two lines, and skipping is one click — the point is that a reason gets
 * produced, not that it gets produced every time. The skip is recorded, so the
 * calibration report can say how often it happens. The reason given last time
 * is shown beside the question, in learner styling, so it never reads as
 * something the material said. */
export default function WhyField({ cid, itemId, prompt, onCommit }) {
  const [text, setText] = useState("");
  const prior = lastWhy(cid, itemId);

  const commit = skipped => onCommit({ text: skipped ? "" : text.trim(), skipped });

  return (
    <div class="why" data-nosnippet>
      <label class="why-l" for={`why-${itemId}`}>{prompt || "Why?"}</label>
      <textarea id={`why-${itemId}`} class="why-in" rows="2" value={text}
                placeholder="One line is enough."
                onInput={e => setText(e.currentTarget.value)} />
      {prior && prior.text && (
        <div class="why-prior">
          <span class="why-pl">last time you said</span>
          “{prior.text}” — {ago(prior.ts)}{prior.correct === false ? ", wrong" : prior.correct ? ", right" : ""}
          {prior.conf === "sure" ? ", confident" : ""}
        </div>
      )}
      <div class="why-nav">
        <button class="gbtn" onClick={() => commit(true)}>Skip</button>
        <button class="cbtn sel" data-reveal onClick={() => commit(false)} disabled={!text.trim()}>
          Reveal
        </button>
      </div>
    </div>
  );
}

