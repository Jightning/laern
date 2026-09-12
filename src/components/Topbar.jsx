import { IconSearch, IconHome } from "./Icon.jsx";
import CourseActions from "./CourseActions.jsx";
import ModeSwitch from "./ModeSwitch.jsx";
import { M } from "../lib/math.js";

export default function Topbar({ crumb, inCourse, onSearch, onExpand, expanded, onMenu, zoom, onZoomReset, due, onReview, reading, lane, depth, onMode }) {
  return (
    <div class="topbar">
      {/* Only where there is a sidebar to open. The library is `shell.solo` and
          renders none, so on a phone this button used to dim the page behind a
          scrim covering nothing and wait to be dismissed. */}
      {inCourse && (
        <button class="tbtn mobnav" onClick={onMenu} aria-label="Open navigation"
                aria-controls="sidebar">Menu</button>
      )}
      {/* Home is the breadcrumb's root rather than a control beside it. The
          sidebar has an "All courses" link, but it is inside a drawer on a
          phone and gone entirely when the sidebar is collapsed — and the
          library is not just a picker, it is where a course is installed and
          removed, so the way back cannot depend on the one piece of chrome the
          reader is allowed to hide.

          It goes *inside* the crumb because a control in front of the crumb
          pushes it off the reading column's left edge: the bar is aligned with
          the prose beneath it, and 108px of button is 108px of misalignment. A
          trail that starts at the library is also what a breadcrumb is. */}
      <span class="crumb">
        {inCourse && (
          <>
            <a class="crumb-home" id="tb-home" href="#/" aria-label="All courses">
              <IconHome /><span class="crumb-word">Courses</span>
            </a>
            <span class="crumb-sep" aria-hidden="true">›</span>
          </>
        )}
        <span dangerouslySetInnerHTML={{ __html: M(crumb) }} />
      </span>
      <span class="spacer" />
      {/* only shown once it is off its default, so it reports a state the
          reader set rather than adding a permanent control */}
      {zoom !== 1 && (
        <button class="tbtn zoomchip" onClick={onZoomReset}
                title="Reset content zoom  (ctrl 0)" aria-label="Reset content zoom">
          {Math.round(zoom * 100)}%
        </button>
      )}
      {/* The one control Loop B adds. It is cross-course, like the queue behind
          it, so it renders in the library too — and not at all until some
          course on disk has a drill bank. */}
      {due != null && (
        <button class="tbtn rv" id="rv-open" onClick={onReview}
                title="Review what is due  (r)" aria-label={`Review, ${due} due`}>
          Review <b>{due}</b>
        </button>
      )}
      {/* Only while there is material on screen. The mode decides how a section
          renders, so on a hub or the Desk it would be a control over nothing —
          and the Desk in particular is about what to do next, not how to draw
          it. */}
      {reading && <ModeSwitch lane={lane} depth={depth} onMode={onMode} />}
      {inCourse && (
        <button class="tbtn" onClick={onSearch} aria-label="Search">
          <IconSearch /><span class="tb-word">Search /</span>
        </button>
      )}
      {/* Everything past here moves into the drawer below the sidebar
          breakpoint; see CourseActions. */}
      <span class="tb-sec">
        <CourseActions inCourse={inCourse} expanded={expanded} onExpand={onExpand} />
      </span>
    </div>
  );
}
