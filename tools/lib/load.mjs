/* ============================================================================
 * tools/lib/load.mjs — read a course folder of data files into a COURSE object
 *
 * A course is a folder. No JavaScript, anywhere.
 *
 *   courses/<id>/
 *     course.yaml                metadata, theme, state, legend, syntax, styles
 *     concepts/<key>.yaml        one file per recurring concept
 *     drills/<key>.yaml          one file per concept: the retention pool
 *     materials/expectations.md  front matter: the exam, and the review-set basis
 *     sections/NN-slug/
 *       _section.yaml            title + blurb for the section
 *       N-slug.yaml              one file per subsection: blocks + quiz
 *
 * Numbering comes from the filename prefixes, so ids are positional:
 * section NN → "sNN", subsection N → "sNN-N". Authors never write ids.
 * Both .yaml/.yml and .json are accepted for every file.
 * ==========================================================================*/
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import * as YAML from "js-yaml";

const DATA_EXT = new Set([".yaml", ".yml", ".json"]);

export function parseFile(path) {
  const raw = readFileSync(path, "utf8");
  if (extname(path) === ".json") return JSON.parse(raw);
  return YAML.load(raw);
}

/** first file in `dir` whose basename (sans extension) is `name` */
function findFile(dir, name) {
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir)) {
    if (!DATA_EXT.has(extname(f))) continue;
    if (basename(f, extname(f)) === name) return join(dir, f);
  }
  return null;
}

function dataFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => DATA_EXT.has(extname(f)) && !f.startsWith("_"))
    .sort();
}

/* The calibration `expectations.md` records per M3: the exam the scheduler aims
   at, and the basis on which the review set was chosen. Deadline scheduling and
   drill-format coverage read the exam; validate.mjs reads the basis, because an
   undeclared one is a guess about what matters in six weeks that nobody can
   check (M31). */
function readCalibration(path) {
  if (!existsSync(path)) return null;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, "utf8"));
  if (!m) return null;
  const front = YAML.load(m[1]) || {};
  const exam = front.exam;
  return {
    exam: exam && {
      format: exam.format || [],
      dates: (exam.dates || []).map(d => d instanceof Date ? d.toISOString().slice(0, 10) : String(d))
    },
    reviewBasis: String((front.review || {}).basis || "").trim()
  };
}

/** leading integer of a filename, e.g. "03-boolean" → 3 */
function prefixNum(name, fallback) {
  const m = /^(\d+)/.exec(name);
  return m ? parseInt(m[1], 10) : fallback;
}

export function loadCourse(dir) {
  const errors = [];
  const metaPath = findFile(dir, "course");
  if (!metaPath) throw new Error(`no course.yaml (or .json) in ${dir}`);

  const meta = parseFile(metaPath) || {};
  const C = Object.assign(
    { code: "", title: "", tagline: "", meta: "", concepts: {}, drills: {}, sections: [] },
    meta
  );
  C.concepts = Object.assign({}, meta.concepts || {});
  C.drills = {};

  /* ---- concepts: one file per concept, key from the filename ---- */
  const cdir = join(dir, "concepts");
  for (const f of dataFiles(cdir)) {
    const key = basename(f, extname(f));
    const body = parseFile(join(cdir, f));
    if (!body || typeof body !== "object") { errors.push(`concepts/${f}: not a mapping`); continue; }
    C.concepts[body.key || key] = body;
  }

  /* ---- drills: one file per concept, key from the filename ---- */
  const ddir = join(dir, "drills");
  for (const f of dataFiles(ddir)) {
    const key = basename(f, extname(f));
    const body = parseFile(join(ddir, f));
    if (!body || typeof body !== "object") { errors.push(`drills/${f}: not a mapping`); continue; }
    C.drills[body.concept || key] = { concept: body.concept || key, items: body.items || [] };
  }

  /* ---- calibration: the exam aimed at, and why the review set is what it is ---- */
  const cal = readCalibration(join(dir, "materials", "expectations.md")) || {};
  C.reviewBasis = cal.reviewBasis || "";
  if (cal.exam) {
    C.exam = cal.exam;
    C.retention = Object.assign({ deadlines: cal.exam.dates }, C.retention || {});
  }

  /* ---- sections: one folder each, subsections one file each ---- */
  const sdir = join(dir, "sections");
  if (existsSync(sdir)) {
    const folders = readdirSync(sdir)
      .filter(f => statSync(join(sdir, f)).isDirectory() && !f.startsWith("_"))
      .sort();

    folders.forEach((folder, si) => {
      const full = join(sdir, folder);
      const metaFile = findFile(full, "_section");
      const smeta = metaFile ? parseFile(metaFile) || {} : {};
      const num = smeta.num != null ? smeta.num : prefixNum(folder, si + 1);
      const id = smeta.id || `s${num}`;

      const subs = dataFiles(full).map((f, k) => {
        const sub = parseFile(join(full, f));
        if (!sub || typeof sub !== "object") { errors.push(`${folder}/${f}: not a mapping`); return null; }
        return Object.assign({}, sub, {
          id: sub.id || `${id}-${prefixNum(f, k + 1)}`,
          title: sub.title || basename(f, extname(f)),
          blocks: sub.blocks || [],
          quiz: sub.quiz || []
        });
      }).filter(Boolean);

      if (!subs.length) errors.push(`${folder}: no subsection files`);
      C.sections.push({
        id, num,
        title: smeta.title || folder,
        blurb: smeta.blurb || "",
        primer: smeta.primer || [],
        subs
      });
    });
  }

  C.sections.sort((a, b) => a.num - b.num);
  if (!C.sections.length) errors.push("no sections found");
  return { course: C, errors };
}
