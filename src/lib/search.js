/* ============================================================================
 * src/lib/search.js — ranked search over one course
 *
 * The previous version scanned every entry's whole text with `indexOf`, once
 * per query word, on every keystroke. On a 62-section course that is roughly a
 * megabyte of string scanning per character typed, and what it bought was a
 * ranking that could not tell a subsection which says "Laplace" forty times
 * from one that says it once: a hit scored 4 and its position scored at most
 * 3, and term frequency was never counted at all. A mention in the body was
 * therefore findable but effectively unranked.
 *
 * What replaces it is an inverted index — token to the documents holding it,
 * with a count — built once per course and queried in time proportional to how
 * rare the query is rather than how long the course is. Ranking is BM25, which
 * is what actually answers "how much does this entry have to say about this
 * word": it rewards repetition with diminishing returns, discounts words that
 * are everywhere, and normalises for length so a long subsection cannot win by
 * being long.
 *
 * Two things are deliberately *not* in the index:
 *
 *   - **Positions.** They are only needed to draw a snippet, and a snippet is
 *     only drawn for the two dozen entries that were going to be shown. Keeping
 *     them would multiply the index by the number of word occurrences in the
 *     course; finding them on demand costs one regex pass over 24 documents.
 *   - **A stemmer.** A course is a mix of English, symbols and notation, and a
 *     stemmer trained on none of it turns "series" into "seri". Prefix ranges
 *     over the sorted vocabulary do the same job with no dictionary: the query
 *     reaches every word it starts, and — via a shortened stem of its own —
 *     the words that start it, which is the "metastability finds metastable"
 *     case a prefix alone cannot reach.
 * ==========================================================================*/

/* Letters and numbers in any script: a course's prose is English, but its
   content is not, and `[a-z0-9]` drops every symbol maths flattens to. */
const TOKEN = /[\p{L}\p{N}]+/gu;

/* A title is a name. Matching one is a far stronger statement than matching
   one word out of two thousand, so the two fields are scored separately and
   the title's is weighted up rather than merged into the body's. */
const TITLE_W = 4.2, TEXT_W = 1;
const K1 = 1.2, B = 0.6;

/* What an index token is worth to a query word that is not exactly it. A stem
   match is a guess — "integra" reaches "integral" and "integrating" alike, and
   only one of them is what was typed — so it is worth a quarter of the word
   itself, enough to surface a relative and not enough to outrank the thing. */
const W_EXACT = 1, W_PREFIX = 0.78, W_STEM = 0.25;
/* "a" is a prefix of most of the vocabulary. Past this the expansion is cut to
   the tokens closest in length to what was typed, which is the likelier
   intent than an alphabetical slice of everything. */
const EXPAND_MAX = 48;

const LIMIT = 24;
const WIN = 150;        /* the snippet window, in characters */
const LEAD = 45;        /* how much of it sits before the first mark */
const MAX_HITS = 400;   /* per document, when locating mentions for a snippet */

/* ------------------------------------------------------------ the index --*/

/** Count one field's tokens into `post` as a flat [doc, tf, doc, tf, …]. */
function tally(text, post, d, lens) {
  const seen = new Map();
  let n = 0;
  TOKEN.lastIndex = 0;
  for (let m; (m = TOKEN.exec(text));) {
    seen.set(m[0], (seen.get(m[0]) || 0) + 1);
    n++;
  }
  for (const [t, tf] of seen) {
    let p = post.get(t);
    if (!p) post.set(t, (p = []));
    p.push(d, tf);
  }
  lens.push(n);
}

function build(SEARCH) {
  const postT = new Map(), postX = new Map(), lenT = [], lenX = [];
  SEARCH.forEach((e, d) => {
    tally(String(e.title || "").toLowerCase(), postT, d, lenT);
    tally(String(e.text || "").toLowerCase(), postX, d, lenX);
  });
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 1) || 1;
  return {
    entries: SEARCH, n: SEARCH.length,
    postT, postX, lenT, lenX, avgT: mean(lenT), avgX: mean(lenX),
    vocab: [...new Set([...postT.keys(), ...postX.keys()])].sort()
  };
}

/* Held against the SEARCH array itself, which `buildIndex` produces once per
   course and `app.jsx` memoises — so the index outlives an overlay being
   opened and closed, and dies with the course. */
