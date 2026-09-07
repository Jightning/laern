/* Block kinds that are components, not string renderers.
 *
 * The registry in ./index.js is `data -> HTML` on purpose, which is what makes
 * it a trivial extension point for a new subject. A block that needs an input
 * and a submission cannot be expressed that way, so the few that do are named
 * here — once — and Section renders them itself. validate.mjs reads this list
 * so an interactive kind is not reported as unrenderable. */
export const INTERACTIVE = ["attempt"];
