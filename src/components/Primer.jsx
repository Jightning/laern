import { useState } from "preact/hooks";
import { keyTerms } from "../lib/pretrain.js";
import Prequestion from "./Prequestion.jsx";

/* Pre-training as a module rather than a panel.
 *
 * Mayer's pre-training principle: knowing what the components are called
 * before reasoning with them frees working memory for the reasoning itself.
 * Presenting each term with its meaning withheld makes that a retrieval
 * attempt rather than a read-through, which is what makes it stick. */
export default function Primer({ section, ctx }) {
  const { C, cid } = ctx;
  const terms = keyTerms(section, C.concepts || {});
  const asks = section.primer || [];
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [ask, setAsk] = useState(0);

  if (!terms.length && !asks.length) {
    return (
      <div class="primer">
        <h1>{section.title}</h1>
        <p class="lede">This section defines no new terms. Go straight in.</p>
        <a class="dbtn" href={`#/${cid}/${section.id}`}>Start section {section.num} →</a>
      </div>
    );
  }

  /* Terms first, then the relations they take part in: the vocabulary has to
     exist before a question about how two of them interact can be attempted. */
  const done = i >= terms.length;
  const t = terms[i];
  const asking = done && ask < asks.length;

  return (
    <div class="primer">
      <span class="eyebrow">Before section {section.num}</span>
      <h1>{section.title}</h1>
      <p class="lede">
        The {terms.length} terms this section works with{asks.length
          ? `, then ${asks.length} question${asks.length === 1 ? "" : "s"} about how they interact`
          : ""}. Try to recall each one before showing it — a failed attempt still
        primes the reading.
      </p>

      <div class="pbar"><i style={`width:${Math.round(
        ((Math.min(i, terms.length) + Math.min(ask, asks.length)) / (terms.length + asks.length)) * 100)}%`} /></div>

      {asking ? (
        <Prequestion key={ask} item={asks[ask]} last={ask + 1 === asks.length}
                     onNext={() => setAsk(ask + 1)} />
      ) : done ? (
        <div class="primer-done">
          <h3>That is the vocabulary.</h3>
          <p>You will meet each of these in context now. They are all linked from the section.</p>
          <div class="primer-nav">
            <a class="dbtn" href={`#/${cid}/${section.id}`}>Start section {section.num} →</a>
            <button class="dbtn ghost" onClick={() => { setI(0); setAsk(0); setShown(false); }}>Run through again</button>
          </div>
        </div>
      ) : (
        <div class="primer-card">
          <div class="primer-meta">
            Term {i + 1} of {terms.length}
            {t.kind === "concept" && <span class="pt-tag">core</span>}
          </div>
          <h2 class="primer-term">{t.term}</h2>
          {shown
            ? <p class="primer-gloss">{t.gloss}</p>
            : <p class="primer-hint">What does this mean here?</p>}
          <div class="primer-nav">
            {!shown
              ? <button class="dbtn" onClick={() => setShown(true)}>Show meaning</button>
              : <button class="dbtn" onClick={() => { setI(i + 1); setShown(false); }}>
                  {i + 1 === terms.length ? "Finish →" : "Next term →"}
                </button>}
            <a class="dbtn ghost" href={`#/${cid}/${section.id}`}>Skip to the section</a>
          </div>
        </div>
      )}
    </div>
  );
}