const CACHE = new WeakMap();

export function engineFor(SEARCH) {
  let e = CACHE.get(SEARCH);
  if (!e) CACHE.set(SEARCH, (e = build(SEARCH)));
  return e;
}

/** Build the index ahead of the first query. app.jsx calls this when idle. */
export const warm = SEARCH => { if (SEARCH) engineFor(SEARCH); };

/* ------------------------------------------------------------- querying --*/

/** Every vocabulary token starting with `p`, by binary search on the sort. */
function startingWith(vocab, p) {
  let lo = 0, hi = vocab.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (vocab[m] < p) lo = m + 1; else hi = m;
  }
  const out = [];
  for (let i = lo; i < vocab.length && vocab[i].startsWith(p); i++) out.push(vocab[i]);
  return out;
}

/** The shortened form of a word that its relatives also start with. */
const stemOf = w => (w.length >= 5 ? w.slice(0, Math.max(5, Math.ceil(w.length * 0.6))) : w);

/** Which index tokens a query word reaches, and what each is worth. */
function expand(E, w) {
  const out = new Map();
  const add = (t, wt) => { if (!(out.get(t) >= wt)) out.set(t, wt); };
  startingWith(E.vocab, w).forEach(t => add(t, t === w ? W_EXACT : W_PREFIX));
  const stem = stemOf(w);
  if (stem !== w) startingWith(E.vocab, stem).forEach(t => add(t, W_STEM));
  if (out.size <= EXPAND_MAX) return out;
  return new Map([...out].sort((a, b) => a[0].length - b[0].length).slice(0, EXPAND_MAX));
}

/**
 * Score one field for one query word, into `acc`.
 *
 * Each expanded token is scored on its own and then discounted, rather than
 * having the discount applied to a term frequency the two share. BM25
 * saturates: at k1 = 1.2 the difference between one occurrence and half of one
 * is almost nothing, so folding the weight into `tf` all but erased it, and a
 * stem match in a title beat an exact match in the body. Scoring per token also
 * gets each one its own idf, which is the point of the expansion — "integral"
 * is a common word in this course and "integrating" is not, and they should not
 * be worth the same.
 *
 * The best token wins outright rather than the expansion being added up. One
 * query word is one piece of evidence however many spellings of it a document
 * happens to hold, and summing turned "integrating factor" into a contest
 * nothing about integrating factors could win: a subsection saying "integral",
 * "integrals", "integrate" and "integration" collected four discounted scores
 * and beat the one that says "integrating factor" eighteen times.
 *
 * The document frequency comes free: a postings list is [doc, tf, …].
 */
function fieldScore(post, toks, N, lens, avg, acc, floor) {
  for (const [t, wt] of toks) {
    if (wt < floor) continue;
    const p = post.get(t);
    if (!p) continue;
    const df = p.length / 2;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (let i = 0; i < p.length; i += 2) {
      const d = p[i], tf = p[i + 1];
      const s = wt * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * ((lens[d] || 1) / avg))));
      if (s > (acc.get(d) || 0)) acc.set(d, s);
    }
  }
}

/* ------------------------------------------------------------- snippets --*/

/* The same reach as the index — a word, or anything starting with its stem —
   expressed as one pass over the document rather than a vocabulary lookup.
   Every token in a document is in the vocabulary by construction, so the two
   agree on what counts as a mention. */
