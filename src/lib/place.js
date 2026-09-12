/* ============================================================================
 * src/lib/place.js — where the reader is, kept across a reflow and a relaunch
 *
 * Two failures with one cause: a scroll offset is not a reading position.
 *
 *   - **Coming back to the app.** iOS discards a home-screen web app's view
 *     when the reader switches away, and relaunches it at the manifest's
 *     `start_url` — which carries no hash. A session three screens into §4
 *     came back to the library with nothing to say where it had been. The
 *     browser's own scroll restoration cannot help: the route is gone, so
 *     there is no document to restore a position within.
 *   - **Changing the width.** Rotating a phone, dragging a window narrower,
 *     tucking the sidebar or changing the content zoom re-wraps every line
 *     above the reader. The scroll offset is untouched and therefore points
 *     somewhere else — by a screen or more in a subsection that runs 2000px.
 *
 * Both are answered by storing an anchor rather than a number: *which*
 * subsection, and how far into it. That pair is invariant under a reflow that
 * changes every height above it, and it is small enough to write on every
 * pause in scrolling.
 *
 * The anchor is the subsection because a subsection is the finest thing on the
 * page with a stable id — the same granularity the return pill already lands
 * on, for the same reason. `land` then re-applies as the layout finishes
 * arriving, which is what turns "the right subsection" into the right line.
 * ==========================================================================*/
import { getItem, setItem, flush } from "./store.js";

const KEY = "place:v1";
/* Older than this and resuming is a surprise rather than a convenience. Well
   past the seven days WebKit gives the storage anyway. */
const MAX_AGE = 30 * 864e5;
const IDLE_MS = 1200;   /* a pause in scrolling long enough to be a position */
const TOP = 4;          /* a subsection this close to the top counts as at it */

/* ------------------------------------------------------------- landing --*/

/*
 * Put `el` back under the reader at the same offset, and keep it there while
 * the page finishes arriving.
 *
 * One scrollTo is not enough. A section is re-rendered from scratch and its
 * maths, figures and images finish laying out over the next few frames;
 * everything above the anchor grows, and the position computed on frame one is
 * 250-290px short by the time it stops. So the anchor's own position in the
 * document is watched, and the scroll is re-applied only when that number
 * actually moves — a settled anchor means the layout is done and the reader is
 * left alone.
 *
 * It also stops the moment the reader scrolls for themselves. Correcting a
 * page somebody has taken hold of is worse than landing a little short.
 *
 * Watching costs nothing; only moving the page does, and the rule below moves
 * it solely when the anchor has actually shifted. So the window is generous:
 * the maths course renders its KaTeX in a burst well past half a second, and a
 * short budget stopped watching 50px before the layout was finished.
 */
const LAND_QUIET = 30;    /* frames of a still anchor that mean layout is done */
const LAND_MAX = 90;      /* and a hard stop, in case it never is */

let landing = null;       /* only one landing at a time — see below */

/**
 * @param el   the anchor element, or null for an absolute document offset
 * @param into how far past the anchor's top the viewport should sit
 */
export function land(el, into) {
  /* A window drag fires `resize` on every frame, and a landing started by the
     previous one is still correcting toward a width that no longer exists.
     Two of them fight and the page shudders, so a new landing supersedes. */
  if (landing) landing();

  let anchor = null, still = 0, frames = 0, live = true;
  const stop = () => { live = false; };
  /* Asking whether scrollY moved on its own cannot tell a reader apart from
     the browser's own scroll anchoring, which fires under exactly these
     conditions. Their input can. */
  const watch = ["wheel", "touchstart", "keydown", "mousedown"];
  const done = () => {
    watch.forEach(k => removeEventListener(k, stop));
    if (landing === stop) landing = null;
  };
  watch.forEach(k => addEventListener(k, stop, { passive: true }));
  landing = stop;

  const step = () => {
    if (!live) return done();
    const top = el ? Math.round(el.getBoundingClientRect().top + scrollY) : 0;
    if (top !== anchor) {
      /* "instant", not "auto": `auto` defers to CSS, and html carries
         scroll-behavior:smooth, so what should have been a correction became a
         1.5 second animation that the next frame then measured mid-flight. */
      scrollTo({ top: top + into, behavior: "instant" });
      anchor = top;
      still = 0;
    } else still++;
    /* Stop as soon as the anchor has held for a few frames. Running the full
       budget every time leaves the page moving under the reader for half a
       second after it has already arrived, which is long enough for a click to
       land on the wrong line. */
    if (still < LAND_QUIET && ++frames < LAND_MAX) requestAnimationFrame(step);
    else done();
  };
  step();
  return stop;
}

/* ------------------------------------------------------------ the anchor --*/

/** The subsection the reader is in: the last one whose top has passed the fold. */
function subAt() {
  const subs = document.querySelectorAll(".sub[id]");
  let hit = null;
  for (const el of subs) {
    if (el.getBoundingClientRect().top <= TOP) hit = el;
    else break;
  }
  /* Above the first one — still a real position, and a negative offset says so. */
  return hit || subs[0] || null;
}

/** `{hash, id, into}` for wherever the reader is standing now. */
export function capture() {
  const hash = location.hash || "#/";
  const el = subAt();
  return el
    ? { hash, id: el.id, into: Math.round(-el.getBoundingClientRect().top),
        /* How far through the subsection, as well as how far into it. The
           offset is what `land` needs and the fraction is what anything
           *describing* the position needs — the Desk says "about 6 min left",
           and it has no rendered element to measure when it says so. Recorded
           here because this is the one moment both numbers are in hand. */
        frac: el.offsetHeight
          ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / el.offsetHeight))
          : 0,
        ts: Date.now() }
    /* No section on screen: the library and the hubs are a screen of chrome,
       not a document that reflows, so the raw offset is the honest answer. */
    : { hash, id: null, into: Math.round(scrollY), ts: Date.now() };
}

