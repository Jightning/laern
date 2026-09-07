#!/usr/bin/env node
/* Put a packed course back on disk, so it can be edited.
 *
 *   node tools/unpack.mjs packed/ma26600.course.json
 *
 * The round trip is the point: export from a device, unpack, let a model edit
 * the YAML one file at a time (see tools/author.mjs), pack, import again. The
 * app never holds anything but these files, so nothing is lost either way.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error("usage: unpack.mjs <file.course.json> [course-id]"); process.exit(1); }

const id = rest[0] || basename(file).replace(/\.course\.json$/, "").replace(/\.json$/, "");
const dest = join(ROOT, "courses", id);
if (existsSync(dest) && !process.argv.includes("--force")) {
  console.error(`courses/${id} exists. Pass --force to overwrite it.`); process.exit(1);
}

let files;
try { files = JSON.parse(readFileSync(file, "utf8")); }
catch (e) { console.error(`${file}: ${e.message}`); process.exit(1); }
if (!files || typeof files !== "object" || Array.isArray(files)) {
  console.error(`${file}: not a map of path to text`); process.exit(1);
}

let n = 0;
for (const [rel, text] of Object.entries(files)) {
  /* A packed file is data from elsewhere: never let a path escape the course. */
  if (typeof text !== "string" || rel.startsWith("/") || rel.split("/").includes("..")) {
    console.error(`refusing suspicious entry: ${rel}`); process.exit(1);
  }
  const out = join(dest, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  n++;
}
console.log(`unpacked ${n} files -> courses/${id}/`);
