/* What one block looks like at one depth.
 *
 * Two authored fields decide it, and a block declares at most one of them. The
 * field name *is* the declaration — there is no mode flag, for the same reason
 * an absent `tier:` is the declaration of spine: a second field recording a
 * choice the first already made is a second record to drift.
 *
 *   core:   the block's own opening claim, stored apart from its development.
 *           Renders in `full` AND `notes`. `h:` holds only what develops it,
 *           so nothing is written twice and M1 is satisfied outright.
 *
 *   gist:   a summary *about* the block. Renders in `notes` ONLY; `h:` is
 *           whole and untouched. This is a second copy, deliberately, and it
 *           exists for blocks whose prose must withhold its claim on first
 *           read — a `trap` works because you believed otherwise thirty words
 *           ago, and hoisting the correction defuses it. Notes depth showing
 *           it is not a loss: order matters on a first read, and a first read
 *           is `full`.
 *
 * Mnemonic: core is part of the block; gist is about the block.
 *
 * Everything else falls out of the registry, so a course's own blocks.js can
 * declare how its renderer behaves at depth without touching this file.
 */
import { Blocks, holdsOf } from "../blocks/index.js";
import { strip, clip } from "./util.js";
import { M } from "./math.js";

/* How a block behaves at `notes` depth, when its registry entry says nothing.
   `lead` is the interesting one: show the claim, close the development. */
export const NOTES_MODES = ["open", "lead", "caption", "closed", "hidden"];

/** the authored claim, whichever field carries it — `core` first, then `gist` */
export const leadOf = b => (b && (b.core || b.gist)) || null;

/* A claim may be one sentence or several parallel ones.
 *
 * `core:` accepts a list, and a list is not a summary of the prose in another
 * form — it is the claim itself, stated once, in the shape it actually has. A
 * rule with three cases is three facts; flattening it into a sentence to fit a
 * field would be the field deforming the content. Notes depth renders them as
 * points, which is what they are, and full depth renders the same list above
 * the development.
 *
 * This is also the cheapest route to the thing the evidence actually asks for:
 * related items positioned close together rather than run into prose. */
export const leadList = v => (Array.isArray(v) ? v.filter(x => String(x).trim()) : null);
export const isList = b => !!leadList(leadOf(b));

/** Does this block state its claim separately from its development? */
export const hasCore = b => !!(b && b.core);

/* ------------------------------------------------------- a derived claim --*/
/*
 * What `notes` shows for a block whose author never wrote a claim.
 *
 * The architecture argues against extraction, and the argument is right about
 * what it measured. What it did not price is what the reader gets when the
 * guess is declined: `present()` fell through to the block's *name*, so on a
 * course with no claims every prose row in Review reads "Slope field …". Both
 * real courses sit at 100% unclaimed, so Review and Index rendered the same
 * page — which is exactly what a reader looking at them reported.
 *
 * The choice was therefore never "authored claim or derived claim". It was
 * "derived claim or no claim".
 *
 * And the measured failure rate turns out to be a property of the rule that was
 * measured rather than of extraction. That rule is `pretrain.js`'s, and it
 * terminates a sentence on `[.;:]` — so it cuts at the colon introducing a
 * list and returns the fragment before it, which is most of the 33% it was
 * charged with. Terminating on `[.!?]` alone and rejecting what is left over
 * yields a usable claim for **93% of ma26600's 182 unclaimed prose blocks**
 * and 82% of demo's 22 (`tools/measure-claims.mjs`). At six words the gate
 * admits "Order is the highest derivative present." — a real claim the
 * eight-word threshold rejected.
 *
 * The gate is what keeps the guess honest. A sentence ending on a colon or a
 * semicolon was leading into something that is not here; one under six words is
 * a fragment; one over 200 characters is the paragraph rather than its claim.
 * Any of those and the row falls back to the name, which is where it already
 * was — so this strictly adds and can never take a row backwards.
 *
 * `demo`, at 0% unclaimed, is what the authored version looks like, and nothing
 * here touches it: this runs only where the author wrote nothing. An authored
 * `core:` remains better than a derived claim and `audit-content.mjs` still
 * counts what is missing.
 *
 * Nothing is marked as derived on the row. The reader's question is "what does
 * this block say", and a badge on two thirds of the rows is the texture T44
 * names — the author's question is a different one and `audit-content.mjs`
 * already answers it with the unclaimed fraction.
 */
const MIN_WORDS = 6;
const MAX_CHARS = 200;

