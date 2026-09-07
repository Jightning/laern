import { useState, useRef, useEffect } from "preact/hooks";
import { readNote, writeNote } from "../lib/notes.js";

/* A note the learner writes, living in the margin channel beside whatever
 * prompted it. Collapsed to a marker by default once written: an expanded note
 * competes with the material for attention, which coherence forbids, so it
 * shows on demand rather than permanently. */
export default function Notes({ cid, anchor, label = "Your note" }) {
  const [text, setText] = useState(() => readNote(cid, anchor));
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const area = useRef(null);
  const timer = useRef(null);

  useEffect(() => { if (editing) area.current?.focus(); }, [editing]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { setText(readNote(cid, anchor)); setEditing(false); setOpen(false); },
            [cid, anchor]);

  const onInput = e => {
    const v = e.currentTarget.value;
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => writeNote(cid, anchor, v), 400);
  };
  const close = () => { writeNote(cid, anchor, text); setEditing(false); };

  /* nothing written yet: a quiet affordance that surfaces on hover or focus */
  if (!editing && !text) {
    return (
      <div class="notes empty">
        <button class="note-add" onClick={() => setEditing(true)}
                aria-label="Add a note here">+ note</button>
      </div>
    );
  }

  if (!editing && !open) {
    return (
      <div class="notes" data-nosnippet>
        <button class="note-marker" onClick={() => setOpen(true)}
                title="Show your note" aria-expanded="false">
          <span class="note-dot" />{label}
        </button>
      </div>
    );
  }

  return (
    <div class="notes open" data-nosnippet>
      <div class="note-head">
        <span class="note-eyebrow">{label}</span>
        {editing
          ? <button class="note-edit" onClick={close}>done</button>
          : <>
              <button class="note-edit" onClick={() => setEditing(true)}>edit</button>
              <button class="note-edit" onClick={() => setOpen(false)}>hide</button>
            </>}
      </div>
      {editing
        ? <textarea ref={area} class="note-area" value={text} onInput={onInput}
                    onBlur={close} rows={Math.max(3, text.split("\n").length + 1)}
                    placeholder="In your own words. What did the lecture add?" />
        : <p class="note-body">{text}</p>}
    </div>
  );
}