function marker(terms) {
  const alts = terms.map(w => stemOf(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp("(?<![\\p{L}\\p{N}])(?:" + alts.join("|") + ")[\\p{L}\\p{N}]*", "giu");
}

/** Every mention in `text`, as [offset, length, which term]. */
function mentionsIn(text, terms, re) {
  const stems = terms.map(stemOf);
  const out = [];
  re.lastIndex = 0;
  for (let m; (m = re.exec(text)) && out.length < MAX_HITS;) {
    const low = m[0].toLowerCase();
    let k = stems.findIndex(s => low.startsWith(s));
    out.push([m.index, m[0].length, k < 0 ? 0 : k]);
    if (m[0] === "") re.lastIndex++;      /* a zero-width match cannot advance */
  }
  return out;
}

/**
 * The window that carries the most of the query at once.
 *
 * A snippet cut at the first mention answers "does this word appear here",
 * which the result row already answered by existing. The passage where the
 * reader's words come *together* is the one that says whether this is the
 * entry they meant, so that is the one shown.
 */
function bestWindow(hits, nTerms) {
  let at = hits.length ? hits[0][0] : -1, cover = hits.length ? 1 : 0;
  for (let i = 0; i < hits.length; i++) {
    const set = new Set();
    for (let j = i; j < hits.length && hits[j][0] - hits[i][0] <= WIN; j++) set.add(hits[j][2]);
    if (set.size > cover) { cover = set.size; at = hits[i][0]; }
    if (cover === nTerms) break;
  }
  return { at, cover };
}

/** A run of `{t, hit}` parts, so the caller marks matches without raw HTML. */
function parts(text, hits, from, to) {
  const out = [];
  let at = from;
  for (const [i, len] of hits) {
    if (i + len <= from) continue;
    if (i >= to) break;
    if (i > at) out.push({ t: text.slice(at, i) });
    out.push({ t: text.slice(Math.max(i, from), Math.min(i + len, to)), hit: true });
    at = Math.min(i + len, to);
  }
  if (at < to) out.push({ t: text.slice(at, to) });
  return out.filter(p => p.t);
}

function snippet(text, terms, re) {
  const hits = mentionsIn(text, terms, re);
  if (!hits.length) return { parts: [{ t: text.slice(0, 120) }], mentions: 0 };
  const { at } = bestWindow(hits, terms.length);
  const from = Math.max(0, at - LEAD);
  const to = Math.min(text.length, from + WIN + LEAD);
  const p = parts(text, hits, from, to);
  if (from > 0) p.unshift({ t: "…" });
  if (to < text.length) p.push({ t: "…" });
  return { parts: p, mentions: hits.length };
}

/* ------------------------------------------------------------------ run --*/

/**
 * Ranked results for `qs` over one course's SEARCH entries.
 *
 * `{ e, score, mentions, parts, title }` — `parts` and `title` are runs of
 * `{t, hit}` for the caller to mark up, and `mentions` is how many times the
 * query actually occurs in the body, which is the number that distinguishes a
 * passing reference from where the subject is discussed.
 */
export function searchRun(SEARCH, qs) {
  const E = engineFor(SEARCH);
  const terms = [...new Set((String(qs).toLowerCase().match(TOKEN) || []))];
  if (!terms.length) return [];

  const score = new Map(), cover = new Map();
  terms.forEach(w => {
    const toks = expand(E, w);
    if (!toks.size) return;
    const tAcc = new Map(), xAcc = new Map();
    /* A title is a name, and a name is matched rather than approximated: the
       stem guesses reach the body only. Without that floor, "integrals" in a
       title outscored "integrating factor" said eighteen times in the text —
       and a subsection's own title is part of its body text anyway, so a
       genuine relative is still found, at the weight a guess deserves. */
    fieldScore(E.postT, toks, E.n, E.lenT, E.avgT, tAcc, W_PREFIX);
    fieldScore(E.postX, toks, E.n, E.lenX, E.avgX, xAcc, 0);
    for (const d of new Set([...tAcc.keys(), ...xAcc.keys()])) {
      score.set(d, (score.get(d) || 0) +
        TITLE_W * (tAcc.get(d) || 0) + TEXT_W * (xAcc.get(d) || 0));
      cover.set(d, (cover.get(d) || 0) + 1);
    }
  });
  if (!score.size) return [];

  /* Every word, when every word can be had. Score alone would let an entry
     matching one word of three outrank one that matches all three but says
     each of them once, which is the wrong answer to a multi-word query. When
     nothing matches all of them the best available coverage is shown rather
     than nothing at all. */
  const best = Math.max(...cover.values());
  const rows = [...score.keys()].filter(d => cover.get(d) === best)
    .sort((a, b) => score.get(b) - score.get(a))
    .slice(0, LIMIT);

  const re = marker(terms);
  return rows.map(d => {
    const e = E.entries[d];
    const s = snippet(String(e.text || ""), terms, re);
    return { e, score: score.get(d), mentions: s.mentions, parts: s.parts,
             title: parts(String(e.title || ""), mentionsIn(String(e.title || ""), terms, re),
                          0, String(e.title || "").length) };
  });
}
