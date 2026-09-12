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
/* Above this many words a label is being read rather than scanned. */
const LABEL_WORDS = 4;

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
  /* An empty label renders no label row. A callout whose kind is already
     legible from its accent, its term and its claim does not also need the
     engine's word for it printed above — and the same default repeated on
     every block of a course is exactly the density at which signalling stops
     signalling (T13).

     A long label is set as a line of text rather than as a label. T41's test is
     "if you would read it aloud as a sentence, it is not a label", and that
     test is mechanical once you are willing to count: "Common mistake" is a
     label and "Nothing due does not mean nothing to do" is a sentence wearing
     a label's mono, letterspacing and 13px. The renderer is the only place
     that can tell them apart, because a stylesheet cannot see the string. */
  box: (cls, label, inner) => {
    const long = String(label || "").trim().split(/\s+/).length > LABEL_WORDS;
    return `<div class="${cls}">` +
      (label ? `<span class="blabel${long ? " is-line" : ""}">${label}</span>` : "") +
      `${inner}</div>`;
  },
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
     rendered even when the author wrote no caption. `kind` is the noun, since
     tables are numbered on the same rule as figures: a caption that cannot be
     cited is a caption the prose has to describe in words instead. */
  caption: (num, text, kind = "Figure") =>
    (num ? `<b class="fnum">${esc(kind)} ${esc(num)}</b>` : "") +
    (num && text ? " — " : "") + (text || ""),

  /* The block's prose, claim first.
   *
   * `core:` holds the block's opening claim and `h:` holds only what develops
   * it, so the two are one paragraph split at a declared point rather than a
   * statement and a copy of it. Composing them here is what lets `notes` depth
   * show the claim alone without the renderer knowing depth exists.
   *
   * `gist:` is deliberately absent from this path. It is a summary *about* the
   * block, for a block whose prose withholds its claim on purpose, and showing
   * it above that prose would give away exactly what the prose is withholding. */
  body: b => {
    const c = b.core;
    if (!c) return b.h || "";
    const lead = Array.isArray(c)
      ? `<ul class="bcore bcore-l">${c.map(x => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="bcore">${c}</p>`;
    return lead + (b.h || "");
  }
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

/* ---------- what a block is made of ----------------------------------------
 * `holds` says whether a block's substance is prose or a structure.
 *
 *   prose      a claim and the argument that develops it. The claim can stand
 *              in for the block, because what is closed is support.
 *   structure  an enumeration whose items ARE the content — a list, a table,
 *              a listing, an equation, a drawing. A claim about one of these
 *              is a caption, not a substitute: "four places a course can take
 *              you" tells you how many and not which, so closing the list to
 *              it hands the reader a title and calls it a note.
 *
 * The distinction decides what an authored claim buys. On prose it buys `lead`
 * — claim shown, development closed. On structure it buys `open` — the claim
 * renders as the block's lead line and the structure stays whole, because
 * there is nothing the claim could stand in for.
 * -------------------------------------------------------------------------*/
export const holdsOf = t => ((Blocks.get(t) || {}).holds === "structure" ? "structure" : "prose");

/* ---------- how a block behaves at reading depth --------------------------
 * `notes` says what `notes` depth does with this kind, and `name` says what
 * its `index` row reads. Both live in the registry rather than in lib/gist.js
 * so that a course's own blocks.js can declare them for a renderer this file
 * has never heard of — the same reason `apart` lives here.
 *
 *   open     render it whole; it is already the compact form (an equation, a
 *            declarative figure — a plot IS the note, and flattening it to a
 *            caption would be the one summary that loses information)
 *   lead     show the claim, close the development                (def/key/trap)
 *   caption  show its caption line alone                          (table/image)
 *   closed   a one-line stub carrying its name                    (ex/note/code)
 *   hidden   not in the document at this depth                    (p)
 *
 * `p` is hidden because a `p` carries no claim: it sets up, bridges, or fades
 * an anchor. A `p` that asserts something is the wrong block type and wants to
 * be a `key`. That is the one registry entry named after an HTML tag rather
 * than a role, and this is where the role gets declared.
 * -------------------------------------------------------------------------*/

