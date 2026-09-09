#!/usr/bin/env node
/* Validates course data. Reads the source folder, not the built page, so
 * failures name something you can actually open and fix.
 *
 *   node tools/validate.mjs [course …]
 *
 * Invariants (the id is the rule in code_truth.md / material_truth.md):
 *   1. every <c k="…"> concept reference resolves to a definition       (M14)
 *   2. every href="#…" cross-link resolves to a section or subsection   (M14)
 *   3. every subsection has at least one question                       (M4)
 *   4. no question type repeats inside a subsection                     (M5)
 *   5. every question has type, q, a and why                           (M6)
 *   6. a question's `concept:` names a concept the course defines       (M6)
 *   7. every block declares a type the engine can render                (T19)
 *   8. every subsection names at least one term with a def block        (M8)
 *   9. every image carries alt text                                     (M19)
 *  10. concepts defined but never referenced are reported (warning)     (M13)
 *  11. every <f k="…"> resolves to a figure declaring that id           (M14)
 *  12. figure ids are unique within a course                            (M14)
 *  13. every section declares a title and a blurb of its own            (M15)
 *  14. every <m>…</m> and every math block parses as TeX                (T30)
 *  15. no <m> inside a table whose cells are escaped (mono/map tables)  (T30)
 *  16. every authored HTML field escapes a bare < or & as an entity     (T25)
 *  17. every plot series function compiles and yields a finite point    (T30)
 *  18. no two courses share a `code` (learner state is keyed on it)     (T25)
 *  19. no two courses share a `theme.hue` (warning — they look alike)   (T27)
 *  20. every block declares a tier the lane selector knows              (M23)
 *  21. an `attempt` block only ever opens a subsection                  (M10)
 *  22. every figure a spine block cites is declared by a spine block    (M23, T33)
 *  23. every concept marked `review: true` owns a drill file            (M31)
 *  24. a drill file whose concept is not marked for review (warning)    (M31)
 *  25. a non-empty review set declares its basis in expectations.md     (M31, M3)
 *  26. every reviewed concept carries three items in two formats        (M26)
 *  27. drill answers are distinct within a concept, and not in the stem (M26)
 *  28. every drill item names a concept that resolves                   (M27)
 *  29. a reviewed concept cited only outside the spine (warning)        (M25)
 *  30. `confusable_with` resolves, and is symmetric                     (T16)
 *  31. every primer prequestion asks something and answers it          (M29)
 *  32. no course is named `review` — the review route owns that id      (architecture §2)
 *  33. every figure spec key, enum value and format is one the engine reads (T30)
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCourse } from "./lib/load.mjs";
import { tex } from "./lib/math.mjs";
import { INTERACTIVE } from "../src/blocks/interactive.js";
import { checkFigure } from "./lib/figures.mjs";
import { TIERS, tierOf } from "../src/lib/tiers.js";
import { textOf } from "../src/lib/util.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COURSES = join(ROOT, "courses");

/* Renderable block types, read from the source so the list cannot drift from
   the code. Figure kinds are checked by lib/figures.mjs, against the registry
   itself rather than a directory listing: `src/figures/` also holds shared
   helpers, and a listing minus a hand-kept exclude list would have made every
   new helper a "valid" kind that renders nothing. */
