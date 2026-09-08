#!/usr/bin/env node
/* ============================================================================
 * tools/author.mjs — drive course authoring one small, resumable unit at a time
 *
 *   node tools/author.mjs plan   <id>          what it will cost, and why
 *   node tools/author.mjs status <id>          what is done, what is left
 *   node tools/author.mjs next   <id> [--raw]  the next unit's prompt
 *   node tools/author.mjs done   <id> <unit>
 *   node tools/author.mjs reset  <id> [phase]
 *
 * The expensive way to author a course is one long conversation: every call
 * resends every earlier answer, so input grows with the square of the work.
 * On ma26600 (~160 units) that is ~15.6M input tokens.
 *
 * Three things fix it, and this file is all three:
 *
 *   1. One call per unit, each independent. Input becomes linear in the work.
 *   2. Each unit gets only the spec headings its phase needs (lib/spec.mjs),
 *      not all 15k tokens of create_course.md + material_truth.md.
 *   3. Prior work arrives as a digest (lib/digest.mjs), not as prose — the
 *      hundredfold saving that makes non-redundancy affordable.
 *
 * Interruption falls out for free. The course folder is the state and the
 * ledger is a list of finished unit ids, so resuming costs one directory walk
 * rather than a replayed transcript. Nothing is held in memory between units.
 * ==========================================================================*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSpec } from "./lib/spec.mjs";
import { digest } from "./lib/digest.mjs";
import { readReader, peekReader } from "./lib/reader.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const est = s => Math.round(s.length / 4);   /* chars/4: an estimate, not a count */

const CC = loadSpec(join(ROOT, "docs/create_course.md"));
const MT = loadSpec(join(ROOT, "docs/material_truth.md"));

/* ---------------------------------------------------------------- reader --
 * Who the course is for. Every phase sends §1, and §1 in the docs is a blank
 * form: the filled-in answer is personal, so it lives beside the courses it
 * calibrates (lib/reader.mjs) rather than in a tracked file.
 */
const READER = join(ROOT, "courses", "_reader.yaml");

/* ---------------------------------------------------------------- phases --
 * `cc` and `mt` name the headings this phase needs; anything not named is not
 * sent. `pick` lists every unit the phase owns and flags the ones already
 * written, so the same table answers both "what is left" and, under --fresh,
 * "what would a build from nothing cost".
 */
const sub = (n, u) => ({ id: `${n}:${u.id}`, target: u.file, sub: u.id });

const PHASES = [
  { n: 1, key: "calibrate", what: "materials/expectations.md",
    cc: ["0", "1", "3", "11*"], mt: ["6*", "9*"],
    pick: d => [{ id: "1:course", target: "materials/expectations.md",
                  written: d.subs.length > 0 }] },

  { n: 2, key: "sequence", what: "sections/NN-slug/_section.yaml",
    cc: ["0", "1", "2", "3"], mt: ["4*"],
    pick: d => [{ id: "2:course", target: "sections/", written: d.subs.length > 0 }] },

  { n: 3, key: "concepts", what: "concepts/<key>.yaml",
    cc: ["0", "1", "5"], mt: ["4*"],
    pick: d => d.concepts.map(c => ({ id: `3:${c.key}`,
      target: `concepts/${c.key}.yaml`, written: c.body })) },

  /* 13* rides along because this is the phase that writes prose. Without it the
     voice rules are a document nothing reads at the moment they apply. */
  { n: 4, key: "spine", what: "spine blocks",
    cc: ["0", "1", "6", "6.1", "6.2", "6.4", "10*", "13*"], mt: ["2*", "3*", "5*"],
    pick: d => d.subs.map(u => ({ ...sub(4, u), written: u.blocks > 0 })) },

  { n: 5, key: "quizzes", what: "quiz items",
    cc: ["0", "1", "6.5", "7", "9"], mt: ["2*"],
    pick: d => d.subs.map(u => ({ ...sub(5, u), written: u.quiz > 0, needs: !u.blocks })) },

  { n: 6, key: "drills", what: "drills/<key>.yaml",
    cc: ["0", "1", "8"], mt: ["8*"],
    pick: d => d.concepts.filter(c => c.review)
      .map(c => ({ id: `6:${c.key}`, target: `drills/${c.key}.yaml`, written: c.drills > 0 })) },

  { n: 7, key: "tiers", what: "depth and apply blocks",
    cc: ["0", "1", "6.3", "13*", "14"], mt: ["7*"],
    pick: d => d.subs.map(u => ({ ...sub(7, u),
      written: u.tiers.size > 1, needs: !u.blocks })) },

  { n: 8, key: "verify", what: "re-derive every answer",
    cc: ["0", "1", "12*"], mt: ["6*", "9*"],
    pick: d => d.subs.map(u => ({ ...sub(8, u), written: false, needs: !u.blocks })) }
];

