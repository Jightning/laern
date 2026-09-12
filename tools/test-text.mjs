#!/usr/bin/env node
/* Course prose reduced to plain text, and the two ways that had been failing.
 *
 * `strip()` is the only path from authored HTML to a string that renders as
 * *text* — a Preact child, a search token, a JSON-LD description. Two things it
 * has to finish and did not:
 *
 *   1. Entities. It removed tags and left "&gt;" behind, which the renderer
 *      then escaped a second time, so the pre-training panel on the first
 *      screen of every section read "for all t&gt;0".
 *
 *   2. Maths. A block body holds TeX *source* in <m>…</m>. strip() knows how to
 *      flatten a rendered KaTeX span down to its glyphs, but removing an <m>
 *      tag just uncovers the source, so the same panel printed "Let \beta be
 *      births per individual per unit time".
 *
 * Neither is visible to any structural gate: both produce a well-formed string
 * of the right length in the right place, and only a reader notices.
 *
 *   node tools/test-text.mjs
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { strip, clip } = await import("../src/lib/util.js");
const { keyTerms } = await import("../src/lib/pretrain.js");

/* ---- entities are decoded, and only after the tags are gone -------------- */

check("gt decodes", strip("<p>for all t&gt;0</p>") === "for all t>0",
      JSON.stringify(strip("<p>for all t&gt;0</p>")));
check("lt decodes", strip("x &lt; y") === "x < y", JSON.stringify(strip("x &lt; y")));
check("amp decodes", strip("Edwards &amp; Penney") === "Edwards & Penney",
      JSON.stringify(strip("Edwards &amp; Penney")));
check("numeric decodes", strip("&#8804; and &#x2265;") === "≤ and ≥",
      JSON.stringify(strip("&#8804; and &#x2265;")));
check("nbsp becomes a space", strip("a&nbsp;b") === "a b",
      JSON.stringify(strip("a&nbsp;b")));
check("unknown entity is left alone", strip("&zzz; x") === "&zzz; x",
      JSON.stringify(strip("&zzz; x")));

/* Ordering is the whole point: an author who encoded a tag meant to show the
   reader a tag, so decoding must not hand it back to the tag stripper. */
check("an encoded tag survives as text",
      strip("write &lt;div&gt; here") === "write <div> here",
      JSON.stringify(strip("write &lt;div&gt; here")));

/* ---- pre-training glosses render their maths before flattening ---------- */

const section = {
  id: "s1",
  subs: [{
    id: "s1-1",
    blocks: [
      /* The shape the courses actually use: a bare `>` inside the TeX, which
         KaTeX escapes to &gt; on the way out, and an entity in the prose
         around it. Both reach the reader as text and neither may arrive
         spelled as its source. */
      { t: "def", term: "Stable critical point",
        h: "<p>x = c is stable if nearby solutions stay close for all "
         + "<m>t > 0</m>, with growth at <m>\\beta</m> &amp; decay at "
         + "<m>\\delta</m>. That is the whole claim.</p>" }
    ]
  }]
};

const [term] = keyTerms(section, {});
check("a gloss is produced", !!term && !!term.gloss, JSON.stringify(term));

