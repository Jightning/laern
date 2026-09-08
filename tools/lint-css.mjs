#!/usr/bin/env node
/* Duplicate-selector lint.
 *
 * Three defects in this project came from the same shape: a correction
 * appended to the bottom of a stylesheet, redeclaring a selector already
 * defined above it. The later rule silently wins, the earlier one becomes
 * dead, and nothing says so — a sticky sidebar turned relative, a figure's
 * number lost its centring, a rail number only took its layout on hover.
 *
 * A selector may legitimately appear twice inside different @media blocks, so
 * only top-level rules are compared, and only within one file. T22 says a
 * stylesheet covers one UI element; T25 says a rule that can be checked
 * mechanically must be.
 *
 * The second shape is the mirror of the first: a rule that silently loses. A
 * var() naming a token nothing declares makes its declaration invalid at
 * computed-value time, and the browser drops it whole — the rest of the
 * shorthand with it. Five were live at once in the library and sync panels:
 * `var(--serif)` voided two `font` shorthands, so 14px captions rendered at
 * 17px, and `var(--accent)` voided an `outline`, so a focus ring disappeared.
 *
 * A fallback does not rescue it, it hides it: `var(--warn, #b91c1c)` painted a
 * hardcoded red that tracks no theme and measured 2.87:1 on the dark ground,
 * the one AA failure in the sweep. So a missing token is reported whether or
 * not a fallback stands behind it — under T3 the fallback is itself the defect.
 *
 * The third shape is a rule that was never written. A class the engine emits
 * with no rule behind it renders as unstyled markup and reports nothing at
 * all: `syntax:` had been a documented course field for as long as the
 * highlighter existed, and every `tok-c`/`tok-k`/`tok-n`/`tok-s` span it
 * produced was flat body text; a table's `split:` marked a column and drew no
 * rule; the one text box in the primer sat at the browser default inside a
 * designed card. Each looked like a course that had not configured the
 * feature.
 *
 * Nothing reported any of this on its own: the CSS parses, the token is simply
 * never there, and the missing rule is simply never written.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src", "css");
const SRC = join(ROOT, "src");

/** top-level selectors of one stylesheet, with the line each starts on */
function topLevelRules(css) {
  const out = [];
  let depth = 0, start = 0, line = 1, startLine = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") line++;
    if (c === "{") {
      if (depth === 0) { out.push({ sel: css.slice(start, i), line: startLine }); }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) { start = i + 1; startLine = line; }
    }
  }
  return out
    /* @media, @keyframes and friends open their own scope; their contents are
       deliberately allowed to restate a selector */
    .filter(r => !r.sel.trim().startsWith("@"))
    .map(r => ({
      line: r.line,
      sel: r.sel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim()
    }))
    .filter(r => r.sel);
}

const FILES = readdirSync(DIR).filter(n => n.endsWith(".css")).sort();
const css = new Map(FILES.map(f => [f, readFileSync(join(DIR, f), "utf8")]));

/* Properties set from JavaScript are declared nowhere in the CSS and are not
   typos. Each is listed with the file that sets it, so an entry cannot outlive
   the code it stands for. */
const FROM_JS = { "--zoom": "src/lib/zoom.js", "--hue": "vite/course theme" };

let failed = 0;

const declared = new Set(Object.keys(FROM_JS));
for (const text of css.values())
  for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);

for (const [f, text] of css) {
  const missing = new Map();
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
    if (declared.has(m[1]) || missing.has(m[1])) continue;
    missing.set(m[1], {
      line: text.slice(0, m.index).split("\n").length,
      /* The two failure modes read differently on the page, so they are named
         differently here — one vanishes, the other paints the wrong colour. */
      why: m[2] ? "the hardcoded fallback paints instead, off-palette (T3)"
                : "the whole declaration is dropped"
    });
  }
  if (missing.size) {
    failed += missing.size;
    console.log(`FAIL ${f}`);
    for (const [name, { line, why }] of missing)
      console.log(`       ✗ line ${line}: var(${name}) names no token — ${why}`);
  }
}