/* Live: everything unwritten whose prerequisite exists. Fresh: everything. */
const unitsOf = (p, d, led, fresh) =>
  p.pick(d).filter(u => fresh || (!u.written && !u.needs && !led.has(u.id)));

const phaseOf = id => PHASES.find(p => p.n === Number(String(id).split(":")[0]));

/* ---------------------------------------------------------------- ledger --
 * Kept outside courses/ so a course folder stays pure data, and so a stray
 * .json never reaches load.mjs.
 */
const ledgerPath = id => join(ROOT, ".author", `${id}.json`);

function ledger(id) {
  const p = ledgerPath(id);
  const done = existsSync(p) ? new Set(JSON.parse(readFileSync(p, "utf8")).done) : new Set();
  return {
    done,
    has: u => done.has(u),
    mark(u) {
      done.add(u);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ done: [...done] }, null, 2));
    },
    clear(phase) {
      for (const u of [...done]) if (!phase || u.startsWith(phase + ":")) done.delete(u);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ done: [...done] }, null, 2));
    }
  };
}

/* --------------------------------------------------------------- prompts --
 * Two parts, deliberately. `prefix` is identical for every unit in a phase, so
 * it is one cache write and then cache reads at a tenth of the price. `body`
 * is the only thing that varies, and it is kept small on purpose.
 */
function prefix(phase, reader) {
  return [
    "# Authoring spec (excerpt)",
    "",
    "You are writing one unit of a course. Follow these rules exactly.",
    "Emit only the file content asked for. No commentary, no fences.",
    "",
    CC.pick(phase.cc),
    "",
    "# The reader (§1, filled in)",
    "",
    "```yaml",
    reader,
    "```",
    "",
    "# Evidence",
    "",
    MT.pick(phase.mt)
  ].join("\n");
}

