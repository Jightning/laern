#!/usr/bin/env node
/* A note is the reader's own text, and it reaches innerHTML.
 *
 * lib/md.js formats it, and the only thing standing between a pasted note and
 * script execution is that it escapes before it formats. That ordering is not
 * visible from a rendered page, so it is asserted here rather than trusted.
 *
 * The second half is the boring half and matters as much: a note that mangles
 * what the reader typed is worse than one that does not format at all. The
 * placeholder used to lift code spans out was ` 0 ` at one point, which any
 * note containing " 0 " would have corrupted.
 *
 *   node tools/test-md.mjs
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { md } = await import("../src/lib/md.js");

/* ---- nothing the reader types becomes markup ---------------------------- */

const DANGEROUS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<iframe src=javascript:alert(1)></iframe>",
  "<a href='javascript:alert(1)'>x</a>",
  "<svg/onload=alert(1)>",
  "</p><script>alert(1)</script><p>",
  "<style>*{display:none}</style>"
];
/* The property is not "the output contains no scary words" — `onerror=` as
   inert text is fine and the reader may well have typed it. It is that every
   tag in the output is one this module emitted. */
const EMITTED = new Set(["p", "b", "i", "code", "a", "ul", "ol", "li", "br"]);
const tagsIn = html => [...html.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map(m => m[1].toLowerCase());

for (const src of DANGEROUS) {
  const out = md(src);
  const stray = tagsIn(out).filter(t => !EMITTED.has(t));
  check(`escaped: ${src.slice(0, 32)}`, stray.length === 0, stray.join(",") + "  " + out);
}

/* A link is the one place a value from the note reaches an attribute. */
const schemes = [
  ["https://example.com/a", true],
  ["http://example.com/a", true],
  ["javascript:alert(1)", false],
  ["JaVaScRiPt:alert(1)", false],
  ["data:text/html,<script>1</script>", false],
  ["vbscript:msgbox(1)", false],
  ["file:///etc/passwd", false]
];
for (const [url, ok] of schemes) {
  const out = md(`[t](${url})`);
  check(`${ok ? "allows" : "refuses"} ${url.slice(0, 28)}`,
        /<a href=/.test(out) === ok, out);
}
check("a refused link keeps the literal text the reader typed",
      md("[t](javascript:alert(1))").includes("[t](javascript:alert(1))"));

/* ---- and it formats what it is supposed to ------------------------------ */

const cases = [
  ["**b**",                 "<p><b>b</b></p>"],
  ["*i*",                   "<p><i>i</i></p>"],
  ["_i_",                   "<p><i>i</i></p>"],
  ["`c`",                   "<p><code>c</code></p>"],
  ["- a\n- b",              "<ul><li>a</li><li>b</li></ul>"],
  ["1. a\n2. b",            "<ol><li>a</li><li>b</li></ol>"],
  ["a\n\nb",                "<p>a</p><p>b</p>"],
  ["a\nb",                  "<p>a<br>b</p>"],
  ["",                      ""],
  ["   ",                   ""],
  ["a & b",                 "<p>a &amp; b</p>"]
];
for (const [src, want] of cases)
  check(`renders ${JSON.stringify(src)}`, md(src) === want, md(src));

/* The two that have actually bitten. */
check("a bare number is not mistaken for a code placeholder",
      md("value 0 here `x` end") === "<p>value 0 here <code>x</code> end</p>",
      md("value 0 here `x` end"));
check("emphasis inside a code span stays literal",
      md("`a*b*c`") === "<p><code>a*b*c</code></p>", md("`a*b*c`"));

/* A list interrupted by a paragraph closes, rather than swallowing it. */
check("a list closes before the paragraph after it",
      md("- a\n\nafter") === "<ul><li>a</li></ul><p>after</p>", md("- a\n\nafter"));

console.log(fail.length ? `\n${fail.length} failed` : "\nall passed");
process.exit(fail.length ? 1 : 0);
