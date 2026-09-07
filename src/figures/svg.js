/* Figure kind: svg */
import { esc, tone, attr, txt, round } from "./base.js";

/* ---------- kind: svg (escape hatch) ------------------------------------ */
export function svg (spec) {
  return '<svg viewBox="' + (spec.viewBox || "0 0 640 320") + '" class="fx" role="img">' +
    (spec.body || "") + "</svg>";
}