/**
 * The stored position, without adopting it.
 *
 * `restore` consumes the record to answer a relaunch; this only reads it, so
 * the Desk can say where reading stopped without that reading counting as a
 * navigation. Returns null when there is nothing, or nothing recent enough.
 */
export function peek() {
  let p = null;
  try { p = JSON.parse(getItem(KEY)); } catch { return null; }
  if (!p || !p.hash || !p.ts || Date.now() - p.ts > MAX_AGE) return null;
  return p;
}

/** Put the reader back where `p` says, once the layout has settled. */
function apply(p) {
  const el = p.id ? document.getElementById(p.id) : null;
  if (el) {
    /* Capped at the subsection's height so a layout that shrank while the app
       was away cannot land them past its end and inside the next one. Not
       floored at zero: a negative offset is a real reading position, the one
       just above a subsection that begins below the top of the screen. */
    land(el, Math.min(p.into, el.offsetHeight));
    return true;
  }
  if (!p.id && p.into > 0) { land(null, p.into); return true; }
  return false;
}

/* ------------------------------------------------------------- restoring --*/

let pending = null;

/**
 * Adopt the stored route before the first render, so the router sees it.
 * Call once, from main.jsx, between opening storage and rendering.
 *
 * `known(cid)` says whether a course id is still on the shelf. Resuming into
 * one the reader has since removed would answer a relaunch with a load error,
 * and it is also what keeps the two reserved routes out of this: `review` and
 * `sync` are not courses, and neither is somewhere to be put back into.
 */
export function restore(known) {
  let p = null;
  try { p = JSON.parse(getItem(KEY)); } catch { p = null; }
  if (!p || !p.hash || p.hash === "#/" || !p.ts || Date.now() - p.ts > MAX_AGE) return;
  if (known && !known(p.hash.split("/")[1] || "")) return;
  /* Only when nothing was asked for. A reader who typed a URL or followed a
     link asked for that route; a reader relaunching the installed app asked
     for nothing, because the platform threw the route away with the view. */
  const at = location.hash;
  if (at && at !== "#/" && at !== "#") return;
  pending = p;
  /* replaceState rather than assigning location.hash: this runs before the
     first render, so there is no hashchange to hear and no history entry that
     would make Back mean "undo the restore". */
  history.replaceState(null, "", p.hash);
  /* The reader leaving the restored route is the end of it. */
  addEventListener("hashchange", () => { pending = null; }, { once: true });
}

/**
 * Put the reader back where the relaunch left them, if `hash` is that route.
 * True once it has actually been applied, and only then is it consumed: on a
 * split build the first pass runs before the course has arrived, so the anchor
 * does not exist yet and the attempt has to survive to be made again.
 */
export function resume(hash) {
  if (!pending || pending.hash !== hash || !apply(pending)) return false;
  pending = null;
  return true;
}

/* -------------------------------------------------------------- tracking --*/

/* Null until the first sample. A repin before then would land on an anchor
   that was never taken and scroll the page to the top — and the two callers
   that are not resize events, the zoom and the sidebar tuck, both fire once on
   mount before anything has been read. */
let at = null;

/** Re-pin the last sampled anchor. For a reflow no resize event announces. */
export function repin() {
  if (!at) return;
  if (at.el) { if (at.el.isConnected) land(at.el, -at.top); }
  else land(null, -at.top);
}

/**
 * Watch the reader's position: remember it on every pause, write it when the
 * app goes away, and hold it across a change of width. Returns a teardown.
 */
export function track() {
  let raf = 0, idle = 0, w = innerWidth;

  /* A resize is announced after the layout has already moved, so the anchor a
     re-pin restores has to have been taken *before* it. That is why the sample
     runs on every scroll frame rather than being read at the moment it is
     wanted: by then the reflow has happened and the answer is gone. */
  const sample = () => {
    raf = 0;
    const el = subAt();
    at = el ? { el, top: el.getBoundingClientRect().top } : { el: null, top: -scrollY };
  };

  const remember = () => { setItem(KEY, JSON.stringify(capture())); };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(sample);
    clearTimeout(idle);
    idle = setTimeout(remember, IDLE_MS);
  };

  const onResize = () => {
    /* Height-only changes are the phone's own address bar sliding in and out,
       and the on-screen keyboard opening. The browser handles those itself and
       re-pinning would fight it; the reflow that actually moves the reader is
       a change of width. */
    if (innerWidth === w) return;
    w = innerWidth;
    repin();
  };

  /* `visibilitychange` rather than `pagehide` alone: backgrounding an iOS home
     screen app fires the first reliably and the second not always, and it is
     the case this exists for. Both are listened to, and the write is forced to
     disk here rather than left on the store's debounce, since the next thing
     that happens may be the view being discarded. */
  const onHide = () => {
    if (document.visibilityState === "hidden") { remember(); flush(); }
  };
  const onPageHide = () => { remember(); flush(); };

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  addEventListener("visibilitychange", onHide);
  addEventListener("pagehide", onPageHide);
  sample();

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(idle);
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onResize);
    removeEventListener("visibilitychange", onHide);
    removeEventListener("pagehide", onPageHide);
  };
}
