#!/usr/bin/env node
/* What the structural gates cannot see: whether the content is true.
 *
 *   node tools/audit-content.mjs [course …]
 *
 * validate.mjs checks that references resolve, figures carry ids and equations
 * compile. It checks structure, never truth. A confident, well-formatted, wrong
 * account of amortised analysis fails no gate at all, and the reader cannot
 * tell, because everything else about the page has been verified to a high
 * standard.
 *
 * So every explanatory claim names where it came from, every worked answer
 * names the date it was re-derived, every question carries the specific prompt
 * the reader answers before the reveal, and every question names the concept a
 * confident miss should recruit. What is missing is counted as a fraction, and
 * a course fails above the ceiling it declares.
 *
 * The ceiling is per course, in `course.yaml`, and defaults to 1 — report
 * only — because these fractions are content debt that lands course by course:
 *
 *   audit:
 *     unsourced: 0.1     # fail if more than a tenth of claims name no source
 *     unverified: 0      # every answer carries a re-derivation date
 *
 * A course that has finished a pass declares the number it reached, and can
 * then never regress. A global ceiling could only ever be the worst course's.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCourse } from "./lib/load.mjs";
import { conceptOf } from "../src/lib/index.js";
import { present } from "../src/lib/gist.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COURSES = join(ROOT, "courses");

/* Claims that assert something the reader will rely on. Prose carries the
   argument; these carry the conclusions, and a wrong conclusion is the one a
   reader cannot catch by reading around it. */
const CLAIM = new Set(["def", "key", "trap"]);

/* `source:` values that are a confession rather than an origin. `generated`
   counts against the fraction exactly as `unverified` does: a def block a model
   drafted is an unverified claim wearing an authored block's styling, which is
   the one thing the source field exists to prevent (M30, T34). */
const UNSOURCED = new Set(["unverified", "generated"]);

/* What is measured, in the order it is printed. Each is a fraction of a
   population, so a course with none of that population scores 0. */
const METRICS = [
  ["unsourced",  "claims name no source"],
  ["unverified", "answers carry no re-derivation date"],
  ["unprompted", "questions carry no why_prompt"],
  ["unrouted",   "questions resolve to no concept"],
  ["unclaimed",  "claims declare neither core: nor gist:"],
  ["repeat",     "claims restate themselves in a gist: rather than splitting a core:"],
  ["nameonly",   "blocks say nothing at notes depth until they are opened"]
];

const pct = x => `${Math.round(x * 100)}%`;

/* M33, heuristically. A stated constant, threshold or boundary that is never
   retrieved is a sentence, not a memory, and cued recall is the format that
   retrieves one. Detecting "a specific value" cannot be exact — a sign
   convention carries no digit — so this warns and never fails. */
function detailsWithoutRecall(C) {
  const out = [];
  for (const [key, file] of Object.entries(C.drills)) {
    if ((file.items || []).some(it => it.format === "cued-recall")) continue;
    const cited = C.sections.some(s => s.subs.some(u => (u.blocks || []).some(b =>
      b && b.t === "key" && String(b.h || "").includes(`k="${key}"`) && /\d/.test(String(b.h)))));
    if (cited) out.push(key);
  }
  return out;
}

function audit(id) {
  const { course: C } = loadCourse(join(COURSES, id));
  const n = { claims: 0, answers: 0, quiz: 0 };
  const miss = { unsourced: 0, unverified: 0, unprompted: 0, unrouted: 0,
                 unclaimed: 0, repeat: 0, nameonly: 0 };
  let blocks = 0;

  for (const s of C.sections)
    for (const u of s.subs) {
      for (const b of u.blocks || []) {
        /* A row that shows only its own label is a row the reader has to open
           before it tells them anything, which is the one thing notes depth is
           not for. Counted over every block the depth can show — a `p` is
           excluded because it is hidden there by rule (M36).

           A caption row is not counted, and that is a judgement the script
           cannot make for itself: "mono table — centred cells, course
           valueStyles applied" says what the table holds, and "What each
           surface is for" names a topic and answers nothing. Both are captions.
           Whether one earns its row is the author's call, which is why §6.7
           asks for it rather than the gate. */
        if (b.t !== "p") {
          blocks++;
          if (present(b, "notes").mode === "closed") miss.nameonly++;
        }
        if (!CLAIM.has(b.t)) continue;
        n.claims++;
        if (!String(b.source || "").trim() || UNSOURCED.has(b.source)) miss.unsourced++;
        /* A claim with neither field states nothing at `notes` depth and
           closes to its own label, so the reader gets a name where a claim
           was promised. Counted rather than failed, because a course written
           before depth existed has every block in this state and must keep
           rendering. */
        if (!String(b.core || "").trim() && !String(b.gist || "").trim()) miss.unclaimed++;
        /* `gist:` is a second copy, permitted where claim-first would spoil the
           first read and nowhere else. Left ungated it becomes the default,
           because it is the easier of the two to write: no prose discipline,
           just a summary. So it is a declared fraction with a ceiling, like
           every other piece of content debt here. */
        else if (String(b.gist || "").trim()) miss.repeat++;
      }
      for (const q of u.quiz || []) {
        n.quiz++; n.answers++;
        if (!q.verified) miss.unverified++;
        if (!String(q.why_prompt || "").trim()) miss.unprompted++;
        /* The seam only fires where a quiz item resolves to a concept with a
           bank, so a course with no bank has nothing to route to and scores 0
           rather than 100% (T18, M6). */
        if (C.drills && Object.keys(C.drills).length && !conceptOf(C, q, u)) miss.unrouted++;
      }
    }

  for (const file of Object.values(C.drills))
    for (const it of file.items || []) { n.answers++; if (!it.verified) miss.unverified++; }

  const of = { unsourced: n.claims, unverified: n.answers, unprompted: n.quiz, unrouted: n.quiz,
               unclaimed: n.claims, repeat: n.claims, nameonly: blocks };
  const ceiling = C.audit || {};
  const rows = METRICS.map(([k, label]) => ({
    k, label, of: of[k],
    frac: of[k] ? miss[k] / of[k] : 0,
    max: ceiling[k] != null ? Number(ceiling[k]) : 1
  }));

  return { C, rows, over: rows.filter(r => r.frac > r.max), details: detailsWithoutRecall(C) };
}

const wanted = process.argv.slice(2);
const ids = readdirSync(COURSES, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith("_")).map(d => d.name)
  .filter(n => !wanted.length || wanted.includes(n));

let failed = 0;
for (const id of ids) {
  const { rows, over, details } = audit(id);
  if (over.length) failed++;

  console.log(`${over.length ? "FAIL" : "ok  "} ${id.padEnd(10)} ` +
    rows.map(r => `${pct(r.frac)} of ${r.of} ${r.k}`).join(" · "));
  for (const r of over)
    console.log(`       ✗ ${pct(r.frac)} ${r.label} — this course declares a ceiling of ${pct(r.max)}`);
  for (const key of details)
    console.log(`       ! drills/${key}: a key block states a value and no item cues it back (M33)`);
}

process.exit(failed ? 1 : 0);
