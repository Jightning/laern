import { useState, useEffect, useMemo, useCallback, useRef } from "preact/hooks";
import { INDEX, ORDER, get as getCourse, peek, refresh as refreshLibrary } from "./lib/library.js";

import { buildIndex, labelOf } from "./lib/index.js";
import { stateFor } from "./lib/state.js";
import { indexDrills } from "./lib/drills.js";
import { dueCount } from "./lib/queue.js";
import { laneFor, setLane, LANES } from "./lib/tiers.js";
import { reset as resetRetention } from "./lib/retention.js";
import { rebuild } from "./lib/replay.js";
import { useHashRoute, useNav } from "./lib/nav.js";
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

  useEffect(() => {
    applyHue(course);
    if (!course) return;
    setBlockConfig(course);
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

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = calm ? "auto" : "smooth";
    if (subId) {
      const el = document.getElementById(subId);
      if (el) el.scrollIntoView({ block: "start", behavior });
    } else if (scrollY > 0) {
      scrollTo({ top: 0, behavior });
    }
  }, [hash]);

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
    const origin = a.closest(".sub")?.id || null;
    nav.go(href, inProse, origin);
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
        ? `<b>${section.num} ${section.title}</b>` + (subId ? `  ›  ${idx.SUBS[subId].sub.title}` : "")
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
      <div class="shell solo">
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
          <Sidebar course={course} cid={cid} rest={rest} open={menuOpen} onNavigate={() => setMenuOpen(false)}
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
