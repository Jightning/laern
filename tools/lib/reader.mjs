/* ============================================================================
 * tools/lib/reader.mjs — who the courses are written for
 *
 * §1 of create_course.md is a blank form, because a learner profile is personal
 * and that file is tracked. The filled-in copy lives in `courses/_reader.yaml`,
 * which `courses/*` already keeps out of git — the same rule that makes the
 * courses private makes the profile private.
 *
 * Missing or half-filled is a hard stop, not a default. §1.1 turns the profile
 * into seven authoring defaults per unit, so a guess does not fail where it is
 * made; it fails quietly in every file written afterwards.
 * ==========================================================================*/
import { readFileSync, existsSync } from "node:fs";

export const HELP =
  "It says who the course is for, and every prompt carries it — §1.1 of\n" +
  "docs/create_course.md derives seven authoring defaults from it. Copy the\n" +
  "`reader:` block from §1 into courses/_reader.yaml and fill it in.\n\n" +
  "The file is gitignored, like the courses it calibrates.";

/** The profile as text. Throws with a fixable message when it cannot be used. */
export function readReader(path) {
  if (!existsSync(path)) throw new Error(`${path} does not exist.\n\n${HELP}`);
  const text = readFileSync(path, "utf8");
  const unset = (text.match(/:\s*UNSET\b/g) || []).length;
  if (unset) {
    throw new Error(
      `${path} still has ${unset} UNSET field${unset === 1 ? "" : "s"}. ` +
      `Fill them in — a course written against UNSET is calibrated to nobody ` +
      `(create_course.md 0.3).`);
  }
  if (!/^\s*reader\s*:/m.test(text)) throw new Error(`${path} has no \`reader:\` block.\n\n${HELP}`);
  return text.trim();
}

/** The text if it is usable, or a placeholder — for commands that only cost the
 *  work rather than emit it, where a missing profile is not yet an error. */
export function peekReader(path) {
  try { return readReader(path); } catch { return "reader: UNSET"; }
}
