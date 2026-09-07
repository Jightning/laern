/* ============================================================================
 * src/lib/parse.js — a course, from the files it is written in
 *
 * The browser half of what tools/lib/load.mjs does on disk. Same rules, same
 * positional ids, same shape out; the only difference is that a course arrives
 * as a map of path to text rather than as a directory.
 *
 *   { "course.yaml": "...", "sections/01-intro/1-start.yaml": "...", ... }
 *
 * That map is the unit of everything now: what the build ships, what a user
 * imports, what an author edits, what IndexedDB stores. There is no compiled
 * form in between, so what a model writes is exactly what the app runs.
 *
 * Measured cost on a low-tier phone: 87ms for ma26600's 458KB across 105
 * files, once per course open.
 * ==========================================================================*/
import * as YAML from "js-yaml";

const DATA = /\.(ya?ml|json)$/i;
const stem = p => p.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
const num = (name, fallback) => {
  const m = /^(\d+)/.exec(name.replace(/^.*\//, ""));
  return m ? parseInt(m[1], 10) : fallback;
};

/** Files directly inside `dir`, data only, ignoring `_`-prefixed ones. */
const listing = (files, dir) => Object.keys(files)
  .filter(p => p.startsWith(dir) && !p.slice(dir.length).includes("/"))
  .filter(p => DATA.test(p) && !p.slice(dir.length).startsWith("_"))
  .sort();

/** The exam the scheduler aims at, and why the review set is what it is (M3). */
function calibration(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || "");
  if (!m) return {};
  let front = {};
  try { front = YAML.load(m[1]) || {}; } catch { return {}; }
  const exam = front.exam;
  return {
    exam: exam && {
      format: exam.format || [],
      dates: (exam.dates || []).map(d =>
        d instanceof Date ? d.toISOString().slice(0, 10) : String(d))
    },
    reviewBasis: String((front.review || {}).basis || "").trim()
  };
}

/**
 * @param files {Record<string,string>} path -> text, relative to the course root
 * @returns {{course: object, errors: string[]}}
 */
export function parseCourse(files) {
  const errors = [];
  const read = p => {
    try { return p.endsWith(".json") ? JSON.parse(files[p]) : YAML.load(files[p]); }
    catch (e) { errors.push(`${p}: ${e.message.split("\n")[0]}`); return null; }
  };

  const metaPath = Object.keys(files).find(p => /^course\.(ya?ml|json)$/.test(p));
  if (!metaPath) return { course: null, errors: ["no course.yaml at the root"] };

  const meta = read(metaPath) || {};
  const C = Object.assign(
    { code: "", title: "", tagline: "", meta: "", concepts: {}, drills: {}, sections: [] },
    meta);
  C.concepts = Object.assign({}, meta.concepts || {});
  C.drills = {};

  for (const p of listing(files, "concepts/")) {
    const body = read(p);
    if (!body || typeof body !== "object") { errors.push(`${p}: not a mapping`); continue; }
    C.concepts[body.key || stem(p)] = body;
  }

  for (const p of listing(files, "drills/")) {
    const body = read(p);
    if (!body || typeof body !== "object") { errors.push(`${p}: not a mapping`); continue; }
    const key = body.concept || stem(p);
    C.drills[key] = { concept: key, items: body.items || [] };
  }

  const cal = calibration(files["materials/expectations.md"]);
  C.reviewBasis = cal.reviewBasis || "";
  if (cal.exam) {
    C.exam = cal.exam;
    C.retention = Object.assign({ deadlines: cal.exam.dates }, C.retention || {});
  }

  /* Sections are folders, subsections the files inside them; both are numbered
     by filename prefix, so an author never writes an id. */
  const folders = [...new Set(Object.keys(files)
    .filter(p => p.startsWith("sections/"))
    .map(p => p.split("/")[1])
    .filter(d => d && !d.startsWith("_")))].sort();

  folders.forEach((folder, si) => {
    const dir = `sections/${folder}/`;
    const metaFile = Object.keys(files).find(p => new RegExp(`^${dir}_section\\.(ya?ml|json)$`).test(p));
    const smeta = (metaFile && read(metaFile)) || {};
    const n = smeta.num != null ? smeta.num : num(folder, si + 1);
    const id = smeta.id || `s${n}`;

    const subs = listing(files, dir).map((p, k) => {
      const sub = read(p);
      if (!sub || typeof sub !== "object") { errors.push(`${p}: not a mapping`); return null; }
      return Object.assign({}, sub, {
        id: sub.id || `${id}-${num(p, k + 1)}`,
        title: sub.title || stem(p),
        blocks: sub.blocks || [],
        quiz: sub.quiz || []
      });
    }).filter(Boolean);

    if (!subs.length) errors.push(`sections/${folder}: no subsection files`);
    C.sections.push({
      id, num: n,
      title: smeta.title || folder,
      blurb: smeta.blurb || "",
      primer: smeta.primer || [],
      subs
    });
  });

  C.sections.sort((a, b) => a.num - b.num);
  if (!C.sections.length) errors.push("no sections found");

  /* Images travel as data URIs under their own path, so a course stays one
     self-contained map with nothing to fetch alongside it. Resolved here rather
     than in the renderer: block config is applied in an effect, which runs
     after the first paint, and a figure must not 404 on the way to being right. */
  const assets = {};
  for (const p of Object.keys(files)) if (p.startsWith("assets/")) assets[p] = files[p];
  if (Object.keys(assets).length) {
    for (const s of C.sections)
      for (const u of s.subs)
        for (const b of u.blocks)
          if (b && b.t === "image" && assets[b.src]) b.src = assets[b.src];
  }

  return { course: C, errors };
}
