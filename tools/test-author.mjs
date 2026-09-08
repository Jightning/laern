#!/usr/bin/env node
/* The authoring pipeline's two contracts that no browser can reach.
 *
 *   node tools/test-author.mjs
 *
 * 1. The reader profile is refused rather than guessed. It is the one input
 *    every prompt carries and the one nothing downstream can check: a course
 *    written against a placeholder is calibrated to nobody, and it fails in the
 *    files it produced rather than at the moment the profile went missing.
 * 2. The spec still slices. Phases address create_course.md by heading id, so
 *    renaming a heading silently empties a prompt — the prefix would still
 *    build, just without the rules it was supposed to carry.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readReader, peekReader } from "./lib/reader.mjs";
import { loadSpec } from "./lib/spec.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = [];
const ck = (n, ok, x = "") => R.push({ n, ok, x });
const threw = fn => { try { fn(); return null; } catch (e) { return e.message; } };

const tmp = mkdtempSync(join(tmpdir(), "author-"));
const at = (name, body) => { const p = join(tmp, name); writeFileSync(p, body); return p; };

/* ------------------------------------------------------------ the profile --*/
const missing = threw(() => readReader(join(tmp, "nope.yaml")));
ck("a missing profile is refused", !!missing && /does not exist/.test(missing));
ck("and the refusal says where to get one", !!missing && /courses\/_reader\.yaml/.test(missing));

const blank = threw(() => readReader(at("blank.yaml",
  "reader:\n  background: UNSET\n  failures: UNSET\n")));
ck("a half-filled profile is refused", !!blank && /2 UNSET fields/.test(blank), blank);

const wrong = threw(() => readReader(at("wrong.yaml", "notes: something else\n")));
ck("a file that is not a profile is refused", !!wrong && /no `reader:` block/.test(wrong));

const good = at("good.yaml", "reader:\n  background: holds calculus\n  failures: [transfer]\n");
ck("a filled profile is returned as written",
   readReader(good).startsWith("reader:") && /transfer/.test(readReader(good)));

/* A cost estimate is not a prompt, so it must survive what a prompt refuses. */
ck("costing the work tolerates a missing profile",
   peekReader(join(tmp, "nope.yaml")) === "reader: UNSET");

/* ------------------------------------------------------------- the slices --*/
const CC = loadSpec(join(ROOT, "docs/create_course.md"));
const MT = loadSpec(join(ROOT, "docs/material_truth.md"));

/* Every heading id named by a phase in author.mjs, read from the file itself so
   this cannot drift from the table it is checking. */
const src = await import("node:fs").then(fs => fs.readFileSync(join(ROOT, "tools/author.mjs"), "utf8"));
const idsIn = key => [...src.matchAll(new RegExp(`${key}: \\[([^\\]]*)\\]`, "g"))]
  .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1].replace(/\*$/, "")));

for (const [name, spec, ids] of [["create_course", CC, idsIn("cc")], ["material_truth", MT, idsIn("mt")]]) {
  const gone = [...new Set(ids)].filter(id => !spec.ids.includes(id));
  ck(`every ${name} heading a phase names still exists`, gone.length === 0,
     gone.length ? "missing: " + gone.join(", ") : [...new Set(ids)].length + " headings");
}

/* §1 is in every phase's prefix, so an empty §1 is an uncalibrated build. */
ck("§1 carries the reader form", /reader:/.test(CC.pick(["1"])));

/* A heading that owns numbered subsections carries its rules in them, not in
   its own preamble: §1's D1-D7 table is §1.1, the drill bank's two hardest
   instructions are §8.1 and §8.2. `pick("8")` returns the preamble alone, so a
   phase naming the parent alone silently ships a prompt with those rules
   missing — the build still passes and the course is simply worse. Naming a
   parent shallow is legal only when the phase also picks subsections of it by
   hand, which is how phase 4 takes §6.1/6.2/6.4 and leaves §6.3 to phase 7. */
const parents = new Set(CC.ids.filter(id => /^\d+\.\d+$/.test(id)).map(id => id.split(".")[0]));
const dropped = [];
for (const m of src.matchAll(/cc: \[([^\]]*)\]/g)) {
  const ids = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  for (const id of ids) {
    if (id.endsWith("*") || !parents.has(id)) continue;
    if (!ids.some(o => o.replace(/\*$/, "").startsWith(id + "."))) dropped.push(id);
  }
}
ck("no phase drops a heading's subsections", dropped.length === 0,
   dropped.length ? "named shallow with no subsection picked: " + [...new Set(dropped)].join(", ")
                  : [...parents].sort().join(",") + " have subsections");

rmSync(tmp, { recursive: true, force: true });

const bad = R.filter(r => !r.ok);
for (const r of bad) console.error(`       ✗ ${r.n}  ${r.x}`);
console.log(`${bad.length ? "FAIL" : "ok  "} author     ${R.length - bad.length}/${R.length} checks`);
process.exitCode = bad.length ? 1 : 0;
