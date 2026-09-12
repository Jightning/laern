/* The page actions that are not navigation and not the review queue.
 *
 * They are defined once and mounted twice: in the toolbar, where they sit on a
 * wide screen, and in the navigation drawer, where they sit on a narrow one.
 * CSS shows exactly one of the two, so only one is ever in the accessibility
 * tree — the same "render both forms, let the breakpoint pick" shape the lane
 * selector already uses.
 *
 * Why they move at all: on a phone six equal-weight chips wrap onto two rows
 * and cost a fifth of the viewport for the whole session, while `Reset` is a
 * destructive action sitting one thumb-width from `Menu`. Reading needs the
 * material, navigation and search; a theme is set once and a reset is rare, so
 * those go one tap deeper rather than staying permanently in the way.
 */
export default function CourseActions({ inCourse, stateOn, expanded, onExpand, onReset }) {
  const toggleTheme = () => {
    const el = document.documentElement;
    let cur = el.getAttribute("data-theme");
    if (!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    el.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  };

  return (
    <>
      {/* One control, two directions. "Close all" puts the page back the way
          the depth had it rather than to the full text — otherwise closing is a
          different act from never having opened, and the reader who opened one
          block to check something can never get their view back. */}
      {inCourse && (
        <button class="tbtn" onClick={onExpand}
                title={expanded ? "Put the page back the way this depth had it"
                                : "Open every block and reveal every answer"}>
          {expanded ? "Close all" : "Reveal all"}
        </button>
      )}
      <button class="tbtn" onClick={toggleTheme} aria-label="Toggle colour theme">Theme</button>
      {inCourse && stateOn && (
        <button class="tbtn" onClick={onReset} aria-label="Clear saved progress">Reset</button>
      )}
    </>
  );
}