/* Classes that carry no styling by design: a container whose children are what
   is dressed, a modifier the markup uses to group, or a hook a tool selects on.
   Each names its reason, so an entry cannot outlive the thing it stands for —
   the same discipline FROM_JS keeps. Anything not listed here that the engine
   emits must have a rule. */
const HOOKS = {
  cal:          "Calibration.jsx view container; .cal-h/.cal-t/.cal-c are dressed",
  "cal-priv":   "PrivacyNote.jsx selector hook; the paragraph is dressed by .lede",
  cio:          "CourseIO.jsx panel container; its children are dressed",
  done:         "Review.jsx state hook; the finished panel differs by content, not paint",
  "fx-miss":    "blocks/index.js malformed-content fallback; validate.mjs keeps it unshipped",
  "katex-mathml": "not emitted — KaTeX's own class, named by a regex in lib/util.js strip()",
  "lplus-w":    "Library.jsx text span inside the dressed .lplus button",
  preq:         "Prequestion.jsx modifier on .primer-card; the .preq-* parts are dressed",
  prun:         "Practice.jsx run container; .pbar/.pmeta are dressed",
  rv:           "Topbar.jsx hook on a dressed .tbtn; the button is reached by #rv-open",
  "tstub-t":    "TierStub.jsx label span inside the dressed .tstub-b button"
};

/** every class name any rule in the stylesheets mentions */
const styled = new Set();
for (const text of css.values())
  for (const m of text.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) styled.add(m[1]);

const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

/* Classes reach the page from JSX attributes and from strings the block and
   figure renderers concatenate. Both are read literally: a capture that ends
   because the string ended mid-word — `class="is-' + kind` — drops that last
   token, since it is a prefix and not a class. Missing a form here costs a
   defect unreported; inventing one costs a false alarm, so the scan errs
   toward the first. */
const emitted = new Map();
for (const file of walk(SRC).filter(p => /\.(js|jsx)$/.test(p))) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/class(?:Name)?=\{?["`]([^"'`${}\n]*)(.?)/g)) {
    const names = m[1].split(/\s+/).filter(Boolean);
    if (m[2] && !/["`\s]/.test(m[2])) names.pop();   /* cut off mid-word */
    for (const n of names)
      (emitted.get(n) || emitted.set(n, new Set()).get(n))
        .add(file.slice(ROOT.length + 1));
  }
}

const unstyled = [...emitted]
  .filter(([c]) => !styled.has(c) && !(c in HOOKS))
  .sort(([a], [b]) => a.localeCompare(b));
if (unstyled.length) {
  failed += unstyled.length;
  console.log("FAIL src/css");
  for (const [c, where] of unstyled)
    console.log(`       ✗ .${c} is emitted by ${[...where].join(", ")} and no rule styles it`);
}
/* A listed hook that no longer reaches the page is the mirror defect: the note
   outlives the markup and the next reader trusts it. */
const stale = Object.keys(HOOKS).filter(c => !emitted.has(c));
if (stale.length) {
  failed += stale.length;
  console.log("FAIL tools/lint-css.mjs");
  for (const c of stale)
    console.log(`       ✗ HOOKS lists .${c}, which nothing emits any more`);
}

for (const f of FILES) {
  const rules = topLevelRules(css.get(f));
  const seen = new Map(), dupes = [];
  for (const r of rules) {
    if (seen.has(r.sel)) dupes.push(`${r.sel}  (lines ${seen.get(r.sel)} and ${r.line})`);
    else seen.set(r.sel, r.line);
  }
  if (dupes.length) {
    failed += dupes.length;
    console.log(`FAIL ${f}`);
    dupes.forEach(d => console.log("       ✗ declared twice: " + d));
  }
}
console.log(failed ? `\n${failed} problem(s)`
  : "ok   css        no selector declared twice, no var() naming a missing token,\n" +
    "                no class emitted without a rule");
process.exit(failed ? 1 : 0);
