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
 * Nothing reported any of this on its own: the CSS parses, and the token is
 * simply never there.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "css");

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
  : "ok   css        no selector declared twice, no var() naming a missing token");
process.exit(failed ? 1 : 0);
