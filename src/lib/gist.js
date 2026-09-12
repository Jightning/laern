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
  const explicit = NOTES_MODES.includes(b.notes) ? b.notes : null;
  const kind = NOTES_MODES.includes(d.notes) ? d.notes : "lead";
  /* What a claim buys depends on what the block is made of. On prose it buys
     `lead`: the claim stands in and the argument closes. On a structure it
     buys `open`, because the items are the content and a claim about them is a
     caption — promoting a list to `lead` hands the reader "four places a course
     can take you" and closes the four places, which is a title wearing a
     note's clothes. */
  const promote = holdsOf(b.t) === "structure" ? "open" : "lead";
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
      if (!lead) return { mode: "closed", name, lead: null, more: hasBody };
      return { mode: "lead", name, lead, more: hasCore(b) ? hasBody : true };
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
