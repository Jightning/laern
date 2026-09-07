#!/usr/bin/env node
/* Write a course out as one file, to carry to your own devices.
 *
 *   node tools/pack.mjs ma26600        -> packed/ma26600.course.json
 *   node tools/pack.mjs --private      -> every course the deployment omits
 *
 * A private course never reaches the deployment, so this is how it reaches a
 * phone: pack it, open the file from the app's library, and it lands in that
 * browser's IndexedDB. It is the same map of path to text the build ships for
 * public courses, so an imported course and a deployed one are the same thing.
 *
 * The output is plain readable YAML inside JSON — no archive format, nothing
 * to unzip — so a model can edit it and `unpack` puts it back on disk.
 */
import { readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { loadCourse } from "./lib/load.mjs";
import { courseFiles, PUBLIC } from "./lib/files.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COURSES = join(ROOT, "courses");
const OUT = join(ROOT, "packed");

const args = process.argv.slice(2);
const all = readdirSync(COURSES, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith("_"))
  .map(d => d.name);

let ids;
if (args.includes("--private")) {
  ids = all.filter(id => !PUBLIC.has(id));
} else {
  ids = args.filter(a => !a.startsWith("-"));
  if (!ids.length) {
    console.error("usage: pack.mjs <course-id>… | --private");
    console.error("available: " + all.join(", "));
    process.exit(1);
  }
}

const unknown = ids.filter(id => !all.includes(id));
if (unknown.length) { console.error(`no such course: ${unknown.join(", ")}`); process.exit(1); }

mkdirSync(OUT, { recursive: true });
for (const id of ids) {
  const { course, errors } = loadCourse(join(COURSES, id));
  if (errors.length) {
    console.error(`FAIL  ${id}`); errors.forEach(e => console.error("       ✗ " + e));
    process.exit(1);
  }
  const files = courseFiles(join(COURSES, id), m => { console.error(`${id}: ${m}`); process.exit(1); });
  const out = join(OUT, `${id}.course.json`);
  const body = JSON.stringify(files);
  writeFileSync(out, body);
  console.log(`  ${id.padEnd(12)} ${String(Object.keys(files).length).padStart(3)} files · ` +
    `${(statSync(out).size / 1024).toFixed(0)}KB · ` +
    `${(gzipSync(body).length / 1024).toFixed(0)}KB gzipped -> packed/${id}.course.json`);
}
console.log(`\nOpen these from the app's library to install them on a device.`);
