import { useState, useEffect, useMemo, useCallback, useRef } from "preact/hooks";
import { INDEX, ORDER, get as getCourse, peek, refresh as refreshLibrary } from "./lib/library.js";

import { buildIndex, labelOf } from "./lib/index.js";
import { stateFor } from "./lib/state.js";
import { indexDrills } from "./lib/drills.js";
import { dueCount } from "./lib/queue.js";
import { laneFor, setLane, LANES } from "./lib/tiers.js";
import { reset as resetRetention } from "./lib/retention.js";
import { rebuild } from "./lib/replay.js";
import { useHashRoute, useNav, useReading } from "./lib/nav.js";
import { setBlockConfig } from "./blocks/index.js";
import { applyHue } from "./lib/theme.js";
import { readZoom, applyZoom, zoomFromKey } from "./lib/zoom.js";
import { getItem, setItem } from "./lib/store.js";

import Sidebar from "./components/Sidebar.jsx";
import { IconTuck } from "./components/Icon.jsx";
import Topbar from "./components/Topbar.jsx";
import ReturnPill from "./components/ReturnPill.jsx";
import Library from "./components/Library.jsx";
import CourseHome from "./components/CourseHome.jsx";
import Section from "./components/Section.jsx";
import { ConceptHub, ConceptDetail } from "./components/Concepts.jsx";
import Practice from "./components/Practice.jsx";
import Primer from "./components/Primer.jsx";
import DepMap from "./components/DepMap.jsx";
import SearchOverlay from "./components/SearchOverlay.jsx";
import PageContext from "./components/PageContext.jsx";
import Review from "./components/Review.jsx";
import Calibration from "./components/Calibration.jsx";
import CloudPanel from "./components/CloudPanel.jsx";

/* The width above which the sidebar is a column rather than a drawer. Mirrors
   the 64em breakpoint in 99-responsive.css. */
const WIDE = "(min-width: 64.01em)";

/**
 * Put `el` back under the reader at the same offset they left it, and keep it
 * there while the page finishes arriving.
 *
 * One scrollTo is not enough. The section is re-rendered from scratch on the
 * way back and its maths, figures and images finish laying out over the next
 * few frames; everything above the anchor grows, and the position computed on
 * frame one is 250-290px short by the time it stops. So the anchor's own
 * position in the document is watched, and the scroll is re-applied only when
 * that number actually moves — a settled anchor means the layout is done and
 * the reader is left alone.
 *
 * It also stops the moment the reader scrolls for themselves. Correcting a
 * page somebody has taken hold of is worse than landing a little short.
 */
/* Watching costs nothing; only moving the page does, and the rule below moves
   it solely when the anchor has actually shifted. So the window is generous:
   the maths course renders its KaTeX in a burst well past half a second, and a
   short budget stopped watching 50px before the layout was finished. Any input
   from the reader ends it immediately, whenever it comes. */
const LAND_QUIET = 30;    /* frames of a still anchor that mean the layout is done */
const LAND_MAX = 90;      /* and a hard stop, in case it never is */

