#!/usr/bin/env node
/* Scaffold a new subject from the template. No code is generated or needed.
 *   node tools/new-course.mjs ma26600 "Ordinary Differential Equations"
 */
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSpec } from "./lib/spec.mjs";

/* A course's accent is one angle, and two courses that pick the same angle are
   indistinguishable in the library — the exact defect the rotation exists to
   remove. The template cannot carry a good default, because then every course
   scaffolded from it would collide with every other. So the angle is chosen
   here: the one furthest from every angle already taken. */
function freeHue(coursesDir) {
  const used = [];
  for (const d of readdirSync(coursesDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;
    const f = ["course.yaml", "course.yml", "course.json"]
      .map(n => join(coursesDir, d.name, n)).find(existsSync);
    if (!f) continue;
    const m = /^\s*hue:\s*(-?\d+)/m.exec(readFileSync(f, "utf8"));
    used.push(((m ? Number(m[1]) : 0) % 360 + 360) % 360);
  }
  if (!used.length) return 0;
  const gapTo = h => Math.min(...used.map(u => {
    const d = Math.abs(h - u) % 360; return Math.min(d, 360 - d);
  }));
  let best = 0;
  for (let h = 5; h < 360; h += 5) if (gapTo(h) > gapTo(best)) best = h;
  return best;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [id, ...rest] = process.argv.slice(2);
if (!id) { console.error('usage: new-course.mjs <id> "Course Title"'); process.exit(1); }
const title = rest.join(" ") || "Course Title";
const dest = join(ROOT, "courses", id);
if (existsSync(dest)) { console.error(`courses/${id} already exists`); process.exit(1); }

/* Who the courses are for, written once per machine rather than once per
   course. It is the same block §1 of create_course.md documents, lifted from
   there so the two cannot drift, and it lands gitignored beside the courses it
   calibrates because a learner profile is personal. */
function scaffoldReader(coursesDir) {
  const dest = join(coursesDir, "_reader.yaml");
  if (existsSync(dest)) return null;
  const sec = loadSpec(join(ROOT, "docs/create_course.md")).pick(["1"]);
  const block = (/```yaml\n([\s\S]*?)```/.exec(sec) || [])[1];
  if (!block) throw new Error("create_course.md §1 has no reader block to copy");
  writeFileSync(dest,
    "# Who these courses are written for. Read by tools/author.mjs, which sends\n" +
    "# it with every authoring prompt, and by any model writing a course by hand.\n" +
    "# docs/create_course.md §1.1 derives seven authoring defaults from it, so\n" +
    "# every field has to be answered — UNSET is refused rather than guessed.\n" +
    "#\n# Gitignored, like the courses beside it.\n\n" + block);
  return dest;
}

const hue = freeHue(join(ROOT, "courses"));
const readerFile = scaffoldReader(join(ROOT, "courses"));
cpSync(join(ROOT, "courses", "_template"), dest, { recursive: true });
const cfg = join(dest, "course.yaml");
writeFileSync(cfg, readFileSync(cfg, "utf8")
  .replace("code: XX 00000", "code: " + id.toUpperCase())
  .replace("title: Course Title", "title: " + title)
  .replace(/^(\s*)hue: 0$/m, `$1hue: ${hue}`));

/* The template ships a drill bank, so the course owes problems.md and
   checklist.md from the moment it exists — they are generated (T20) and
   `npm run check` compares them against the data. Writing them here is what
   makes a freshly scaffolded course pass the suite rather than fail it on two
   files the author never knew were owed. */
execFileSync(process.execPath, [join(ROOT, "tools", "gen-materials.mjs"), id],
  { cwd: ROOT, stdio: "ignore" });

console.log(`created courses/${id}  (accent hue ${hue})`);
if (readerFile) console.log("created courses/_reader.yaml — fill it in before authoring");
console.log("  1. edit course.yaml");
console.log("  2. add sections/NN-slug/_section.yaml and NN-slug files");
console.log(`  3. node tools/build.mjs ${id} && node tools/validate.mjs ${id}`);
