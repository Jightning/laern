/* theme — apply a course's accent rotation.
 *
 * The whole palette is one angle: `theme.hue` in course.yaml rotates the four
 * accent tokens together, so a course is recognisable without inventing a
 * second colour system. Lightness and chroma stay fixed, which is what keeps
 * the contrast gate green (see src/css/00-tokens.css).
 *
 * It lands on the document root, not the app tree, because overlays and the
 * scrollbar gutters render outside it.
 */
export function applyHue(course) {
  const hue = Number(course && course.theme && course.theme.hue) || 0;
  document.documentElement.style.setProperty("--hue", String(hue));
}