function body(phase, unit, d, courseDir) {
  const parts = [`# This unit\n\nPhase ${phase.n} (${phase.key}). Write: ${phase.what}`,
    `Target file: ${unit.target}`];

  /* Coverage is what non-redundancy needs, and all it needs. */
  if (d.text) parts.push(`# Already covered elsewhere in this course\n\n${d.text}`);

  /* Phases that rewrite one subsection need that subsection, and only it. */
  if (unit.sub && phase.n >= 5) {
    const u = d.subs.find(s => s.id === unit.sub);
    if (u && existsSync(u.file)) {
      parts.push(`# Current contents of ${unit.sub}\n\n${readFileSync(u.file, "utf8")}`);
    }
  }

  const src = join(courseDir, "sources", `${unit.sub || "course"}.md`);
  if (existsSync(src)) parts.push(`# Source material\n\n${readFileSync(src, "utf8")}`);
  else parts.push(`# Source material\n\n(none at ${src} — flag anything unverifiable)`);

  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ main --*/
const [cmd, id, ...rest] = process.argv.slice(2);
if (!cmd || !id) {
  console.error("usage: author.mjs <plan|status|next|done|reset> <course-id> [args]");
  process.exit(1);
}
const courseDir = join(ROOT, "courses", id);
if (!existsSync(courseDir)) { console.error(`courses/${id} does not exist`); process.exit(1); }

/* `plan` and `status` describe work rather than emit it, so they cost the
   profile without demanding one. `next` is the command that actually produces
   a prompt, and it stops rather than guessing. */
let reader;
if (cmd === "next") {
  try { reader = readReader(READER); }
  catch (e) { console.error(e.message); process.exit(1); }
} else reader = peekReader(READER);

const d = digest(courseDir);
const led = ledger(id);
const fresh = rest.includes("--fresh");
const pending = PHASES.flatMap(p => unitsOf(p, d, led, false).map(u => ({ ...u, phase: p })));

if (cmd === "plan") {
  const full = est(readFileSync(join(ROOT, "docs/create_course.md"), "utf8")) +
               est(readFileSync(join(ROOT, "docs/material_truth.md"), "utf8"));
  console.log(`courses/${id} — ${d.sections.length} sections, ${d.subs.length} subsections, ` +
              `${d.concepts.length} concepts` + (fresh ? "   [full build]" : "   [remaining]") + "\n");
  console.log("phase                units   prefix   body   per-unit   phase total");
  console.log("-".repeat(70));
  let total = 0, naiveSpec = 0, units = 0;
  for (const p of PHASES) {
    const us = unitsOf(p, d, led, fresh);
    if (!us.length) continue;
    const pre = est(prefix(p, reader));
    const bod = Math.round(us.reduce((n, u) => n + est(body(p, u, d, courseDir)), 0) / us.length);
    const cost = pre + bod * us.length;         /* prefix cached after unit 1 */
    total += cost; naiveSpec += (full + bod) * us.length; units += us.length;
    console.log(`${String(p.n) + " " + p.key}`.padEnd(20) +
      String(us.length).padStart(5) + String(pre).padStart(9) +
      String(bod).padStart(7) + String(pre + bod).padStart(11) + String(cost).padStart(14));
  }
  const conv = units * full + 1000 * (units * (units - 1) / 2);
  console.log("-".repeat(70));
  console.log(`sliced spec + digest, prefix cached:       ${String(total).padStart(10)} tok  1.0x`);
  console.log(`same units, full spec resent every call:   ${String(naiveSpec).padStart(10)} tok  ` +
    `${(naiveSpec / total).toFixed(1)}x`);
  console.log(`one growing conversation (~1k out/unit):   ${String(conv).padStart(10)} tok  ` +
    `${(conv / total).toFixed(1)}x`);
  console.log(`\n${units} units. Estimates are chars/4; --fresh uses the finished ` +
    `digest, so early units are overstated.`);
}

if (cmd === "status") {
  for (const p of PHASES) {
    const all = p.pick(d);
    const left = unitsOf(p, d, led, false).length;
    if (!all.length) continue;
    console.log(`${p.n} ${p.key.padEnd(10)} ${all.length - left}/${all.length}` +
      (left ? `   next: ${unitsOf(p, d, led, false)[0].id}` : "   complete"));
  }
  console.log(pending.length ? `\n${pending.length} units pending` : "\nnothing pending");
}

if (cmd === "next") {
  const u = pending[0];
  if (!u) { console.log("nothing pending"); process.exit(0); }
  const pre = prefix(u.phase, reader), bod = body(u.phase, u, d, courseDir);
  if (rest.includes("--raw")) { console.log(pre + "\n\n" + bod); process.exit(0); }
  console.error(`unit ${u.id} -> ${u.target}   prefix ~${est(pre)} tok (cacheable), ` +
                `body ~${est(bod)} tok`);
  console.log(pre + "\n\n" + bod);
}

if (cmd === "done") {
  const u = rest[0];
  if (!u) { console.error("usage: author.mjs done <course-id> <unit-id>"); process.exit(1); }
  if (!phaseOf(u)) { console.error(`"${u}" names no phase`); process.exit(1); }
  led.mark(u);
  console.log(`marked ${u}`);
}

if (cmd === "reset") { led.clear(rest[0]); console.log(`cleared ${rest[0] || "everything"}`); }