const coreBlocks = readFileSync(join(ROOT, "src/blocks/index.js"), "utf8");
const KNOWN = new Set([...[...coreBlocks.matchAll(/\bR\("([a-z]+)"/g)].map(m => m[1]), ...INTERACTIVE]);

const wanted = process.argv.slice(2);
const courses = existsSync(COURSES)
  ? readdirSync(COURSES, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith("_")).map(d => d.name)
      .filter(n => !wanted.length || wanted.includes(n))
  : [];

/* ids of every course on disk (not just the ones being validated), so
   cross-course links resolve even when validating a single course */
const allCourseIds = existsSync(COURSES)
  ? readdirSync(COURSES, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith("_")).map(d => d.name)
  : [];
const otherIds = {};
/* Two things must not collide across courses, and neither is guaranteed by
   the filesystem the way a folder name is:
     `code` — learner state (quiz history and the spaced-review schedule) is
       stored under a key derived from it, so two courses sharing one share a
       reader's progress, silently and destructively.
     `theme.hue` — one angle is a course's whole visual identity, so two
       courses sharing one are indistinguishable in the library. */
const byCode = {}, byHue = {};
for (const cid of allCourseIds) {
  try {
    const { course } = loadCourse(join(COURSES, cid));
    const set = new Set();
    course.sections.forEach(s2 => { set.add(s2.id); s2.subs.forEach(u => set.add(u.id)); });
    otherIds[cid] = set;
    (byCode[String(course.code || cid).replace(/\s+/g, "")] ||= []).push(cid);
    (byHue[Number(course.theme && course.theme.hue) || 0] ||= []).push(cid);
  } catch { /* reported when that course is validated */ }
}

/* The first mechanical check M2 has ever had: a reader who never expands a
   stub must still be able to follow every figure the spine cites. Depth and
   apply may lean on the spine; the spine may never lean on them. */
function checkSpineStandsAlone(C, errs) {
  const spineFigs = new Set();
  for (const s of C.sections)
    for (const u of s.subs)
      for (const b of u.blocks || [])
        if (b && b.id && tierOf(b) === "spine") spineFigs.add(b.id);

  for (const s of C.sections)
    for (const u of s.subs)
      for (const b of u.blocks || []) {
        if (!b || tierOf(b) !== "spine") continue;
        for (const m of textOf(b).matchAll(/<f\s+k="([^"]+)"/g))
          if (!spineFigs.has(m[1]))
            errs.push(`${u.id}: a spine block cites figure "${m[1]}", which only exists in a collapsed tier`);
      }
}

const FORMATS = new Set(["multiple-choice", "short-answer", "cued-recall", "derivation", "numeric"]);
const DRILL_MIN = 3;   /* the criterion count: fewer and the reader learns one question */

function checkDrills(C, errs, warns) {
  const bank = C.drills || {};
  if (!Object.keys(bank).length) return;   /* no bank yet: Loop B simply hides */
  const examFormats = new Set((C.exam || {}).format || []);

  for (const [key, file] of Object.entries(bank)) {
    const at = `drills/${key}`;
    if (!C.concepts[key]) { errs.push(`${at}: names concept "${key}", which no concepts/ file defines`); continue; }
    const items = file.items || [];
    if (items.length < DRILL_MIN)
      errs.push(`${at}: ${items.length} item(s) — the criterion needs ${DRILL_MIN} different ones`);

    const formats = new Set(), answers = new Set();
    items.forEach((it, i) => {
      const where = `${at} item ${i + 1}`;
      if (!String(it.stem || "").trim()) errs.push(`${where}: no stem`);
      if (!String(it.answer || "").trim()) errs.push(`${where}: no answer`);
      if (!(it.steps || []).length) errs.push(`${where}: no worked steps — M11 wants it reconstructible`);
      if (!FORMATS.has(it.format)) errs.push(`${where}: unknown format "${it.format}"`);
      formats.add(it.format);
      const a = String(it.answer || "").trim().toLowerCase();
      if (answers.has(a)) errs.push(`${where}: another item in this file has the same answer`);
      answers.add(a);
      if (a.length > 3 && String(it.stem || "").toLowerCase().includes(a))
        errs.push(`${where}: the stem contains the answer`);
      if (!it.verified) warns.push(`${where}: no verified: date — it counts as unverified`);
    });

    if (formats.size < 2) errs.push(`${at}: every item is ${[...formats][0]} — practice format has to vary`);
    if (examFormats.size && ![...formats].some(f => examFormats.has(f)))
      errs.push(`${at}: no item matches the exam format (${[...examFormats].join(", ")})`);
  }
}

/* M31: the review set is declared, never inferred. `review: true` is the
   declaration and a drill file is what it costs (M26), so the two are one fact
   and are checked against each other. The basis is the third part — without it
   the set is the author guessing about six weeks from now, unrecorded. */
function checkReviewSet(C, errs, warns) {
  const reviewed = Object.entries(C.concepts || {}).filter(([, c]) => c && c.review).map(([k]) => k);

  for (const key of reviewed)
    if (!C.drills[key])
      errs.push(`concepts/${key}: review: true with no drills/${key}.yaml — ` +
        `a reviewed concept owes ${DRILL_MIN} worked items`);

  /* The converse is a warning rather than an error: an undeclared bank is a
     course whose review set drifted out of its own record, which is worth
     saying, but the bank still works and no reader sees the discrepancy. */
  for (const key of Object.keys(C.drills))
    if (C.concepts[key] && !C.concepts[key].review)
      warns.push(`drills/${key}: the concept is not marked review: true — ` +
        `the drill bank and the declared review set disagree`);

  if (reviewed.length && !C.reviewBasis)
    errs.push(`materials/expectations.md: ${reviewed.length} concept(s) are marked for review ` +
      `but no review.basis says on what grounds — an undeclared set cannot be revised`);
}

/* M25: nothing examinable lives in a collapsed tier. Coverage is not
   mechanically visible — a concept can be taught in prose that never links it —
   so what is checked is the citation graph, which is the reader's own route to
   the definition: a concept the exam can test whose every mention sits outside
   the spine is one a spine-only reader never gets a link to. A warning, because
   the definition site may legitimately be spine prose that names no key. */
function checkExaminableInSpine(C, warns) {
  const examFormats = new Set((C.exam || {}).format || []);
  if (!examFormats.size) return;

  /* one pass over the blocks, collecting the tiers each concept is cited from */
  const tiersOf = {};
  for (const s of C.sections)
    for (const u of s.subs)
      for (const b of u.blocks || []) {
        if (!b) continue;
        for (const m of textOf(b).matchAll(/<c\s+k="([^"]+)"/g))
          (tiersOf[m[1]] ||= new Set()).add(tierOf(b));
      }

  for (const [key, file] of Object.entries(C.drills)) {
    if (!(file.items || []).some(it => examFormats.has(it.format))) continue;
    const tiers = tiersOf[key];
    if (tiers && !tiers.has("spine"))
      warns.push(`concepts/${key}: the exam can test it, but every block citing it is ` +
        `${[...tiers].join("/")} — a spine-only reader never meets it (M25)`);
  }
}

/* Interleaving pays on confusable pairs and costs on unrelated ones, so the
   pairing has to be declared — and a pair that only one side declares is a
   half-built cluster that mixes one way and not the other. */
function checkClusters(C, errs) {
  for (const [key, c] of Object.entries(C.concepts || {}))
    for (const other of c.confusable_with || []) {
      const o = (C.concepts || {})[other];
      if (!o) { errs.push(`concepts/${key}: confusable_with "${other}", which is not a concept`); continue; }
      if (!(o.confusable_with || []).includes(key))
        errs.push(`concepts/${key} and concepts/${other}: confusable_with must name each other`);
    }
}

/* M29: a primer prequestions a relation, and the correction is not optional.
   An uncorrected conceptual pretest error is more likely to be repeated later
   than one never asked, so a prequestion without an answer is worse than none. */
function checkPrimers(C, errs) {
  for (const s of C.sections)
    (s.primer || []).forEach((q, i) => {
      const where = `${s.id} primer ${i + 1}`;
      if (!String(q.ask || "").trim()) errs.push(`${where}: no question`);
      if (!String(q.answer || "").trim())
        errs.push(`${where}: no answer — an uncorrected conceptual pretest error is worse than none`);
    });
}

let failed = 0;

for (const id of courses) {
  const errs = [], warns = [];
  let C;
  try { const r = loadCourse(join(COURSES, id)); C = r.course; errs.push(...r.errors); }
  catch (e) { console.log(`FAIL ${id}  ${e.message}`); failed++; continue; }

  const extraBlocks = existsSync(join(COURSES, id, "blocks.js"))
    ? new Set([...readFileSync(join(COURSES, id, "blocks.js"), "utf8")
        .matchAll(/register\(\s*"([a-z]+)"/g)].map(m => m[1]))
    : new Set();

  const ids = new Set();
  C.sections.forEach(s => { ids.add(s.id); s.subs.forEach(u => ids.add(u.id)); });

  if (id === "review")
    errs.push(`"review" is the cross-course review route, so it cannot also be a course id`);

  const sharesCode = (byCode[String(C.code || id).replace(/\s+/g, "")] || []).filter(x => x !== id);
  if (sharesCode.length)
    errs.push(`code "${C.code}" is also used by ${sharesCode.join(", ")} — learner state is keyed on it, ` +
      `so both courses would share one reader's quiz history and review schedule`);
  const sharesHue = (byHue[Number(C.theme && C.theme.hue) || 0] || []).filter(x => x !== id);
  if (sharesHue.length)
    warns.push(`theme.hue ${Number(C.theme && C.theme.hue) || 0} is also used by ${sharesHue.join(", ")} — ` +
      `the two are indistinguishable in the library; pick another angle`);

  /* `syntax.patterns[].re` is the other authored expression nothing compiled:
     the highlighter builds one regex per rule, so a pattern that does not
     parse is dropped, and the course simply renders with that rule missing.
     Same defect shape as a plot's fn below, so it is caught the same way. */
  for (const pat of (C.syntax && C.syntax.patterns) || []) {
    try { new RegExp(pat.re); }
    catch (e) { errs.push(`syntax pattern "${pat.re}" does not parse — ${e.message}`); }
  }

  /* A section with no _section.yaml falls back to its folder name, which then
     shows up in the sidebar as "03-systematic-analysis". The blurb is what the
     course home and the section head read from, so an absent one leaves a
     visible gap rather than a graceful default. */
  for (const s2 of C.sections) {
    const slug = /^\d+[-_]/.test(s2.title) || /[a-z]-[a-z]/.test(s2.title) && s2.title === s2.title.toLowerCase();
    if (!s2.title || slug)
      errs.push(`${s2.id}: no title — add _section.yaml (showing "${s2.title}")`);
    if (!String(s2.blurb || "").trim())
      errs.push(`${s2.id} "${s2.title}": no blurb — the section head and course contents both render it`);
  }

  const defined = new Set(Object.keys(C.concepts || {}));
  const used = new Set();
  let qCount = 0;

  /* figures earn a citable key by declaring `id`; prose cites them as <f k="…"> */
  const figIds = new Set();
  for (const s2 of C.sections) {
    for (const u of s2.subs) {
      for (const b of u.blocks || []) {
        if (!b || (b.t !== "figure" && b.t !== "image") || !b.id) continue;
        if (figIds.has(b.id)) errs.push(`${u.id}: two figures both claim id "${b.id}"`);
        figIds.add(b.id);
      }
    }
  }

  for (const s of C.sections) {
    for (const u of s.subs) {
      const where = `${u.id} "${u.title}"`;

      let namedTerms = 0;
      for (const b of u.blocks || []) {
        if (!b || !b.t) { errs.push(`${where}: a block has no type`); continue; }
        if (!KNOWN.has(b.t) && !extraBlocks.has(b.t)) errs.push(`${where}: unknown block type "${b.t}"`);
        /* A spec is the one authored payload the renderer picks over rather
           than validating, so a key it has never heard of draws nothing and
           says nothing. lib/figures.mjs holds the whole check. */
        if (b.t === "figure") checkFigure(b, where, errs);
        if (b.tier && !TIERS.includes(b.tier))
          errs.push(`${where}: unknown tier "${b.tier}" — one of ${TIERS.join(", ")}`);
        /* An attempt is a deliberate failure that primes the definition, which
           only works before the definition. Anywhere else it is an exception
           met before its rule, which is what M10's ordering exists to stop. */
        if (b.t === "attempt" && u.blocks.indexOf(b) !== 0)
          errs.push(`${where}: an "attempt" block may only be the first block of a subsection`);
        if (b.t === "def" && b.term) namedTerms++;
        /* M19: a figure nobody can read is not a learning aid */
        if (b.t === "image" && !String(b.alt || "").trim())
          errs.push(`${where}: image "${b.src}" has no alt text`);

        if (b.t === "math") {
          if (!String(b.tex || "").trim()) errs.push(`${where}: a math block has no "tex"`);
          else try { tex(b.tex, true); }
               catch (e) { errs.push(`${where}: math "${String(b.tex).trim()}" — ${e.message.replace(/\s+/g, " ")}`); }
        }
        /* a mono or mapped table escapes its cells, so rendered TeX would show
           as markup rather than as an equation */
        if (b.t === "table" && (b.mono || b.map) &&
            JSON.stringify(b.rows || []).includes("<m>"))
          errs.push(`${where}: <m> inside a mono/map table — its cells are escaped`);
      }
      /* M8: named terms are what the pre-training panel and primer are built
         from, so a subsection naming none silently degrades its section */
      if (!namedTerms)
        errs.push(`${where}: names no term with a def block — its section's primer loses coverage`);

      const q = u.quiz || [];
      if (!q.length) errs.push(`${where}: no questions`);
      const seenType = new Set();
      for (const item of q) {
        qCount++;
        const t = String(item.type || "").trim().toLowerCase();
        if (!t) { errs.push(`${where}: a question has no type`); continue; }
        if (seenType.has(t)) errs.push(`${where}: repeats question type "${item.type}"`);
        seenType.add(t);
        for (const k of ["q", "a", "why"])
          if (!item[k] || !String(item[k]).trim()) errs.push(`${where}: question "${item.type}" missing "${k}"`);
        /* The retention identity (M6). A key that names nothing never recruits,
           and nothing on the page says so — audit-content.mjs counts items that
           resolve to no concept; this catches the ones that are simply typos. */
        if (item.concept && !defined.has(item.concept))
          errs.push(`${where}: question "${item.type}" names concept "${item.concept}", which no concepts/ file defines`);
      }

      /* Authored fields are injected as HTML, so a bare `<` swallows the rest
         of the sentence and a bare `&` is a broken entity. Both render as a
         silent hole rather than an error, which is why this is checked here.
         `a`, `cap`, `label` and an example's `title` used to be escaped; the
         rule is what makes it safe that they no longer are. */
      const HTML_FIELDS = ["h", "q", "a", "why", "cap", "label", "title", "note"];
      /* Only the genuinely ambiguous shapes. An HTML parser emits `<` before a
         space or an `=` as text, so `b <= a` and `j < i` are safe and must not
         be flagged; `x <id` is not, because it opens a tag. Likewise `a & b`
         is text, while `&amp` without its semicolon is not. */
      const TAGS = "a|b|br|c|code|em|f|i|li|m|ol|p|span|strong|sub|sup|ul";
      const bare = new RegExp(`</?(?!(?:${TAGS})[\\s/>])[a-zA-Z]|&(?![a-zA-Z#][0-9a-zA-Z]*;)[a-zA-Z#]`);
      const checkHtml = (v, what) => {
        if (typeof v !== "string") return;
        /* inside <m> the content is TeX, not HTML — `<` and `&` are the
           author's operators there and the maths pass consumes them before
           anything reaches the DOM */
        v = v.replace(/<m>[\s\S]*?<\/m>/g, m => " ".repeat(m.length));
        if (!bare.test(v)) return;
        const at = v.search(bare);
        errs.push(`${what}: bare "${v[at]}" in HTML — write &lt; or &amp;  …${v.slice(Math.max(0, at - 24), at + 24)}…`);
      };
      for (const b of u.blocks || []) {
        if (!b) continue;
        for (const k of HTML_FIELDS) if (b[k] != null) checkHtml(b[k], `${where} ${b.t}.${k}`);
        for (const row of b.rows || []) for (const c of row) checkHtml(c, `${where} ${b.t} cell`);
      }
      for (const item of u.quiz || [])
        for (const k of HTML_FIELDS) if (item[k] != null) checkHtml(item[k], `${where} quiz "${item.type}".${k}`);

      const text = textOf(u);
      for (const m of text.matchAll(/<m>([\s\S]*?)<\/m>/g)) {
        try { tex(m[1], false); }
        catch (e) { errs.push(`${where}: math "${m[1].trim()}" — ${e.message.replace(/\s+/g, " ")}`); }
      }
      for (const m of text.matchAll(/<c\s+k="([^"]+)"/g)) {
        used.add(m[1]);
        if (!defined.has(m[1])) errs.push(`${where}: concept "${m[1]}" has no definition`);
      }
      for (const m of text.matchAll(/<f\s+k="([^"]+)"/g)) {
        if (!figIds.has(m[1])) errs.push(`${where}: figure reference "${m[1]}" matches no figure id`);
      }
      for (const m of text.matchAll(/href="#([^"]+)"/g)) {
        const target = m[1];
        if (target.startsWith("/")) {
          /* cross-course: #/<course>/<id> — resolve against that course */
          const [, other, ...rest] = target.split("/");
          const id = rest.join("/");
          if (!otherIds[other]) { errs.push(`${where}: link to unknown course "${other}"`); continue; }
          if (id && !otherIds[other].has(id) && !id.startsWith("c/"))
            errs.push(`${where}: cross-course link "#${target}" points at nothing in ${other}`);
          continue;
        }
        if (!ids.has(target)) errs.push(`${where}: cross-link "#${target}" points at nothing`);
      }
    }
  }

  checkSpineStandsAlone(C, errs);
  checkReviewSet(C, errs, warns);
  checkDrills(C, errs, warns);
  checkExaminableInSpine(C, warns);
  checkClusters(C, errs);
  checkPrimers(C, errs);

  for (const c of Object.values(C.concepts || {})) {
    for (const m of String(c.body || "").matchAll(/<c\s+k="([^"]+)"/g)) {
      used.add(m[1]);
      if (!defined.has(m[1])) errs.push(`concept card references undefined concept "${m[1]}"`);
    }
  }
  for (const k of defined) if (!used.has(k)) warns.push(`concept "${k}" is defined but never referenced`);

  const subs = C.sections.reduce((n, s) => n + s.subs.length, 0);
  failed += errs.length;
  console.log(`${errs.length ? "FAIL" : "ok  "} ${id.padEnd(10)} ` +
    `${C.sections.length} sections · ${subs} subsections · ${qCount} questions · ${defined.size} concepts`);
  errs.forEach(e => console.log("       ✗ " + e));
  warns.forEach(w => console.log("       ! " + w));
}

if (!courses.length) console.log("no courses found");
process.exit(failed ? 1 : 0);
