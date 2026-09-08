/* ============================================================================
 * Block registry — the reason a course needs no code.
 *
 * Every renderable thing is registered by name and produces an HTML string
 * from data. Components inject the result. Keeping these as string renderers
 * is deliberate: course content is authored as raw HTML in YAML, so a
 * component-based renderer would have to inject it unescaped anyway, and this
 * keeps the extension point trivial for a new subject.
 *
 *   register("name", { render: (b, U) => "<div>…</div>" })
 * ==========================================================================*/
import { esc, strip, clip } from "../lib/util.js";
import { Figures } from "../figures/index.js";
import { displayTex } from "../lib/math.js";

const reg = {};
export const Blocks = {
  register: (name, def) => { reg[name] = def; },
  get: name => reg[name],
  has: name => Object.prototype.hasOwnProperty.call(reg, name),
  names: () => Object.keys(reg)
};

/* the active course's configuration, consulted by data-driven renderers */
let CFG = {};
export const setBlockConfig = course => { CFG = course || {}; };

/* The two `source:` values that are a confession rather than an origin. Both
   count as unverified in the audit; the badge names which kind. */
const UNSOURCED = {
  unverified: "unverified — not grounded in a named source",
  generated: "generated — drafted by a model, not yet checked"
};

/* Authored fields are HTML, uniformly.
 *
 * `h`, `q` and `why` always were; `a`, `cap`, `label` and an example's `title`
 * were escaped, which made them the only places an equation could not go — and
 * an equation is exactly what a worked example's title or a quiz answer wants
 * to be. They are the same trust domain (a file in this repo), so the rule is
 * now the same everywhere, and validate.mjs fails a bare `<` or `&` so the
 * change cannot bite an author who forgets. `term` stays escaped: the primer
 * renders it as text, not markup. */
export const U = {
  esc, strip, clip,
  box: (cls, label, inner) =>
    `<div class="${cls}"><span class="blabel">${label}</span>${inner}</div>`,
  cell: (v, map) => {
    const s = String(v).trim();
    return map && map[s] ? `<span class="${map[s]}">${esc(s)}</span>` : esc(s);
  },
  /* Where a claim came from. A claim the author could not ground says so in
     the page, in words rather than by colour, because the reader cannot tell a
     confident wrong explanation from a right one and everything else on the
     page has been verified to a high standard. A block with no `source:` at all
     is not yet audited rather than known-unverified: tools/audit-content.mjs
     counts those, and marking them here would put a badge on every block in
     every course that has not been through the pass.

     `generated` is the same badge with a different instruction. Both mean the
     claim is ungrounded; the difference is who to ask. `unverified` means a
     human should look it up, `generated` means a human should check whether it
     is even true, because a model wrote it (M30). */
  src: b => !b.source ? "" : UNSOURCED[b.source]
    ? `<span class="bsrc is-un">${UNSOURCED[b.source]}</span>`
    : `<span class="bsrc">${esc(b.source)}</span>`,
  /* "Figure 3.2 — what it shows". The number is the citable half, so it is
     rendered even when the author wrote no caption. */
  caption: (num, text) =>
    (num ? `<b class="fnum">Figure ${esc(num)}</b>` : "") +
    (num && text ? " — " : "") + (text || "")
};

const R = Blocks.register;

/* ---------- how much air a block needs around it ---------------------------
 * `apart: true` marks a block that is set apart from the prose rather than
 * flowing with it — a card, a rule, a figure, a table, a listing, a worked
 * example. Section.jsx puts it on the row and 50-refs.css turns it into the
 * wider beat, on BOTH sides, from one declaration.
 *
 * It is a registry flag rather than a stylesheet list because it was a
 * stylesheet list twice: one `:has()` list for the gap above and another for
 * the gap below, hand-maintained, and they drifted. `.ex`, `.codewrap`,
 * `.imgblock` and `.mathblk` were in the first and missing from the second, so
 * a worked example opened on 28px, closed on 16px, and read as glued to
 * whatever came after it. Here the two sides cannot disagree, and a course's
 * own blocks.js can declare it for a renderer this file has never heard of.
 * -------------------------------------------------------------------------*/
export const isApart = t => !!(Blocks.get(t) || {}).apart;

/* ---------- prose and callouts ---------- */
R("p",    { render: b => `<p>${b.h}</p>` });
R("def",  { apart: true, render: b => U.box("def", b.label || "Definition",
              (b.term ? `<dt>${esc(b.term)}</dt>` : "") + b.h + U.src(b)) });
R("key",  { render: b => U.box("key",  b.label || "Key rule",       b.h + U.src(b)) });
R("trap", { render: b => U.box("trap", b.label || "Common mistake", b.h + U.src(b)) });
R("note", { render: b => U.box("note", b.label || "Note",           b.h) });
R("ex",   { apart: true, render: b => U.box("ex", b.label || "Worked example",
              (b.title ? `<p><b>${b.title}</b></p>` : "") + b.h) });

R("list", { render: b => {
  const tag = b.ordered ? "ol" : "ul";
  return `<div class="blk"><${tag}>${(b.items || []).map(i => `<li>${i}</li>`).join("")}</${tag}></div>`;
} });

/* ---------- table ----------------------------------------------------------
 * `mono` gives fixed-width centred cells and applies the course's valueStyles,
 * so a truth table is a table, not a special block type.
 * -------------------------------------------------------------------------*/
