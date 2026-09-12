/* ============================================================================
 * tools/lib/digest.mjs — what a course already covers, in as few tokens as possible
 *
 * Non-redundancy (M2) is the constraint that makes authoring expensive: to
 * write subsection 20 without repeating subsections 1-19, something has to
 * know what 1-19 said. Replaying their prose costs ~85k tokens on ma26600.
 *
 * But M2 is a claim about *what* is covered, not *how* it was worded. The
 * terms a subsection defines, the rules it states, and the concepts it cites
 * answer it completely — and that digest is ~857 tokens for the same course,
 * a hundredth of the text it stands in for.
 *
 * Reads raw files rather than going through load.mjs: a course mid-build is
 * half-written by definition, and this must not care.
 * ==========================================================================*/
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { parseFile } from "./load.mjs";

const DATA = new Set([".yaml", ".yml", ".json"]);
const dataFiles = dir =>
  existsSync(dir) ? readdirSync(dir).filter(f => DATA.has(extname(f))).sort() : [];
const stem = f => basename(f, extname(f));
const read = p => { try { return parseFile(p) || {}; } catch { return {}; } };

/** leading digits of a filename: "03-linear" -> 3, "2-integrals" -> 2 */
const num = f => Number(/^(\d+)/.exec(f)?.[1] ?? 0);

const cited = blocks => {
  const out = new Set();
  for (const m of JSON.stringify(blocks || []).matchAll(/<c\s+k=\\?"([^"\\]+)/g)) out.add(m[1]);
  return [...out];
};

/** One line per subsection: id, title, what it defines, what it states, what it cites. */
function subLine(u, id) {
  const blocks = u.blocks || [];
  const defs = blocks.filter(b => b.t === "def").map(b => b.term).filter(Boolean);
  const keys = blocks.filter(b => b.t === "key").map(b => b.label).filter(Boolean);
  const types = (u.quiz || []).map(q => q.type).filter(Boolean);
  const parts = [`${id} ${u.title || "(untitled)"}`];
  if (defs.length) parts.push(`defines: ${defs.join("; ")}`);
  if (keys.length) parts.push(`states: ${keys.join("; ")}`);
  const c = cited(blocks);
  if (c.length) parts.push(`cites: ${c.join(",")}`);
  /* Which categories this subsection has already joined. Without it a later
     unit invents "invoke-labels" beside an existing "invocation-labels" and the
     taxonomy fragments — the same failure non-redundancy has, one level up. */
  const cats = [...new Set(blocks.map(b => b.cat).filter(Boolean))];
  if (cats.length) parts.push(`cat: ${cats.join(",")}`);
  if (types.length) parts.push(`quiz: ${types.join(",")}`);
  /* Claim coverage, so a later pass can see which blocks still state nothing
     at notes depth without reading their prose back. */
  const claims = blocks.filter(b => CLAIMY.has(b.t));
  if (claims.length) {
    const withCore = claims.filter(b => b.core).length;
    const withGist = claims.filter(b => b.gist).length;
    if (withCore + withGist < claims.length)
      parts.push(`unclaimed: ${claims.length - withCore - withGist}/${claims.length}`);
  }
  if (!blocks.length) parts.push("EMPTY");
  return parts.join(" | ");
}

/* The three block kinds that assert something, and therefore owe a claim. */
const CLAIMY = new Set(["def", "key", "trap"]);

/**
 * Walk a course folder, however far along it is.
 * Returns the structured view (for planning) and `text` (for prompts).
 */
export function digest(dir) {
  const sections = [];
  const secRoot = join(dir, "sections");
  for (const d of existsSync(secRoot) ? readdirSync(secRoot).sort() : []) {
    const path = join(secRoot, d);
    /* isDirectory, as lib/load.mjs already does on the same walk. Without it a
       stray file beside the section folders — a .DS_Store is how this was
       found — reaches readdirSync and throws ENOTDIR, so `author plan` dies on
       a course that builds and validates perfectly well. */
    if (!existsSync(path) || !statSync(path).isDirectory()) continue;
    if (!readdirSync(path).length) continue;
    const meta = dataFiles(path).find(f => stem(f) === "_section");
    const s = meta ? read(join(path, meta)) : {};
    const id = `s${num(d)}`;
    const subs = dataFiles(path)
      .filter(f => stem(f) !== "_section")
      .map(f => ({ file: f, n: num(f), data: read(join(path, f)) }))
      .sort((a, b) => a.n - b.n)
      .map((f, i) => ({
        id: `${id}-${i + 1}`,
        file: join(path, f.file),
        title: f.data.title || stem(f.file),
        blocks: (f.data.blocks || []).length,
        quiz: (f.data.quiz || []).length,
        tiers: new Set((f.data.blocks || []).map(b => b.tier || "spine")),
        line: subLine(f.data, `${id}-${i + 1}`)
      }));
    sections.push({ id, dir: path, title: s.title || d, blurb: !!s.blurb, subs });
  }

  const concepts = dataFiles(join(dir, "concepts")).map(f => {
    const c = read(join(dir, "concepts", f));
    const key = stem(f);
    return {
      key,
      term: c.term || key,
      review: !!c.review,
      body: !!c.body,
      drills: (read(join(dir, "drills", `${key}.yaml`)).items || []).length
    };
  });

  /* The declared taxonomy, so a unit tags into it rather than beside it. */
  const cats = dataFiles(join(dir, "categories")).map(f => {
    const c = read(join(dir, "categories", f));
    return { key: stem(f), name: c.name || stem(f), boundary: c.boundary || "",
             siblings: c.siblings || [] };
  });

  const subs = sections.flatMap(s => s.subs);
  const text = [
    sections.length ? "SECTIONS AND SUBSECTIONS (id, title, coverage)" : "",
    ...sections.map(s => [`${s.id} ${s.title}`, ...s.subs.map(u => "  " + u.line)].join("\n")),
    concepts.length ? "\nCONCEPTS (key, term, review, drill items)" : "",
    ...concepts.map(c => `  ${c.key} — ${c.term}${c.review ? " [review]" : ""} — ${c.drills} drills`),
    cats.length ? "\nCATEGORIES (key — name — boundary) — tag into these, never beside them" : "",
    ...cats.map(c => `  ${c.key} — ${c.name} — ${c.boundary.replace(/\s+/g, " ").trim()}`)
  ].filter(Boolean).join("\n");

  return { sections, subs, concepts, cats, text };
}