/* ---------- prose and callouts ---------- */
R("p",    { notes: "hidden", render: b => `<p>${b.h}</p>` });
R("def",  { apart: true, notes: "lead", defaultLabel: "Definition",
            name: b => b.term,
            render: b => U.box("def", b.label || (b.term ? "" : "Definition"),
              (b.term ? `<dt>${esc(b.term)}</dt>` : "") + U.body(b) + U.src(b)) });
R("key",  { notes: "lead", defaultLabel: "Key rule",
            render: b => U.box("key",  b.label || (b.core || b.gist ? "" : "Key rule"),
                                                                    U.body(b) + U.src(b)) });
R("trap", { notes: "lead", defaultLabel: "Common mistake",
            render: b => U.box("trap", b.label || "Common mistake", U.body(b) + U.src(b)) });
R("note", { notes: "closed", defaultLabel: "Note",
            render: b => U.box("note", b.label || "Note",           U.body(b)) });
R("ex",   { apart: true, notes: "closed", defaultLabel: "Worked example",
            name: b => b.title || b.label,
            render: b => U.box("ex", b.label || "Worked example",
              (b.title ? `<p><b>${b.title}</b></p>` : "") + U.body(b)) });

R("list", { holds: "structure", notes: "closed", defaultLabel: "List", render: b => {
  const tag = b.ordered ? "ol" : "ul";
  return `<div class="blk">${b.label ? `<span class="blabel">${b.label}</span>` : ""}` +
    U.body(b) +
    `<${tag}>${(b.items || []).map(i => `<li>${i}</li>`).join("")}</${tag}></div>`;
} });

/* ---------- table ----------------------------------------------------------
 * `mono` gives fixed-width centred cells and applies the course's valueStyles,
 * so a truth table is a table, not a special block type.
 * -------------------------------------------------------------------------*/
