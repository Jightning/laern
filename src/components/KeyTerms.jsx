import { useState } from "preact/hooks";
import { keyTerms } from "../lib/pretrain.js";

/* Shown before a section's content: what the moving parts are called.
 * Collapsed after first use so it never competes with the material itself. */
export default function KeyTerms({ section, ctx }) {
  const { C, cid } = ctx;
  const terms = keyTerms(section, C.concepts || {});
  const [open, setOpen] = useState(true);
  if (!terms.length) return null;

  return (
    <div class={"pretrain" + (open ? " open" : "")}>
      <button class="pt-head" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span class="pt-eyebrow">Before you start</span>
        <span class="pt-title">{terms.length} terms this section uses</span>
        <span class="pt-toggle">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <a class="pt-run" href={`#/${cid}/primer/${section.id}`}>
          Run through these first →
        </a>
      )}
      {open && (
        <dl class="pt-list">
          {terms.map(t => (
            <div class="pt-row" key={t.term}>
              <dt>
                {t.concept
                  ? <a href={`#/${cid}/c/${t.concept}`}>{t.term}</a>
                  : <a href={`#/${cid}/${t.where}`}>{t.term}</a>}
                {t.kind === "concept" && <span class="pt-tag">core</span>}
              </dt>
              <dd>{t.gloss}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
