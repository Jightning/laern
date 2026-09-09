/* ============================================================================
 * tools/lib/figures.mjs — check one figure block against its kind's spec
 *
 * A figure is the one block type whose payload is a free-form mapping the
 * renderer picks over, so it is the one place a typo produces no error and no
 * missing-content marker — just a figure quietly drawn without the thing the
 * author wrote. Everything checkable about a spec is checked here, at build
 * time, for the reason T30 gives.
 *
 *   checkFigure(block, where, errs) -> pushes one message per problem
 * ==========================================================================*/
import { KINDS } from "../../src/figures/index.js";
import { SPEC } from "../../src/figures/schema.js";

/* The schema sits beside the renderers so a new kind's author trips over it,
   which only works if a kind cannot be added to one and not the other. */
const missing = KINDS.filter(k => !SPEC[k]);
const extra = Object.keys(SPEC).filter(k => !KINDS.includes(k));
if (missing.length || extra.length)
  throw new Error(`src/figures/schema.js is out of step with the registry: ` +
    [missing.length ? `no spec for ${missing.join(", ")}` : "",
     extra.length ? `spec for unregistered ${extra.join(", ")}` : ""].filter(Boolean).join("; "));

/* A null value is the fingerprint of the YAML defect this mostly exists to
   catch: `{label: a, note: b, c}` is `{label: "a", note: "b", c: null}`, so an
   unknown key that parsed to nothing is almost always a truncated value. */
const why = v => v === null
  ? ` — an unquoted comma in a YAML flow mapping ends the pair, not the value; quote the whole string`
  : ``;

function checkKeys(obj, allowed, what, errs) {
  for (const [k, v] of Object.entries(obj))
    if (!allowed.includes(k))
      errs.push(`${what}: unknown key "${k}"${why(v)}`);
}

/* A plot series' `fn` is JavaScript in `x` that the reader's browser evaluates
   while they are reading. It was the one authored expression nothing compiled:
   a syntax error renders an empty chart with no message at all, and a runtime
   error paints "Render error" onto the page someone is revising from. Maths is
   rendered at build time for exactly this reason (T30), so a plot's function is
   compiled and sampled here for the same one. Course JavaScript already runs in
   this process — the bundler imports courses/<id>/blocks.js — so this adds no
   trust that is not already assumed. */
function checkPlotFns(spec, where, errs) {
  for (const ser of spec.series || []) {
    if (!ser || ser.points || ser.fn == null) continue;
    let f;
    try { f = new Function("x", "return (" + ser.fn + ");"); }
    catch (e) { errs.push(`${where}: plot fn "${ser.fn}" does not parse — ${e.message}`); continue; }
    const from = ser.from != null ? ser.from : (spec.xrange ? spec.xrange[0] : 0);
    const to = ser.to != null ? ser.to : (spec.xrange ? spec.xrange[1] : 10);
    let finite = 0, threw = null;
    for (let i = 0; i <= 20 && !threw; i++) {
      try {
        const y = f(from + (to - from) * (i / 20));
        if (typeof y === "number" && isFinite(y)) finite++;
      } catch (e) { threw = e.message; }
    }
    if (threw) errs.push(`${where}: plot fn "${ser.fn}" throws — ${threw}`);
    else if (!finite)
      errs.push(`${where}: plot fn "${ser.fn}" has no finite value on [${from}, ${to}] — the chart renders empty`);
  }
}

/** Check one `{t:"figure", kind, spec}` block. `where` names the subsection. */
export function checkFigure(b, where, errs) {
  const s = SPEC[b.kind];
  if (!s) { errs.push(`${where}: unknown figure kind "${b.kind}"`); return; }

  const spec = b.spec || {};
  if (typeof spec !== "object" || Array.isArray(spec)) {
    errs.push(`${where}: figure "${b.kind}" spec is not a mapping`);
    return;
  }

  checkKeys(spec, s.keys, `${where}: figure ${b.kind} spec`, errs);

  for (const [k, allowed] of Object.entries(s.enums || {}))
    if (spec[k] != null && !allowed.includes(spec[k]))
      errs.push(`${where}: figure ${b.kind} ${k}: "${spec[k]}" is not one of ` +
        `${allowed.join(", ")} — the renderer ignores it and falls back to "${allowed[0]}"`);

  /* A format with no placeholder is worse than none: every tick reads the
     same, which looks deliberate. A non-string is what a course reaches for
     when it copies a JavaScript formatter into YAML. */
  for (const k of s.fmts || []) {
    const f = spec[k];
    if (f == null) continue;
    if (typeof f !== "string")
      errs.push(`${where}: figure ${b.kind} ${k} must be a format string like "{} ms" — ` +
        `a course is data, so it cannot hold a function`);
    else if (!f.includes("{}"))
      errs.push(`${where}: figure ${b.kind} ${k} "${f}" has no {} — every label would read the same`);
  }

  for (const [field, allowed] of Object.entries(s.items || {}))
    (Array.isArray(spec[field]) ? spec[field] : []).forEach((it, i) => {
      if (it && typeof it === "object" && !Array.isArray(it))
        checkKeys(it, allowed, `${where}: figure ${b.kind} ${field}[${i + 1}]`, errs);
    });

  if (b.kind === "plot") checkPlotFns(spec, where, errs);
}
