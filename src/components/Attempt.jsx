import { useState } from "preact/hooks";
import { readNote, writeNote } from "../lib/notes.js";
import { M } from "../lib/math.js";

/* A problem before the instruction that solves it.
 *
 * The reader cannot answer it from what they have read, and no answer is
 * available here — the subsection teaches the concept next and refers back to
 * what they tried. A deliberate failure that primes the definition is not the
 * exception M10 keeps out of the opening; it is the opposite of one.
 *
 * What they wrote is learner content, so it is stored and styled as a note. */
export default function Attempt({ b, cid, anchor }) {
  const stored = readNote(cid, anchor);
  const [text, setText] = useState(stored);
  const [done, setDone] = useState(!!stored);

  const submit = () => { writeNote(cid, anchor, text); setDone(true); };

  return (
    <div class="attempt" data-attempt={anchor}>
      <span class="blabel">{b.label || "Try it first"}</span>
      <div dangerouslySetInnerHTML={{ __html: M(b.h) }} />
      <textarea class="attempt-in" rows="3" value={text} placeholder="However far you get."
                onInput={e => setText(e.currentTarget.value)} />
      {done
        ? <p class="attempt-done">Kept. The section teaches this next — compare it with what you wrote.</p>
        : <button class="dbtn" data-attempt-go onClick={submit} disabled={!text.trim()}>Submit and read on →</button>}
    </div>
  );
}
