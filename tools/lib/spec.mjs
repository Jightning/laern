/* ============================================================================
 * tools/lib/spec.mjs — address the authoring spec by heading, not by file
 *
 * create_course.md is ~9.8k tokens and material_truth.md ~5.3k. Sending both
 * on every call pays for §8's drill rules while writing a figure. Headings are
 * already the natural unit, so this indexes them and hands back only the ones
 * a phase names.
 *
 *   sections(md)      -> [{ id, level, title, body }]  body is own text only
 *   slice(md, ids)    -> the named headings, in document order, deduped
 *
 * An id is the heading's number ("6", "6.1", "12a") or, when a heading carries
 * no number, a slug of its title ("trade-offs"). A trailing "*" takes the
 * heading and everything nested under it: "6" is §6's preamble alone, "6*" is
 * §6 entire.
 * ==========================================================================*/
import { readFileSync } from "node:fs";

const HEADING = /^(#{2,4})\s+(.+?)\s*$/;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "## 6. Sections and subsections" -> "6";  "### Quality bar" -> "quality-bar" */
function idOf(title) {
  const m = /^([0-9]+[a-z]?(?:\.[0-9]+)?)\.?\s+/.exec(title);
  return m ? m[1] : slug(title.replace(/`/g, ""));
}

/** Every heading in `md`, each carrying only the prose directly beneath it. */
export function sections(md) {
  const lines = md.split("\n");
  const out = [];
  let cur = null;
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) {
      if (cur) out.push(cur);
      cur = { id: idOf(m[2]), level: m[1].length, title: m[2], lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) out.push(cur);
  return out.map(s => ({ ...s, body: s.lines.join("\n").trim(), lines: undefined }));
}

/** Index a spec file once; `pick` then costs nothing per call. */
export function loadSpec(path) {
  const secs = sections(readFileSync(path, "utf8"));
  const byId = new Map(secs.map((s, i) => [s.id, i]));

  /* A heading's descendants are the run of deeper headings that follow it, and
     stop at the next heading of the same or shallower level. */
  const withKids = i => {
    const out = [i];
    for (let j = i + 1; j < secs.length && secs[j].level > secs[i].level; j++) out.push(j);
    return out;
  };

  return {
    path,
    ids: secs.map(s => s.id),
    /** slice(["0", "6", "6.1*"]) -> markdown, document order, no repeats */
    pick(ids) {
      const want = new Set();
      for (const raw of ids) {
        const deep = raw.endsWith("*");
        const id = deep ? raw.slice(0, -1) : raw;
        const i = byId.get(id);
        if (i === undefined) throw new Error(`${path}: no heading "${id}"`);
        (deep ? withKids(i) : [i]).forEach(k => want.add(k));
      }
      return [...want].sort((a, b) => a - b).map(i => secs[i].body).join("\n\n");
    }
  };
}
