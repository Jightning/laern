import { useEffect, useRef } from "preact/hooks";

/* One dialog shape, for the two things the library asks: install a course, and
 * confirm removing one.
 *
 * `confirm()` was doing the second job. It cannot say what removal keeps, it
 * cannot be reached by the suite, and on a phone it arrives as a system sheet
 * detached from the card it is about — so the one destructive action in the app
 * was the one place that left the app's own language.
 *
 * It is a real `<dialog>` opened with `showModal()`, not a positioned div, and
 * that is a correctness decision rather than a stylistic one. A modal dialog
 * renders in the browser's top layer, so it is not laid out inside any
 * ancestor's containing block — and the reading column carries `zoom` (T28),
 * which *is* one for fixed-position descendants. A hand-rolled overlay inside
 * `.wrap` at 125% zoom measured 133px above the viewport and 1706px tall in an
 * 860px window, with its buttons off-screen entirely.
 *
 * The rest follows from using the platform: focus is trapped, the page behind
 * is inert, Escape closes, and the backdrop is `::backdrop`. `close` fires for
 * every one of those paths, which is where the state is cleared, so there is no
 * way to dismiss it that leaves the component thinking it is still open.
 */
export default function Modal({ title, onClose, children, danger }) {
  const box = useRef(null);

  useEffect(() => {
    const d = box.current;
    if (!d.open) d.showModal();
    /* Unmounting for any other reason (the course it names is gone) closes the
       element too, or it would stay in the top layer over a dead card. */
    return () => { if (d.open) d.close(); };
  }, []);

  /* The backdrop is part of the dialog's own box, so a click on it targets the
     dialog itself; anything inside targets a child. */
  const onBackdrop = e => { if (e.target === box.current) onClose(); };

  return (
    <dialog class={"modal" + (danger ? " danger" : "")} ref={box}
            role="dialog" aria-label={title}
            onClose={onClose} onCancel={onClose} onClick={onBackdrop}>
      <div class="modal-in">
        <div class="modal-head">
          <h2>{title}</h2>
          <button class="modal-x" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div class="modal-body">{children}</div>
      </div>
    </dialog>
  );
}