function land(el, into) {
  let anchor = null, still = 0, frames = 0, live = true;
  const stop = () => { live = false; };
  /* Asking whether scrollY moved on its own cannot tell a reader apart from
     the browser's own scroll anchoring, which fires under exactly these
     conditions. Their input can. */
  const watch = ["wheel", "touchstart", "keydown", "mousedown"];
  const done = () => watch.forEach(k => removeEventListener(k, stop));
  watch.forEach(k => addEventListener(k, stop, { passive: true }));

  const step = () => {
    if (!live) return done();
    const top = Math.round(el.getBoundingClientRect().top + scrollY);
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
}

export default function App() {
  const { hash, cid, rest } = useHashRoute();
  const inReview = cid === "review";
  /* `#/sync` is deliberately unlinked. The site is public, and a control for
     the owner's backup is not something a reader should be shown, told about,
     or able to spend quota with — so the way in is a route you have to know.
     Holding the secret is the only identity the system has. */
  const inSetup = cid === "sync";
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tuckPref, setTuckPref] = useState(() => {
    return getItem("tuckSidebar") === "1";
  });
  const toggleTuck = () => setTuckPref(v => {
    setItem("tuckSidebar", v ? "0" : "1");
    return !v;
  });
  /* Tucking removes the sidebar from the document, and below the drawer
     breakpoint the sidebar *is* the navigation: the preference would leave a
     Menu button that opens nothing and no way back, since the untuck tab is a
     desktop control too. The preference is kept and simply does not apply.
     64em is the breakpoint in 99-responsive.css. */
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = matchMedia(WIDE);
    const sync = () => setWide(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const tucked = tuckPref && wide;
  const [, forceRender] = useState(0);
  const [zoom, setZoom] = useState(readZoom);
  const [lane, setLaneFor] = useState("apply");
  const contentRef = useRef(null);

  useEffect(() => { applyZoom(zoom); }, [zoom]);

  /* A split build fetches the course; a single build already has it, and peek
     returns it synchronously so that path never flashes a loading state. */
  const [course, setCourse] = useState(() => (cid ? peek(cid) : null));
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    if (!cid) { setCourse(null); return; }
    const here = peek(cid);
    if (here) { rebuild(cid, here); setCourse(here); setLoadError(null); return; }
    let live = true;
    setCourse(null); setLoadError(null);
    getCourse(cid).then(
      C => { if (!live) return; if (C) rebuild(cid, C); setCourse(C); },
      e => { if (live) setLoadError(e); }
    );
    return () => { live = false; };
  }, [cid]);

  /* The cross-course due badge, from the index rather than from the courses.
     queue.dueConcepts reads only `drills.keys` and the retention target, so
     counting what is due never needs a course body — which is what lets the
     badge be correct on first paint in a split build. */
  const books = useMemo(() => ORDER
    .map(c => ({ cid: c, C: INDEX[c], drills: { keys: (INDEX[c] || {}).drillKeys || [] } }))
    .filter(b => b.drills.keys.length), []);
  const due = books.length ? dueCount(books) : null;

  /* Rows arriving from another device rewrite this course's schedule, so the
     open course is refolded rather than merely repainted — a repaint would show
     the old schedule until the reader happened to navigate away and back. */
  useEffect(() => {
    const onSync = e => {
      if (cid && course && e.detail.courses.includes(cid)) rebuild(cid, course);
      if ((e.detail.installed || []).length || (e.detail.removed || []).length) refreshLibrary();
      forceRender(n => n + 1);
    };
    addEventListener("learn:synced", onSync);
    return () => removeEventListener("learn:synced", onSync);
  }, [cid, course]);

  /* The library used to be skipped when only one course existed, on the grounds
     that a picker with one entry is noise. It is not skippable any more: it is
     also where a reader installs their own courses, and the public deployment
     ships exactly one. Skipping it made the install control unreachable. */

  useEffect(() => { if (cid) setLaneFor(laneFor(cid)); }, [cid]);
  const onLane = l => { setLane(cid, l); setLaneFor(l); };

  const idx = useMemo(() => (course ? buildIndex(course) : null), [course]);
  const drills = useMemo(() => indexDrills(course || {}), [course]);
  const state = useMemo(() => (course ? stateFor(cid, course) : { on: false, stats: () => ({}) }), [course, cid]);

  /* During render, not in the effect below. Blocks read this config *while*
     they render, and an effect runs after that render has painted — so a deep
     link or a reload straight onto a section drew its code blocks with no
     highlighting and its mono tables with no valueStyles, and nothing ever
     corrected it, because the config is a module variable and not state. It
     only looked right when the reader arrived from another view, which had
     already run the effect. Arriving directly is the normal case: search
     results, schedule.md and checklist.md all deep-link to a section. */
  setBlockConfig(course);

  useEffect(() => {
    applyHue(course);
    if (!course) return;
    /* One course's styles at a time. They used to be appended and never
       removed, so opening three courses left three stylesheets fighting. */
    document.querySelectorAll('style[id^="cs-"]').forEach(el => {
      if (el.id !== "cs-" + cid) el.remove();
    });
    if (course.styles && !document.getElementById("cs-" + cid)) {
      const el = document.createElement("style");
      el.id = "cs-" + cid;
      el.textContent = course.styles;
      document.head.appendChild(el);
    }
  }, [course, cid]);

  const labelFor = useCallback(
    id => (idx && id && idx.SUBS[id] ? labelOf(idx.SUBS, id) : (course ? course.title : "Courses")),
    [idx, course]
  );
  const nav = useNav(labelFor);

  const ctx = useMemo(
    () => (course ? { C: course, cid, idx, state, drills } : null),
    [course, cid, idx, state, drills]
  );

  /* which section is on screen, and the subsection to scroll to */
  const subId = idx && idx.SUBS[rest] ? rest : null;
  const secId = subId ? idx.SUBS[subId].sec.id : rest;
  const section = course ? course.sections.find(s => s.id === secId) : null;

  /* What the rail marks. The route says which subsection was asked for; this
     says which one is on screen now, and they part company the moment the
     reader scrolls. Only one section is ever on the page, so the section half
     of the rail still comes from the route. */
  const subIds = useMemo(() => (section ? section.subs.map(s => s.id) : []), [section]);
  const reading = useReading(subIds, subId);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = calm ? "auto" : "smooth";
    /* A return goes back to the sentence, not to the heading above it. Every
       other arrival still lands on the subsection's own top, which is what a
       link to a subsection means. */
    const home = nav.takeReturn();
    const el = subId ? document.getElementById(subId) : null;
    if (home && home.into != null && el) {
      /* Capped at the subsection's height so a layout that shrank while the
         reader was away — a tier stub they expanded, collapsed again on
         remount — cannot land them past its end and inside the next one. Not
         floored at zero: a negative offset is a real reading position, the one
         where the link sat in the margin of a subsection that began below the
         top of the screen. */
      land(el, Math.min(home.into, el.offsetHeight));
    } else if (el) {
      el.scrollIntoView({ block: "start", behavior });
    } else if (!subId && scrollY > 0) {
      scrollTo({ top: 0, behavior });
    }
    /* `section` is in the deps because of the split build: peek() returns
       nothing on a cold load, so the first pass of this effect runs before the
       course has arrived, finds no element, and silently does nothing. Opening
       a link to a subsection then left the reader at the top of the section
       with no indication anything had been skipped. The section object is
       referentially stable for a given course, so this re-runs when the course
       finally lands and not on every repaint. */
  }, [hash, section]);

  /* keyboard: / search, esc close, [ ] page between sections */
  useEffect(() => {
    const onKey = e => {
      /* content zoom before anything else, since it is modified and would
         otherwise be read as a bare "-" or "0" */
      const z = zoomFromKey(e, zoom);
      if (z != null) { e.preventDefault(); setZoom(z); return; }
      if (e.key === "Escape") { setSearchOpen(false); setMenuOpen(false); return; }
      const typing = e.target.matches?.("input,textarea,select");
      if (e.key === "/" && !typing) { e.preventDefault(); if (course) setSearchOpen(true); return; }
      if (e.key === "\\" && !typing && !e.metaKey && !e.ctrlKey) { toggleTuck(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "r" && due != null) { location.hash = "#/review"; return; }
      if (course && "123".includes(e.key)) { onLane(LANES[+e.key - 1].id); return; }
      if (!course || !section) return;
      const i = course.sections.indexOf(section);
      if (e.key === "[" && course.sections[i - 1]) location.hash = `#/${cid}/${course.sections[i - 1].id}`;
      if (e.key === "]" && course.sections[i + 1]) location.hash = `#/${cid}/${course.sections[i + 1].id}`;
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [course, section, cid, zoom, due]);

  /* Links inside injected course HTML cannot carry component handlers, so the
     content container intercepts them — this is the only delegation left. */
  const onContentClick = e => {
    const a = e.target.closest?.("a[href^='#']");
    if (!a) return;
    const href = a.getAttribute("href");
    const inProse = !!a.closest(".bmain") || !!a.closest(".mnote");
    e.preventDefault();
    /* Not just which subsection held the link, but how far down it the reader
       had got. See useNav.go — this is what the return pill lands on. */
    const sub = a.closest(".sub");
    nav.go(href, inProse,
           sub ? { id: sub.id, into: -sub.getBoundingClientRect().top } : null);
  };

  /* Destructive, and reachable from two places (the toolbar on a wide screen,
     the drawer on a narrow one), so it is written once. */
  const onReset = () => {
    if (!course) return;
    if (confirm(`Clear quiz history and review schedule for ${course.code}?`)) {
      state.reset(); resetRetention(cid); forceRender(n => n + 1);
    }
  };

  const crumb = !course
    ? "<b>Courses</b>"
    : !rest ? `<b>${course.code}</b>  ·  contents`
    : rest === "concepts" ? "<b>Core concepts</b>"
    : rest === "practice" ? "<b>Mixed practice</b>"
    : rest === "calibration" ? "<b>Calibration</b>"
    : rest === "map" || rest.startsWith("map/") ? "<b>Dependency map</b>"
    : rest.startsWith("primer/") ? "<b>Before you start</b>"
    : rest.startsWith("c/")
      ? `<b>Core concepts</b>  ›  ${((course.concepts || {})[rest.slice(2)] || {}).term || ""}`
      : section
        /* `reading`, not `subId`: the crumb answers "where am I", and the
           route answers "what did I click". They agree for one screen. The
           rail is read off the same value, so the two halves of the frame
           cannot say different things. */
        ? `<b>${section.num} ${section.title}</b>` +
          (reading ? `  ›  ${idx.SUBS[reading].sub.title}` : "")
        : "";

  let view = null;
  if (!course) view = cid
    ? <Library courses={INDEX} order={ORDER} loading={!loadError} error={loadError}
               onChange={() => forceRender(n => n + 1)} />
    : <Library courses={INDEX} order={ORDER} onChange={() => forceRender(n => n + 1)} />;
  else if (!rest) view = <CourseHome ctx={ctx} />;
  else if (rest === "concepts") view = <ConceptHub ctx={ctx} />;
  else if (rest === "practice") view = <Practice ctx={ctx} />;
  else if (rest === "calibration") view = <Calibration ctx={ctx} drills={drills} />;
  else if (rest === "map" || rest.startsWith("map/"))
    view = <DepMap ctx={ctx} focus={rest.slice(4)}
                   onNode={id => (location.hash = `#/${cid}/${id}`)} />;
  else if (rest.startsWith("c/")) view = <ConceptDetail ctx={ctx} k={rest.slice(2)} />;
  else if (rest.startsWith("primer/")) {
    const target = course.sections.find(x => x.id === rest.slice(7));
    view = target ? <Primer section={target} ctx={ctx} /> : <CourseHome ctx={ctx} />;
  }
  else if (section) view = <Section section={section} ctx={ctx} expandAll={expandAll}
                                    lane={lane} onLane={onLane} />;
  else view = <CourseHome ctx={ctx} />;

  /* T6: a keyboard reader should not traverse the whole rail to reach the
     material. href is handled here rather than left to the browser — "#content"
     would otherwise be read as a route by the hash router. */
  const skip = e => {
    e.preventDefault();
    const el = contentRef.current;
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: false });
  };

  if (inReview)
    return <Review onClose={() => history.back()} />;

  if (inSetup)
    return (
      <div class="shell solo bare">
        <main>
          <div class="wrap">
            <div class="lib">
              <CloudPanel setup onChange={() => forceRender(n => n + 1)} />
              <p class="lempty"><a href="#/">Back to the library</a></p>
            </div>
          </div>
        </main>
      </div>
    );

  return (
    <>
      <PageContext C={course} cid={cid} idx={idx} rest={rest} section={section} />
      <a class="skip" href="#content" onClick={skip}>Skip to the material</a>
      <div class={"shell" + (tucked ? " tucked" : "") + (course ? "" : " solo")}>
        {course && !tucked && (
          <Sidebar course={course} cid={cid} rest={rest} here={reading}
                   open={menuOpen} onNavigate={() => setMenuOpen(false)}
                   onClose={() => setMenuOpen(false)} onTuck={toggleTuck}
                   actions={{ stateOn: state.on, expanded: expandAll,
                              onExpand: () => setExpandAll(v => !v), onReset }} />
        )}
        <main>
          <Topbar crumb={crumb} inCourse={!!course} stateOn={state.on}
                  zoom={zoom} onZoomReset={() => setZoom(1)}
                  onSearch={() => setSearchOpen(true)}
                  onExpand={() => setExpandAll(v => !v)} expanded={expandAll}
                  onMenu={() => setMenuOpen(v => !v)}
                  due={due} onReview={() => (location.hash = "#/review")}
                  onReset={onReset} />
          <div class="wrap" id="content" ref={contentRef} onClick={onContentClick}>
            <div class="viewport" key={hash}>{view}</div>
          </div>
        </main>
      </div>

      {course && tucked && (
        <button class="untuck" onClick={toggleTuck}
                title="Show the section list  (\\)" aria-label="Show the section list">
          <IconTuck open={false} />
        </button>
      )}
      {menuOpen && <div class="scrim on" onClick={() => setMenuOpen(false)} />}
      <ReturnPill stack={nav.stack} onBack={nav.back} />
      {course && <SearchOverlay ctx={ctx} open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
