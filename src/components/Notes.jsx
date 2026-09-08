import { useState, useRef, useEffect } from "preact/hooks";
import { readNote, writeNote, isFolded, setFolded } from "../lib/notes.js";
import { md } from "../lib/md.js";

/* A note the learner writes, in two pieces that share one state.
 *
 * WHERE IT LIVES. The written note is a card in the margin channel, stacked
 * under the reference cards it sits beside — same `.mnote` component, its own
 * accent. Under it rather than over it because a reference card is required to
 * be level with the mention it annotates [T12] and a note is not, so the note
 * is what yields when the two want the same row. Below the margin breakpoint
 * the channel wraps under the block and the note comes with it, which is why
 * this needs no second layout for a phone.
 *
 * WHERE IT STARTS. A block with no note shows nothing in the margin. Putting
 * an empty slot on every block is what made the old design 32 repeated widgets
 * on one phone screen. Instead the block's own bottom edge carries a grip at
 * the opacity of page texture, and pulling it down opens the note. A press
 * opens it too, because a grip is also a button and a keyboard has no drag.
 *
 * Nothing here touches the context menu. Right-click, long-press, selection,
 * Copy and Look Up stay the platform's.
 */

/* How far down commits. Short enough that the gesture never feels like work,
   long enough that a twitch on the way to a scroll does not open a textarea. */
const OPEN_AT = 26;
const MAX_PULL = 110;
const SLOP = 3;          /* movement under this is a press, not a drag */
const NUDGE = 18;        /* how far the grip itself follows the finger */

/**
 * One note's state. Called by the reading row rather than by either piece,
 * because the grip and the card are in different zones of the row and are the
 * same note. `anchor` may be null for a row that carries no note at all.
 */
export function useNote(cid, anchor) {
  const [text, setText] = useState(() => (anchor ? readNote(cid, anchor) : ""));
  const [editing, setEditing] = useState(false);
  const [fold, setFold] = useState(() => (anchor ? isFolded(cid, anchor) : false));
  const [pull, setPull] = useState(0);
  const save = useRef(null);

  useEffect(() => () => clearTimeout(save.current), []);
  /* a different block is being annotated: start clean rather than carrying the
     previous one's editing state across */
  useEffect(() => {
    setText(anchor ? readNote(cid, anchor) : "");
    setFold(anchor ? isFolded(cid, anchor) : false);
    setEditing(false); setPull(0);
  }, [cid, anchor]);

  return {
    cid, anchor, text, editing, fold, pull, setPull,
    /* Editing a folded note unfolds it: otherwise the reader presses edit and
       nothing appears to happen. */
    edit: () => { setFold(false); setFolded(cid, anchor, false); setEditing(true); },
    input: v => {
      setText(v);
      clearTimeout(save.current);
      save.current = setTimeout(() => writeNote(cid, anchor, v), 400);
    },
    done: () => { writeNote(cid, anchor, text); setEditing(false); },
    toggle: () => setFold(f => { setFolded(cid, anchor, !f); return !f; })
  };
}

/** The grip at the foot of a block that has no note yet. */
export function NoteGrip({ n }) {
  const drag = useRef(null);

  /* Pointer events rather than mouse plus touch, so one path covers a mouse, a
     finger and a pen. The capture matters: without it a fast drag leaves the
     72px grip and the gesture dies mid-pull. */
  const onDown = e => {
    if (e.button != null && e.button > 0) return;      /* left button only */
    drag.current = { y: e.clientY, id: e.pointerId, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = e => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > SLOP) d.moved = true;
    n.setPull(Math.max(0, Math.min(MAX_PULL, dy)));
  };
  const onUp = e => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(d.id); } catch {}
    /* A press opens. A pull opens once past the threshold. A pull that stops
       short snaps back, which is what makes the threshold discoverable rather
       than a trap. */
    if (!d.moved || e.clientY - d.y >= OPEN_AT) n.edit();
    n.setPull(0);
  };
  const onCancel = () => { drag.current = null; n.setPull(0); };
  /* The browser also fires click after a pointer sequence, which would open a
     snapped-back pull a second time. `detail === 0` is a click with no pointer
     behind it — the keyboard case, and the only one not covered above. */
  const onClick = e => { if (e.detail === 0) n.edit(); };

  if (!n.anchor || n.text || n.editing) return null;
  return (
    <div class="notes">
      <button class="note-pull" type="button"
              style={n.pull ? `transform:translate(-50%,${Math.min(n.pull, NUDGE)}px)` : null}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerCancel={onCancel} onClick={onClick}
              aria-expanded="false" aria-label="Add a note here">
        <span class="note-grip" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The note itself, as a card in the margin channel. */
export function NoteCard({ n, label = "Your note" }) {
  const area = useRef(null);
  useEffect(() => { if (n.editing) area.current?.focus(); }, [n.editing]);

  if (!n.anchor || (!n.text && !n.editing && !n.pull)) return null;

  /* Mid-pull the card is a clipped window whose height follows the finger, so
     the reader sees what they are opening before committing to it — and what
     they are opening is the editor, so that is what the window shows. */
  const peek = !n.editing && !n.text && n.pull;
  const asEditor = n.editing || peek;

  return (
    <div class={"mnote is-n" + (n.fold ? " is-shut" : "")} data-nosnippet
         style={peek ? `height:${n.pull}px;overflow:hidden` : null}>
      <button class="mn-k note-fold" type="button" onClick={n.toggle}
              aria-expanded={n.fold ? "false" : "true"}>
        <span class="note-caret" aria-hidden="true" />{label}
      </button>
      {!n.fold && (asEditor ? (
        <>
          <textarea ref={area} class="note-area" value={n.text}
                    onInput={e => n.input(e.currentTarget.value)} onBlur={n.done}
                    rows={Math.max(3, n.text.split("\n").length + 1)}
                    placeholder="In your own words. Markdown works." />
          <button class="mn-go note-edit" type="button" onClick={n.done}>done</button>
        </>
      ) : (
        <>
          {/* The reader's own text, through lib/md.js, which escapes before it
              formats — see the safety note there. */}
          <div class="note-body" dangerouslySetInnerHTML={{ __html: md(n.text) }} />
          <button class="mn-go note-edit" type="button" onClick={n.edit}>edit</button>
        </>
      ))}
    </div>
  );
}
