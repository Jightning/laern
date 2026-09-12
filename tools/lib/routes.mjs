/* routes — every distinct view of a course, as hash routes.
 *
 * One responsibility: turn a loaded course into the list of pages a sweep has
 * to visit. Section ids and concept keys are positional and course-specific,
 * so hard-coding a route list means a gate silently stops covering whatever
 * the data grew since. Both the contrast gate and the screenshot pass read
 * their route list from here.
 */

/** three sections spread across the course — first, middle, last */
function spread(sections) {
  if (!sections.length) return [];
  const pick = new Set([0, sections.length >> 1, sections.length - 1]);
  return [...pick].map(i => sections[i].id);
}

export function routesFor(course) {
  const secs = spread(course.sections || []);
  const concept = Object.keys(course.concepts || {})[0];
  /* A category's own page carries chips, monograms and the sibling strip, none
     of which appear anywhere else — so a course that declares one contributes
     two more palettes to sweep. `explore` renders the facet buttons and the
     result rows, which are likewise nowhere else. */
  const cat = Object.keys(course.cats || {})[0];
  return [
    "",
    ...secs.map(id => "/" + id),
    "/concepts",
    ...(concept ? ["/c/" + concept] : []),
    ...(cat ? ["/cat", "/cat/" + cat] : []),
    "/explore",
    "/practice",
    "/calibration",
    "/map",
    ...(secs.length ? ["/primer/" + secs[secs.length - 1]] : [])
  ];
}