R("table", { apart: true, render: b => {
  const vmap = b.map || (b.mono ? CFG.valueStyles : null);
  const sep = i => (b.split != null && i === b.split - 1 ? ' class="sep"' : "");
  let h = `<div class="tscroll"><table class="tbl${b.mono ? " tmono" : ""}">`;
  if (b.cap) h += `<caption>${b.cap}</caption>`;
  h += "<thead><tr>" + (b.head || []).map((c, i) => `<th${sep(i)}>${c}</th>`).join("") +
       "</tr></thead><tbody>";
  h += (b.rows || []).map(r =>
    "<tr>" + r.map((c, i) => `<td${sep(i)}>${vmap ? U.cell(c, vmap) : c}</td>`).join("") + "</tr>"
  ).join("");
  return h + "</tbody></table></div>";
} });

/* ---------- code -----------------------------------------------------------
 * Highlighting is configuration, not code. A course declares:
 *   syntax: { comment, keywords: [...], patterns: [{re, cls}], strings }
 * so any language works without writing a renderer.
 * -------------------------------------------------------------------------*/
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function highlight(src, syn) {
  let out = esc(src);
  if (syn.comment)
    out = out.replace(new RegExp(`(${reEsc(syn.comment)}[^\\n]*)`, "g"), '<span class="tok-c">$1</span>');
  if (syn.keywords?.length)
    out = out.replace(new RegExp(`\\b(${syn.keywords.map(reEsc).join("|")})\\b`, "g"),
      '<span class="tok-k">$1</span>');
  (syn.patterns || []).forEach(p => {
    try { out = out.replace(new RegExp(p.re, "g"), `<span class="${p.cls || "tok-n"}">$&</span>`); }
    catch { /* a bad pattern must not break the page */ }
  });
  if (syn.strings !== false)
    out = out.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="tok-s">$1</span>');
  return out;
}
R("code", { apart: true, render: b =>
  `<div class="codewrap"><span class="lang">${esc(b.lang || "code")}</span>` +
  `<pre><code>${CFG.syntax ? highlight(b.src, CFG.syntax) : esc(b.src)}</code></pre></div>` });

/* ---------- math ------------------------------------------------------------
 * {t:"math", tex:"y'' + 4y' + 4y = 0", label:"…", note:"…"}
 * Rendered here, at read time, by lib/math.js. It used to be baked in by the
 * build; that cost 16x in size to save tens of milliseconds, which stopped
 * being worth it once a course became something a reader imports and edits.
 * A formula that will not parse renders as KaTeX's own error text rather than
 * blanking the page — tools/lib/check.mjs is what keeps it out of a course.
 * -------------------------------------------------------------------------*/
R("math", { apart: true, render: b =>
  `<div class="mathblk">` +
  (b.label ? `<span class="blabel">${b.label}</span>` : "") +
  (b.tex ? displayTex(b.tex) : `<p class="fx-miss">a math block has no tex</p>`) +
  (b.note ? `<span class="mathnote">${b.note}</span>` : "") +
  `</div>` });

/* ---------- figure ---------- */
R("figure", { apart: true, render: (b, _u, env) => {
  const fn = Figures[b.kind];
  const body = fn ? fn(b.spec || {}) : `<p class="fx-miss">unknown figure kind: ${esc(b.kind)}</p>`;
  const cap = U.caption(env.fignum, b.cap);
  return `<div class="figure">${cap ? `<span class="fcap">${cap}</span>` : ""}${body}</div>`;
} });

/* ---------- optional per-course renderers ---------------------------------
 * A course may still ship blocks.js for something the built-ins cannot express.
 * None currently does; the build reports "no code" when a subject is pure data.
 * -------------------------------------------------------------------------*/
const custom = import.meta.glob("../../courses/*/blocks.js", { eager: true });
Object.values(custom).forEach(m => { if (typeof m.default === "function") m.default(Blocks, U); });

/** render one block, never throwing into the tree.
 *  `env` carries what a renderer cannot know from its own data — currently the
 *  figure's number, which depends on the blocks around it. */
export function renderBlock(b, env) {
  const d = Blocks.get(b.t);
  if (!d) return `<div class="note"><span class="blabel">Unknown block</span>` +
    `<p>No renderer for type <code>${esc(b.t)}</code>.</p></div>`;
  try { return d.render(b, U, env || {}); }
  catch (e) { return `<div class="note"><span class="blabel">Render error</span>` +
    `<p>${esc(b.t)}: ${esc(e.message)}</p></div>`; }
}

/* ---------- image ----------------------------------------------------------
 * {t:"image", src:"assets/fig.png", alt:"…", cap:"…", credit:"…", width:420}
 * `src` is relative to the course folder and is inlined at build time.
 * `alt` is required: a figure nobody can read is not a learning aid.
 * -------------------------------------------------------------------------*/
R("image", { apart: true, render: (b, _u, env) => {
  const w = b.width ? ` style="max-width:${parseInt(b.width, 10)}px"` : "";
  const cap = U.caption(env.fignum, b.cap);
  return `<figure class="imgblock"${w}>` +
    `<img src="${b.src}" alt="${esc(b.alt || "")}" loading="lazy">` +
    (cap || b.credit
      ? `<figcaption>${cap}` +
        (b.credit ? `<span class="credit">${esc(b.credit)}</span>` : "") + "</figcaption>"
      : "") + "</figure>";
} });
