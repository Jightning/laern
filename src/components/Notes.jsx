import { useState, useRef, useEffect } from "preact/hooks";
import { readNotes, writeNotes, isFolded, setFolded } from "../lib/notes.js";
import { md } from "../lib/md.js";

/* The learner's notes on one block, in two pieces that share one state.
 *
 * WHERE THEY LIVE. Written notes are a card in the margin channel, stacked
 * under the reference cards beside them — same `.mnote` component, its own
 * accent. Under rather than over because a reference card is required to be
 * level with the mention it annotates [T12] and a note is not, so the note is
 * what yields when the two want the same row. Below the margin breakpoint the
 * channel wraps under the block and the notes come with it, which is why this
 * needs no second layout for a phone.
 *
 * WHERE THEY START. The block's own bottom edge carries a grip at the opacity
 * of page texture; pulling it down opens a new note. A press opens one too,
 * because a grip is also a button and a keyboard has no drag. The grip stays
 * put once a block has notes, since adding a second one is the same act as
 * adding the first.
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
 * One block's notes. Called by the reading row rather than by either piece,
 * because the grip and the card are different zones of the same row and the
 * same notes. `anchor` may be null for a row that carries none.
 */
export function useNotes(cid, anchor) {
  const [list, setList] = useState(() => (anchor ? readNotes(cid, anchor) : []));
  const [editing, setEditing] = useState(-1);       /* index, or -1 */
  const [fold, setFold] = useState(() => (anchor ? isFolded(cid, anchor) : false));
  const [pull, setPull] = useState(0);
  const save = useRef(null);

  /* The list lives in a ref as well as in state, and every mutator reads the
     ref. Two handlers can fire against the same render: closing the textarea
     blurs it, and blur lands *before* the pointerdown on the delete button
     beside it. Both then computed from the same captured array, the later
     state update overwrote the earlier one, and the deleted note came back. */
  const held = useRef(list);
  const apply = next => { held.current = next; setList(next); };

  useEffect(() => () => clearTimeout(save.current), []);
  /* a different block is being annotated: start clean rather than carrying the
     previous one's editing state across */
  useEffect(() => {
    apply(anchor ? readNotes(cid, anchor) : []);
    setFold(anchor ? isFolded(cid, anchor) : false);
    setEditing(-1); setPull(0);
  }, [cid, anchor]);

  const later = next => {
    clearTimeout(save.current);
    save.current = setTimeout(() => writeNotes(cid, anchor, next), 400);
  };
  const now = next => { clearTimeout(save.current); writeNotes(cid, anchor, next); };
  const open = () => { setFold(false); setFolded(cid, anchor, false); };

  return {
    cid, anchor, list, editing, fold, pull, setPull,
    /* A new note always goes at the end and opens straight into editing: the
       gesture that asked for it was already the decision to write one. */
    add: () => { open(); setEditing(held.current.length); apply([...held.current, ""]); },
    edit: i => { open(); setEditing(i); },
    input: (i, v) => {
      const next = held.current.map((t, k) => (k === i ? v : t));
      apply(next); later(next);
    },
    /* Written through, not debounced: a delete is the one edit the reader
       cannot repeat by typing it again. */
    drop: i => {
      const next = held.current.filter((_, k) => k !== i);
      apply(next); setEditing(-1); now(next);
    },
    /* Also written through, because the reader may be navigating away in the
       same gesture. An empty note is dropped here as well as on the way to
       storage, or one opened and abandoned would sit in the card as a blank
       row until the next reload. */
    done: () => {
      const keep = held.current.filter(t => t && t.trim());
      setEditing(-1); apply(keep); now(keep);
    },
    toggle: () => setFold(f => { setFolded(cid, anchor, !f); return !f; })
  };
}

/** The grip at the foot of a block: where a note is started. */
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
    if (!d.moved || e.clientY - d.y >= OPEN_AT) n.add();
    n.setPull(0);
  };
  const onCancel = () => { drag.current = null; n.setPull(0); };
  /* The browser also fires click after a pointer sequence, which would open a
     snapped-back pull a second time. `detail === 0` is a click with no pointer
     behind it — the keyboard case, and the only one not covered above. */
  const onClick = e => { if (e.detail === 0) n.add(); };

  if (!n.anchor) return null;
  return (
    <div class="notes">
      <button class="note-pull" type="button"
              style={n.pull ? `transform:translate(-50%,${Math.min(n.pull, NUDGE)}px)` : null}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerCancel={onCancel} onClick={onClick}
              aria-label={n.list.length ? "Add another note here" : "Add a note here"}>
        <span class={"note-grip" + (n.list.length ? " has" : "")} aria-hidden="true" />
      </button>
    </div>
  );
}

/** One note, read or being written. */
function Note({ n, i, text }) {
  const area = useRef(null);
  const mine = n.editing === i;
  useEffect(() => { if (mine) area.current?.focus(); }, [mine]);

  if (!mine) return (
    <div class="note-one">
      {/* The reader's own text, through lib/md.js, which escapes before it
          formats — see the safety note there. */}
      <div class="note-body" dangerouslySetInnerHTML={{ __html: md(text) }} />
      <button class="mn-go note-edit" type="button" onClick={() => n.edit(i)}>edit</button>
    </div>
  );

  return (
    <div class="note-one">
      <textarea ref={area} class="note-area" value={text}
                onInput={e => n.input(i, e.currentTarget.value)} onBlur={n.done}
                rows={Math.max(3, text.split("\n").length + 1)}
                placeholder="In your own words. Markdown works." />
      <div class="note-ops">
        <button class="mn-go note-edit" type="button" onClick={n.done}>done</button>
        {/* On pointerdown, not click. The textarea closes its own editor on
            blur, and blur beats click — so by the time a click arrived this
            button had already been unmounted and the note was never deleted.
            preventDefault keeps the focus where it is; the click handler is
            the keyboard path, where there is no pointer and detail is 0. */}
        <button class="note-edit note-drop" type="button"
                onPointerDown={e => { e.preventDefault(); n.drop(i); }}
                onClick={e => { if (e.detail === 0) n.drop(i); }}>delete</button>
      </div>
    </div>
  );
}

/** The notes themselves, as one card in the margin channel. */
export function NoteCard({ n, label = "Note" }) {
  /* Nothing at all until there is something to show. The pull's own feedback
     is the grip following the finger, which is where the finger is looking;
     growing an empty card in the margin, a column away on a desktop, showed
     the reader a box with nothing in it. */
  if (!n.anchor || !n.list.length) return null;

  return (
    <div class={"mnote is-n" + (n.fold ? " is-shut" : "")} data-nosnippet>
      <button class="mn-k note-fold" type="button" onClick={n.toggle}
              aria-expanded={n.fold ? "false" : "true"}>
        <span class="note-caret" aria-hidden="true" />
        {label}{n.list.length > 1 ? ` · ${n.list.length}` : ""}
      </button>
      {!n.fold && n.list.map((t, i) => <Note key={i} n={n} i={i} text={t} />)}
    </div>
  );
}