R("table", { holds: "structure", apart: true, notes: "caption", defaultLabel: "Table",
             name: b => b.cap || b.label,
             render: (b, _u, env) => {
  const vmap = b.map || (b.mono ? CFG.valueStyles : null);
  const sep = i => (b.split != null && i === b.split - 1 ? ' class="sep"' : "");
  let h = U.body(b) + `<div class="tscroll"><table class="tbl${b.mono ? " tmono" : ""}">`;
  const cap = U.caption(env.fignum, b.cap, "Table");
  if (cap) h += `<caption>${cap}</caption>`;
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

/* How many capture groups a pattern opens, so a rule can be found again inside
   the combined regex below. Alternating with an empty branch makes the match
   certain, and exec then reports one slot per group. */
const groupCount = re => { try { return new RegExp(re + "|").exec("").length - 1; } catch { return 0; } };

/* One pass over the raw source, never over its own output.
 *
 * This used to run four passes, each rewriting the string the previous one had
 * already put markup into — so the last pass matched the *first* pass's markup.
 * With `strings` on, the quoted class name in an emitted `<span class="tok-c">`
 * is a string literal like any other: it got wrapped in turn, yielding
 * `<span class=<span class="tok-s">"tok-c"</span>>`, and the browser read the
 * wreckage as an element whose class was `<span`. Every highlighted listing in
 * every course was corrupt, and a keyword sitting inside a comment was marked
 * up twice on top of that.
 *
 * Scanning once fixes both: earlier rules win the overlap, so a keyword inside
 * a comment stays part of the comment, and nothing ever re-reads emitted
 * markup. Escaping moves to the end, applied per slice, because the source has
 * to stay literal while it is matched. */
function highlight(src, syn) {
  const rules = [];
  if (syn.comment) rules.push({ cls: "tok-c", re: `${reEsc(syn.comment)}[^\n]*` });
  if (syn.strings !== false) rules.push({ cls: "tok-s", re: '"(?:[^"\\\\]|\\\\.)*"' });
  /* A bad pattern must not break the page, and now it must not break its
     neighbours either: it is dropped before it can void the whole alternation. */
  for (const p of syn.patterns || []) {
    try { new RegExp(p.re); rules.push({ cls: p.cls || "tok-n", re: p.re }); }
    catch { /* unusable, and reported by validate.mjs */ }
  }
  if (syn.keywords?.length)
    rules.push({ cls: "tok-k", re: `\\b(?:${syn.keywords.map(reEsc).join("|")})\\b` });
  if (!rules.length) return esc(src);

  /* where each rule's own capture group lands in the combined match */
  const at = []; let g = 1;
  for (const r of rules) { at.push(g); g += 1 + groupCount(r.re); }

  let re;
  try { re = new RegExp(rules.map(r => `(${r.re})`).join("|"), "g"); }
  catch { return esc(src); }

  let out = "", last = 0;
  for (const m of src.matchAll(re)) {
    const i = at.findIndex(slot => m[slot] !== undefined);
    if (i < 0) continue;
    out += esc(src.slice(last, m.index)) + `<span class="${rules[i].cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}
R("code", { holds: "structure", apart: true, notes: "closed", defaultLabel: "Listing",
            name: b => b.label || b.lang, render: b =>
  U.body(b) +
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
R("math", { holds: "structure", apart: true, notes: "open", defaultLabel: "Equation",
            name: b => b.label, render: b =>
  U.body(b) +
  `<div class="mathblk">` +
  (b.label ? `<span class="blabel">${b.label}</span>` : "") +
  (b.tex ? displayTex(b.tex) : `<p class="fx-miss">a math block has no tex</p>`) +
  (b.note ? `<span class="mathnote">${b.note}</span>` : "") +
  `</div>` });

/* ---------- figure ---------- */
R("figure", { holds: "structure", apart: true, notes: "open", defaultLabel: "Figure",
              name: b => b.cap, render: (b, _u, env) => {
  const fn = Figures[b.kind];
  const body = fn ? fn(b.spec || {}) : `<p class="fx-miss">unknown figure kind: ${esc(b.kind)}</p>`;
  const cap = U.caption(env.fignum, b.cap);
  return `<div class="figure">${cap ? `<span class="fcap">${cap}</span>` : ""}${body}</div>`;
} });

/* Per-course renderers are registered by ./custom.js, which main.jsx imports.
 * They live there rather than here because `import.meta.glob` is a bundler
 * feature and this module is also read by the Node tools — validate.mjs and
 * audit-content.mjs both reach it through src/lib/index.js, and a glob in the
 * import graph makes the whole chain unloadable outside Vite. Keeping the
 * registry and the built-ins pure is what lets one file describe a block for
 * both the page and the gates. */

/** render one block, never throwing into the tree.
 *  `env` carries what a renderer cannot know from its own data — currently the
 *  figure's number, which depends on the blocks around it.
 *  Both fallbacks carry `fx-miss`, which test-ui counts and expects to be zero:
 *  a renderer that throws is a build defect, and a build defect that only shows
 *  as a paragraph on the page is one nothing gates. */
export function renderBlock(b, env) {
  const d = Blocks.get(b.t);
  if (!d) return `<div class="note"><span class="blabel">Unknown block</span>` +
    `<p class="fx-miss">No renderer for type <code>${esc(b.t)}</code>.</p></div>`;
  try { return d.render(b, U, env || {}); }
  catch (e) { return `<div class="note"><span class="blabel">Render error</span>` +
    `<p class="fx-miss">${esc(b.t)}: ${esc(e.message)}</p></div>`; }
}

/* ---------- image ----------------------------------------------------------
 * {t:"image", src:"assets/fig.png", alt:"…", cap:"…", credit:"…", width:420}
 * `src` is relative to the course folder and is inlined at build time.
 * `alt` is required: a figure nobody can read is not a learning aid.
 * -------------------------------------------------------------------------*/
R("image", { holds: "structure", apart: true, notes: "caption", defaultLabel: "Image",
             name: b => b.cap || b.alt, render: (b, _u, env) => {
  const w = b.width ? ` style="max-width:${parseInt(b.width, 10)}px"` : "";
  const cap = U.caption(env.fignum, b.cap);
  return `<figure class="imgblock"${w}>` +
    `<img src="${b.src}" alt="${esc(b.alt || "")}" loading="lazy">` +
    (cap || b.credit
      ? `<figcaption>${cap}` +
        (b.credit ? `<span class="credit">${esc(b.credit)}</span>` : "") + "</figcaption>"
      : "") + "</figure>";
} });