/* Find the end of the first sentence in authored HTML.
 *
 * The claim is injected as HTML, not as text — an authored `core:` carries
 * `<m>…</m>` and cross-reference markup, and the renderer decorates it. So the
 * derived claim has to be a *slice of the source*, not a flattened string:
 * flattening rendered KaTeX to text turns `y = Ce^{x^2}` into "y=Cex2", which
 * is not the same claim and is worse than no claim at all.
 *
 * The scan therefore runs over the source and has two places it must not stop:
 * inside a tag, where a `.` belongs to an attribute, and inside `<m>…</m>`,
 * where it belongs to the maths. Returns the index just past the terminator,
 * or -1. */
function sentenceEnd(html) {
  let inTag = false, inMath = false;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (inTag) { if (c === ">") inTag = false; continue; }
    if (c === "<") {
      if (html.startsWith("<m>", i)) inMath = true;
      else if (html.startsWith("</m>", i)) inMath = false;
      inTag = true;
      continue;
    }
    if (inMath) continue;
    if ((c === "." || c === "!" || c === "?") &&
        (i + 1 >= html.length || /\s/.test(html[i + 1]))) return i + 1;
  }
  return -1;
}

/* Close whatever inline tags the slice left open, innermost first, so the
   fragment is well-formed HTML on its own. A slice that ends mid-emphasis
   would otherwise leak its formatting into everything after it. */
function closeTags(html) {
  const open = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  for (let m; (m = re.exec(html));) {
    if (m[3] === "/" || VOID.has(m[2].toLowerCase())) continue;
    if (m[1] === "/") { const at = open.lastIndexOf(m[2].toLowerCase()); if (at >= 0) open.splice(at, 1); }
    else open.push(m[2].toLowerCase());
  }
  return html + open.reverse().map(t => `</${t}>`).join("");
}
const VOID = new Set(["br", "img", "hr", "input", "wbr", "source"]);

export function deriveLead(b) {
  if (!b || b.core || b.gist) return null;
  const body = String(b.h || "").trim();
  if (!body) return null;

  /* The first paragraph only. A claim that ran past a paragraph break was
     never one sentence. */
  const firstP = body.split(/<\/p\s*>/i)[0].replace(/^\s*<p\b[^>]*>/i, "");
  const end = sentenceEnd(firstP);
  const slice = end > 0 ? firstP.slice(0, end) : firstP;

  /* The gate reads the flattened text; the return value keeps the markup. */
  const t = strip(M(slice));
  if (!t) return null;
  if (t.length > MAX_CHARS) return null;
  if (/[:;]$/.test(t)) return null;
  if (t.split(/\s+/).length < MIN_WORDS) return null;
  /* No terminator anywhere means the body is not sentence-shaped — a caption,
     a fragment, a heading. Those keep their name. */
  if (end <= 0) return null;
  return closeTags(slice.trim());
}

/**
 * The name a block is known by — its Index-depth row, and the title field of
 * its search entry. Registry entries may override; the fallbacks below are the
 * authored fields in the order a reader would recognise them.
 */
export function nameOf(b) {
  if (!b) return "";
  const d = Blocks.get(b.t);
  if (d && typeof d.name === "function") {
    const n = d.name(b);
    if (n) return String(n);
  }
  const first = b.term || b.label || b.cap || b.title || b.alt;
  if (first) return clip(strip(String(first)), 120);
  /* Falling back to the renderer's own default produces rows reading "List"
     and "Note", which name the machinery rather than the content and are the
     interface talking about itself. The opening words of the block say more,
     and they are the author's. */
  const own = strip(Array.isArray(b.items) ? String(b.items[0] || "") : String(b.h || ""));
  if (own) return clip(own, 80);
  return (d && d.defaultLabel) || b.t;
}

/**
 * How to present one block at one depth.
 *
 *   mode  "full"    the block entire (core, where declared, ahead of h)
 *         "lead"    the claim only; the development is closed
 *         "caption" the block's name only, styled as its own caption
 *         "closed"  a one-line stub carrying the name
 *         "hidden"  not in the document at this depth
 *   name  the string a closed row shows
 *   lead  the claim's HTML, when mode is "lead"
 *   more  whether anything is closed and therefore expandable in place
 *
 * `full` is never anything but "full": depth closes prose, it never removes a
 * block, so every block is reachable at every depth by opening it.
 */
