#!/usr/bin/env node
/* Builds the app into dist/: a small shell, plus one JSON per course holding
 * the files that course is written in.
 *
 *   node tools/build.mjs
 *
 * Nothing about a course is compiled. Rendering TeX at build time cost 16x in
 * size — ma26600's 458KB of YAML became 7.3MB — to save 54-87ms of phone CPU
 * per subsection, and that is the wrong trade once a course is something a
 * reader imports, edits and syncs. src/lib/parse.js reads the same files in
 * the browser, so what an author writes is what the app runs.
 *
 * Courses are read here only to fail early with a file-level message, and to
 * derive the library index in vite.config.js.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCourse } from "./lib/load.mjs";
import { PUBLIC } from "./lib/files.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COURSES = join(ROOT, "courses");

const ids = readdirSync(COURSES, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith("_"))
  .map(d => d.name);
if (!ids.length) {
  console.error(`no courses found in ${COURSES}`);
  console.error("A course is a folder there; `_`-prefixed ones are skipped.");
  console.error("If they have gone missing, git and packed/ both hold copies.");
  process.exit(1);
}

let bad = 0, privateCount = 0;
const totals = { sections: 0, subs: 0, questions: 0 };
for (const id of ids) {
  let C, errors;
  try { ({ course: C, errors } = loadCourse(join(COURSES, id))); }
  catch (e) { console.error(`FAIL  ${id}  ${e.message}`); bad++; continue; }
  if (errors.length) {
    console.error(`FAIL  ${id}`); errors.forEach(e => console.error("       ✗ " + e)); bad++; continue;
  }
  const subs = C.sections.reduce((n, s) => n + s.subs.length, 0);
  const qs = C.sections.reduce((n, s) => n + s.subs.reduce((m, u) => m + (u.quiz || []).length, 0), 0);
  totals.sections += C.sections.length; totals.subs += subs; totals.questions += qs;
  /* Whether a subject needed a bespoke renderer. Courses are meant to be data
     alone; tools/check-template.mjs reads this line to prove a freshly
     scaffolded one still is. */
  const custom = existsSync(join(COURSES, id, "blocks.js")) ? "custom blocks" : "no code";
  /* Only the courses in PUBLIC reach dist/. The rest are validated here and
     then left alone — they belong to the author, not to the deployment. */
  const where = PUBLIC.has(id) ? "public" : "private";
  if (where === "private") privateCount++;
  console.log(`  ${id.padEnd(12)} ${String(C.sections.length).padStart(2)} sections · ` +
    `${String(subs).padStart(3)} subsections · ${String(qs).padStart(4)} questions · ` +
    `${custom} · ${where}`);
}
if (bad) process.exit(1);

try {
  execFileSync("npx", ["vite", "build", "--logLevel", "warn"],
    { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
} catch (e) {
  console.error("vite build failed:\n" + (e.stdout || "") + (e.stderr || e.message));
  process.exit(1);
}

const dist = join(ROOT, "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("vite produced no dist/index.html"); process.exit(1);
}

const pub = existsSync(join(dist, "courses"))
  ? readdirSync(join(dist, "courses")).sort() : [];

/* The gate on the outcome rather than on the intent. vite.config.js decides
   what to emit, but a course could still land in dist/ some other way — a
   stale directory, a copied asset, a future plugin — and the cost of that is
   a reader's coursework served to anyone who has the address. So the folder
   that is about to be deployed is read back and compared against PUBLIC. */
const leaked = pub.map(f => f.replace(/\.json$/, "")).filter(id => !PUBLIC.has(id));
if (leaked.length) {
  console.error(`\nFAIL  dist/courses/ holds a course that is not public: ${leaked.join(", ")}`);
  console.error("      Courses reach a device by import or sync, never by deployment.");
  console.error("      The public set is PUBLIC in tools/lib/files.mjs.");
  process.exit(1);
}

function dirBytes(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    n += e.isDirectory() ? dirBytes(full) : statSync(full).size;
  }
  return n;
}

/* What a reader waits for is the shell once, then one course. Both are given
   compressed as well, because every host worth deploying to serves them that
   way and YAML compresses hard. */
const kb = n => `${(n / 1024).toFixed(0)}KB`;
const shell = dirBytes(dist) - dirBytes(join(dist, "courses"));
console.log(`\nbuilt dist/  ${ids.length - privateCount} public · ${privateCount} private ` +
  `(kept out of dist/) · ${totals.sections} sections · ${totals.questions} questions`);
console.log(`  shell        ${kb(shell).padStart(7)}`);

if (!pub.length) console.log("  (no public courses — every course is private)");
for (const f of pub) {
  const buf = readFileSync(join(dist, "courses", f));
  console.log(`  ${f.replace(/\.json$/, "").padEnd(12)} ${kb(buf.length).padStart(7)}  ` +
    `${kb(gzipSync(buf).length).padStart(6)} gzipped`);
}
