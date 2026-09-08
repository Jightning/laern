/* Where the reader is, as hooks: the route they asked for, the trail they
 * followed to get here, and the subsection actually under their eyes. */
import { useState, useEffect, useCallback, useRef } from "preact/hooks";

/** parse "#/course/rest" */
function parseHash(h) {
  const parts = (h || "#/").slice(1).split("/").filter(Boolean);
  return { cid: parts[0] || null, rest: parts.slice(1).join("/") };
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return { hash, ...parseHash(hash) };
}

/** navigation with a return stack, so following a prerequisite is reversible */
export function useNav(labelFor) {
  const [stack, setStack] = useState([]);
  const here = useRef("#/");
  /* Set only for the two moves that belong to the trail: following a
     cross-reference, and returning along one. */
  const onTrail = useRef(false);
  /* The entry a `back` is currently returning to, for whoever owns scrolling
     to consume. Held rather than acted on here: this file does not scroll. */
  const returning = useRef(null);

  useEffect(() => {
    const on = () => {
      here.current = location.hash || "#/";
      /* Any other hash change is the reader leaving deliberately — the
         sidebar, the course nav, the dependency map, the browser's own back
         button. The stack is the trail followed out of the text, so it ends
         when the reader steps off it; otherwise the pill sits there offering
         to return to a page they left three sections ago. */
      if (!onTrail.current) setStack([]);
      onTrail.current = false;
    };
    on();
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  /**
   * `from` is where the reader was standing: `{ id, into }`, the subsection
   * that held the link and how far down it the viewport had reached. The
   * offset is what makes the return a return. A subsection runs 2000px and a
   * mention can be at the bottom of it, so sending the reader back to the
   * subsection's *heading* dropped them a screen or three above the sentence
   * they left, with nothing marking where that was.
   *
   * It is stored as a distance into the subsection rather than as a raw
   * scrollY so that anything which changes height above the subsection — a
   * tier stub expanded on the way past, a figure that finished loading —
   * moves the anchor and the offset with it.
   */
  const go = useCallback((hash, viaXref, from) => {
    if (viaXref && hash !== here.current) {
      onTrail.current = true;
      /* Where to return to is derived from the ORIGIN, never by chopping the
         target: a two-segment target like #/c/gray-code lost its "c/" to the
         replace and produced #/<course>/c/<subsection>, a route that resolves
         to nothing. Rebuild it from the course id instead. */
      const cid = (here.current.split("/")[1] || hash.split("/")[1] || "");
      const id = from && from.id;
      setStack(s => [...s, {
        hash: id && cid ? `#/${cid}/${id}` : here.current,
        label: labelFor(id),
        into: id ? from.into : null
      }].slice(-12));
    }
    if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = hash;
  }, [labelFor]);

  const back = useCallback(() => {
    setStack(s => {
      const top = s[s.length - 1];
      if (top) {
        onTrail.current = true;
        returning.current = top;
        /* The route may already be the one being returned to — a mention of a
           sibling subsection resolves to the same page. Nothing would fire,
           and the scroll would not be restored. */
        if (location.hash === top.hash) dispatchEvent(new HashChangeEvent("hashchange"));
        else location.hash = top.hash;
      }
      return s.slice(0, -1);
    });
  }, []);

  /** The entry a `back` is landing on, once. Null for every other navigation,
   *  so an ordinary hash change still scrolls to the top of its subsection. */
  const takeReturn = useCallback(() => {
    const r = returning.current;
    returning.current = null;
    return r;
  }, []);

  const clear = useCallback(() => setStack([]), []);
  return { stack, go, back, clear, takeReturn };
}

/* ---------------------------------------------------------------------------
 * Which subsection the reader is looking at.
 *
 * The rail used to mark the one in the route, which is the one they *clicked*.
 * Those two agree for about as long as it takes to scroll one screen: a
 * subsection runs 2000px and more, a section holds five of them, and the route
 * does not change while the reader reads. So the rail spent almost all of a
 * session pointing at wherever the reader had last jumped from, which is the
 * one place they already knew they were not.
 *
 * The reading line is a quarter of the way down the viewport, never above the
 * toolbar. A line pinned to the toolbar's own bottom edge is the obvious
 * choice and it does not survive contact: a subsection the router has just
 * scrolled to settles 10px below its scroll-margin on a desktop and 53px below
 * it on a phone, because maths and figures above it finish laying out after
 * the scroll. Anything tight enough to call that "not arrived yet" is tight
 * enough to be wrong. A quarter of a screen is far larger than any of that
 * drift and far smaller than a subsection, which runs 2000px and up, so it
 * cannot pick the wrong one — it only decides how far into a heading the
 * handover happens.
 * ------------------------------------------------------------------------ */

/* Where the reader's eye is, as a fraction of the viewport. */
const LINE = 0.25;
const CLEAR = 8;         /* and never under the toolbar */

export function useReading(ids, fallback) {
  const key = ids.join("|");
  /* Start on the route's own subsection so the first paint after a jump marks
     the target rather than blanking until the first scroll event. */
  const [here, setHere] = useState(fallback);
  useEffect(() => { setHere(fallback); }, [fallback, key]);

  useEffect(() => {
    if (!ids.length) return;
    let frame = 0;

    const pick = () => {
      frame = 0;
      const bar = document.querySelector(".topbar");
      const under = (bar ? bar.getBoundingClientRect().bottom : 0) + CLEAR;
      const line = Math.max(under, innerHeight * LINE);

      let cur = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        /* Document order, so the first one still below the line ends it and
           whatever was last assigned is the one being read. */
        if (el.getBoundingClientRect().top <= line) cur = id;
        else break;
      }

      /* The end of the document is the one place the rule above can be wrong:
         a short final subsection can sit fully on screen with its top still
         under the line, and no amount of scrolling will move it up. */
      const last = ids[ids.length - 1];
      if (cur !== last && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
        const el = document.getElementById(last);
        if (el && el.getBoundingClientRect().top < innerHeight) cur = last;
      }

      setHere(cur);
    };

    const schedule = () => { if (!frame) frame = requestAnimationFrame(pick); };
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    /* Expanding a tier stub or revealing an answer moves everything below it
       without the page scrolling, so height has to be watched too. */
    const box = document.getElementById("content");
    const ro = box && "ResizeObserver" in window ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(box);

    pick();
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      if (ro) ro.disconnect();
    };
  }, [key]);

  return here;
}