export function present(b, depth) {
  if (!b) return { mode: "hidden", name: "", lead: null, more: false };
  const d = Blocks.get(b.t) || {};
  const name = nameOf(b);
  const lead = leadOf(b);

  /* Precedence, most specific first.
   *
   *   1. `notes:` on the block. The author said so.
   *   2. A claim the author wrote. A `core:` on a worked example is a claim
   *      about that example, and closing it to a title threw away the one
   *      thing the author nominated — which is how a page of notes ended up
   *      full of rows that had to be opened before they said anything.
   *   3. What the renderer declares for its kind.
   *
   * Rule 2 only ever opens a row further: it promotes `closed` and `caption`
   * to `lead`, and never demotes `open`, because a figure with a claim beside
   * it still wants to be the figure. */
  /* Authored first, derived only where nothing was authored. `leadOf` stays
     authored-only because the search index and the margin cards quote it as
     the author's own words. */
  const shown = lead || deriveLead(b);
  const explicit = NOTES_MODES.includes(b.notes) ? b.notes : null;
  const kind = NOTES_MODES.includes(d.notes) ? d.notes : "lead";
  /* What a claim buys depends on what the block is made of. On prose it buys
     `lead`: the claim stands in and the argument closes. On a structure it
     buys `open`, because the items are the content and a claim about them is a
     caption — promoting a list to `lead` hands the reader "four places a course
     can take you" and closes the four places, which is a title wearing a
     note's clothes. */
  const promote = holdsOf(b.t) === "structure" ? "open" : "lead";
  /* A derived claim never promotes a closed or caption kind. Those are the
     renderer saying the block is not prose — a table, a figure — and a first
     sentence taken from one of those is not its claim. */
  const notes = explicit
    || (lead && (kind === "closed" || kind === "caption") ? promote : kind);
  const hasBody = !!String(b.h || "").trim() || b.t === "figure" || b.t === "image" ||
                  b.t === "table" || b.t === "math" || b.t === "code" || b.t === "list";

  if (depth === "full") return { mode: "full", name, lead: null, more: false };

  if (depth === "index") {
    /* A block with nothing to name cannot be an index row; hiding it is
       better than a row reading "p". */
    if (notes === "hidden") return { mode: "hidden", name, lead: null, more: false };
    return { mode: "closed", name, lead: null, more: hasBody || !!lead };
  }

  /* notes */
  switch (notes) {
    case "hidden":  return { mode: "hidden",  name, lead: null, more: false };
    case "open":    return { mode: "full",    name, lead: null, more: false };
    case "caption": return { mode: "caption", name, lead: null, more: hasBody };
    case "closed":  return { mode: "closed",  name, lead: null, more: hasBody };
    default:
      /* `lead`, the default. With no claim declared there is nothing to lead
         with, so the row closes to its name rather than showing prose the
         author never nominated. */
      if (!shown) return { mode: "closed", name, lead: null, more: hasBody };
      /* A derived claim is the opening of the body rather than a field beside
         it, so the body always holds more than the row is showing. */
      return { mode: "lead", name, lead: shown,
               more: lead ? (hasCore(b) ? hasBody : true) : true };
  }
}

/* Topics inside one subsection.
 *
 * A flat list of claims is the note form the research names as the weak
 * baseline: students record "in a linear list-like fashion that also obscures
 * text relationships", and displays that position related ideas close together
 * beat both the text and the outline on relational learning (Robinson & Kiewra
 * 1995; Kiewra et al. 1999). So notes depth groups rather than lists.
 *
 * The grouping is derived, not authored, because the document already carries
 * it: M10 fixes the order inside a subsection as definition, then the rule that
 * makes it usable, then the instance, then the exception. A `def` therefore
 * opens a topic and everything after it belongs to that topic until the next
 * `def` does. Nothing new is written and nothing can drift.
 */
export function topicsOf(items) {
  const out = [];
  for (const it of items) {
    const isHead = it.b && it.b.t === "def";
    if (isHead || !out.length) out.push({ head: isHead ? it : null, items: [] });
    if (!isHead) out[out.length - 1].items.push(it);
  }
  return out.filter(t => t.head || t.items.length);
}

/**
 * One section's shape at a glance, for the strip above the material.
 * Counts what a depth is closing, so the reader knows what is behind it.
 */
export function shapeOf(section, depth) {
  let shown = 0, closed = 0, named = 0;
  for (const sub of section.subs || [])
    for (const b of sub.blocks || []) {
      const p = present(b, depth);
      if (p.mode === "hidden") { closed++; continue; }
      if (p.mode === "full") shown++;
      else { named++; if (p.more) closed++; }
    }
  return { shown, closed, named };
}
