import { IconSearch, IconHome } from "./Icon.jsx";
import CourseActions from "./CourseActions.jsx";
import { M } from "../lib/math.js";

export default function Topbar({ crumb, inCourse, stateOn, onSearch, onExpand, expanded, onReset, onMenu, zoom, onZoomReset, due, onReview }) {
  return (
    <div class="topbar">
      <button class="tbtn mobnav" onClick={onMenu} aria-label="Open navigation"
              aria-controls="sidebar">Menu</button>
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
      {inCourse && (
        <button class="tbtn" onClick={onSearch} aria-label="Search">
          <IconSearch /><span class="tb-word">Search /</span>
        </button>
      )}
      {/* Everything past here moves into the drawer below the sidebar
          breakpoint; see CourseActions. */}
      <span class="tb-sec">
        <CourseActions inCourse={inCourse} stateOn={stateOn} expanded={expanded}
                       onExpand={onExpand} onReset={onReset} />
      </span>
    </div>
  );
}
