import { useEffect, useRef } from "preact/hooks";
import { IconStart, IconConcept, IconPractice, IconMap, IconTuck } from "./Icon.jsx";
import CourseActions from "./CourseActions.jsx";

/* State is carried by the number itself — weight, colour and an edge marker.
   The previous 26x18px pulse was too small to read as a signal and landed as a
   stray rectangle, which is worse than no device at all. */
function Cycle({ n, active, visited }) {
  return (
    <span class={"cyc" + (active ? " is-on" : "") + (visited ? " is-seen" : "")}>
      <span class="sec-num">{String(n).padStart(2, "0")}</span>
    </span>
  );
}

/* How much of the rail to keep beyond the mark, so it never lands flush
   against an edge and read as clipped. */
const EDGE = 28;

export default function Sidebar({ course, cid, rest, here, open, onNavigate, onTuck, actions }) {
  const H = r => `#/${cid}${r ? "/" + r : ""}`;
  const rail = useRef(null);

  /* Bring the mark into view, because on anything longer than a short course
     it is not. Measured at 900px of sidebar: a 15-section course marks 721px
     down, a 62-section one 2021px down — a highlight below the fold of its own
     list is not a highlight.
     
     Minimally, and only the sidebar: never the page, never centred, and never
     while the pointer is over it, so a reader working down the list by hand is
     never yanked back to where the page happens to be. */
  useEffect(() => {
    const box = rail.current;
    if (!box || box.matches(":hover")) return;
    const mark = box.querySelector(".subs a.cur") || box.querySelector(".sec.active");
    if (!mark) return;
    const b = box.getBoundingClientRect(), m = mark.getBoundingClientRect();
    const over = m.bottom - (b.bottom - EDGE);
    const under = (b.top + EDGE) - m.top;
    const by = under > 0 ? -under : over > 0 ? over : 0;
    if (!by) return;
    /* Smooth for a nudge, instant for a relocation. Reading down a section
       moves the mark a row at a time and the glide is what makes that legible;
       arriving at section 40 of 62 is a 2000px jump, and animating that is a
       second of the rail streaming past on a control nobody was looking at. */
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const far = Math.abs(by) > b.height;
    box.scrollTo({ top: box.scrollTop + by, behavior: calm || far ? "auto" : "smooth" });
  }, [here, rest]);
  /* the primer belongs to the section it introduces, so the rail marks it too */
  const target = rest && rest.startsWith("primer/") ? rest.slice(7) : rest;
  const activeSec = target && target.startsWith("s") ? target.split("-")[0] : null;
  const curNum = activeSec ? Number(activeSec.slice(1)) : 0;

  const top = [
    ["", "Overview", IconStart, !rest],
    ["concepts", "Core concepts", IconConcept, rest === "concepts" || rest.startsWith("c/")],
    ["practice", "Mixed practice", IconPractice, rest === "practice"],
    ["map", "Dependency map", IconMap, rest === "map"]
  ];

  return (
    <aside class={"sidebar" + (open ? " open" : "")} id="sidebar" ref={rail}>
      {/* No close control of its own. It sat pinned to the drawer's top-right,
          which on an iPhone is under the Dynamic Island — and the drawer
          already has three ways out that cost no chrome: the scrim beside it,
          the Menu button that opened it, and Escape. */}
      <div class="brand">
        {/* Not conditional on there being more than one course: the library
            is also where a course is installed and removed, so a single-course
            device needs this link most. */}
        <a class="backlib" href="#/">All courses</a>
        <span class="code">{course.code}</span>
        <span class="name">{course.title}</span>
        <span class="meta">{course.meta}</span>
      </div>

      <div class="navtop">
        {top.map(([route, label, Ico, cur]) => (
          <a key={label} href={H(route)} class={cur ? "cur" : ""} onClick={onNavigate}>
            <span class="k"><Ico /></span>{label}
          </a>
        ))}
      </div>

      {/* the control acts on the sidebar, so it lives on the sidebar's edge */}
      <button class="tuck" onClick={onTuck} title="Hide the section list  (\\)"
              aria-label="Hide the section list">
        <IconTuck open />
      </button>

      {/* The toolbar's secondary actions, on a screen too narrow to carry
          them permanently. Hidden above the breakpoint, where the toolbar
          shows them instead. */}
      <div class="side-actions">
        <CourseActions inCourse stateOn={actions.stateOn} expanded={actions.expanded}
                       onExpand={actions.onExpand} onReset={actions.onReset} />
      </div>

      <nav class="rail" aria-label="Course sections">
        {course.sections.map(s => {
          const on = s.id === activeSec;
          return (
            <div key={s.id} class={"sec" + (on ? " active open" : "")}>
              <a class="sec-btn" href={H(s.id)} onClick={onNavigate}>
                <Cycle n={s.num} active={on} visited={s.num < curNum} />
                <span class="sec-title">{s.title}</span>
              </a>
              <ul class="subs">
                {s.subs.map((sub, k) => (
                  <li key={sub.id}>
                    {/* `here` is where the reader is, not where they clicked —
                        see useReading in lib/nav.js. */}
                    <a href={H(sub.id)} class={here === sub.id ? "cur" : ""} onClick={onNavigate}>
                      {`${s.num}.${k + 1}  ${sub.title}`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