const g = term ? term.gloss : "";
check("no TeX source survives into a gloss", !/\\[a-zA-Z]/.test(g), JSON.stringify(g));
check("no raw entity survives into a gloss", !/&[a-z]+;|&#/.test(g), JSON.stringify(g));
check("the maths is rendered, not dropped", /β/.test(g), JSON.stringify(g));
check("an escaped comparison arrives as a glyph", />/.test(g) && !/&gt/.test(g),
      JSON.stringify(g));

/* ---- clip still reports truncation honestly ------------------------------ */

check("clip marks what it cut", clip("abcdefghij", 6) === "abcd…",
      JSON.stringify(clip("abcdefghij", 6)));
check("clip leaves a short string whole", clip("abc", 6) === "abc");

/* ---- a derived claim, where the author wrote none ----------------------- */
/*
 * Review depth closes a prose block to its claim. Both real courses declare no
 * claims at all, so before this the row fell through to the block's *name* and
 * Review rendered the same page as Index. The derivation is what makes the
 * middle mode do work; the gate is what keeps it honest.
 */
const { deriveLead, present } = await import("../src/lib/gist.js");

const prose = h => ({ t: "key", h });

check("a claim is taken from the opening sentence",
      deriveLead(prose("<p>Order is the highest derivative present. Linear means every "
        + "term is a coefficient.</p>")) === "Order is the highest derivative present.",
      JSON.stringify(deriveLead(prose("<p>Order is the highest derivative present. More.</p>"))));

check("a colon means it was introducing a list, not making a claim",
      deriveLead(prose("<p>The three cases that matter here are as follows:</p>")) === null);
check("a semicolon likewise",
      deriveLead(prose("<p>Two things follow from the argument above;</p>")) === null);
check("a fragment is not a claim", deriveLead(prose("<p>Not enough.</p>")) === null);
check("a whole paragraph is not a claim",
      deriveLead(prose("<p>" + "word ".repeat(90) + "</p>")) === null);

/* The rule that makes this safe to add: an authored claim always wins, and
   nothing here can take a row backwards from where it already was. */
check("an authored core is never overridden",
      deriveLead({ t: "key", core: "The author's own", h: "<p>A different opening sentence here.</p>" }) === null);
check("an authored gist is never overridden",
      deriveLead({ t: "key", gist: "The author's own", h: "<p>A different opening sentence here.</p>" }) === null);
check("an authored claim is what renders",
      present({ t: "key", core: "Authored", h: "<p>Some development follows on from it.</p>" }, "notes").lead === "Authored");

/* A derived claim is a *slice of the source*, not a flattened string.
 *
 * Flattening rendered KaTeX to text turns y = Ce^{x^2} into "y=Cex2", which is
 * a different claim. The row injects its lead as HTML and `decorate` renders
 * the maths at that point, exactly as it does for an authored `core:`, so the
 * markup has to survive the derivation intact. */
const withMath = deriveLead(prose("<p>A function <m>y = \\varphi(x)</m> together with an "
  + "interval on which it holds. More follows here.</p>"));
check("a derived claim keeps its maths as markup",
      !!withMath && withMath.includes("<m>") && /\\varphi/.test(withMath),
      JSON.stringify(withMath));
check("a derived claim stops at its first sentence",
      !!withMath && !/More follows/.test(withMath), JSON.stringify(withMath));

/* A full stop inside the maths is not a sentence boundary, and neither is one
   inside a tag's attributes. Both would cut the claim in half. */
const dotInMath = deriveLead(prose("<p>The step size <m>h = 0.1</m> gives an error "
  + "proportional to it. Then more text.</p>"));
check("a decimal point inside maths does not end the sentence",
      !!dotInMath && /error/.test(dotInMath), JSON.stringify(dotInMath));

const dotInTag = deriveLead(prose('<p>See <a href="#s1.2">the earlier section</a> for the '
  + 'derivation of this. And more.</p>'));
check("a dot inside an attribute does not end the sentence",
      !!dotInTag && /derivation/.test(dotInTag), JSON.stringify(dotInTag));

/* A slice that ended mid-emphasis would leak its formatting into the rest of
   the page, so whatever it left open is closed. */
const midTag = deriveLead(prose("<p>The <b>order</b> of an <i>equation is its highest "
  + "derivative. More follows.</i></p>"));
check("a slice closes what it left open",
      !midTag || (midTag.match(/<i>/g) || []).length === (midTag.match(/<\/i>/g) || []).length,
      JSON.stringify(midTag));

check("prose with no sentence terminator keeps its name",
      deriveLead(prose("<p>A caption-shaped fragment with no full stop anywhere</p>")) === null);

/* And the row actually changes mode, which is the whole point. */
const row = present(prose("<p>Order is the highest derivative present. Linear means every "
  + "term is a coefficient.</p>"), "notes");
check("a prose block with no authored claim now leads rather than closing",
      row.mode === "lead", JSON.stringify(row));
check("and it still says there is more behind it", row.more === true);

const bare = present(prose("<p>Too short.</p>"), "notes");
check("a block the gate rejects falls back to its name", bare.mode === "closed",
      JSON.stringify(bare));

console.log(fail.length ? `\n${fail.length} failed` : "\nall passed");
process.exit(fail.length ? 1 : 0);
