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
  /* Not `Number(course && …)`: with no course that expression is null, and
     Number(null) is 0 — a perfectly finite rotation, which is how the library
     kept ending up in amber even after the default moved. */
  const declared = course && course.theme ? course.theme.hue : undefined;
  const hue = Number(declared);
  const el = document.documentElement;
  /* A declared rotation is set inline; anything else *removes* the property so
     the stylesheet's own default applies. It used to write 0 in that case,
     which is a rotation like any other — and 0 puts the accent in amber, so
     the library and every course without a declared hue wore a colour that
     reads as a warning on hover. */
  if (declared != null && declared !== "" && Number.isFinite(hue)) el.style.setProperty("--hue", String(hue));
  else el.style.removeProperty("--hue");
}
