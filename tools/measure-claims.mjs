#!/usr/bin/env node
/* What a derived claim actually yields, per course, at several thresholds.
 *
 * `gist.js` falls back to the first sentence of a block whose author wrote no
 * `core:` or `gist:`, and the comment there quotes a number — 89% of ma26600's
 * unclaimed prose blocks, 82% of demo's. This is where that number comes from,
 * so the claim is reproducible rather than remembered.
 *
 * It also shows why the architecture's original measurement rejected
 * extraction: `pretrain.js`'s rule terminates a sentence on [.;:], so it cuts
 * at the colon introducing a list and returns the fragment before it. The gate
 * below terminates on [.!?] and rejects what is left over.
 *
 *   node tools/measure-claims.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { strip } from "../src/lib/util.js";
import { M } from "../src/lib/math.js";

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "courses");
const PROSE = new Set(["key", "trap", "note", "p"]);

function derive(h, minWords) {
  const t = strip(M(String(h || "")));
  if (!t) return null;
  const m = t.match(/^([\s\S]{20,200}?[.!?])(\s|$)/);
  const one = m ? m[1] : t;
  if (one.length > 200) return null;
  if (/[:;]$/.test(one)) return null;
  if (one.split(/\s+/).length < minWords) return null;
  return one;
}

for (const cid of readdirSync(ROOT).filter(d => !d.startsWith("_"))) {
  const secDir = join(ROOT, cid, "sections");
  if (!existsSync(secDir)) continue;
  const blocks = [];
  for (const sec of readdirSync(secDir)) {
    const d = join(secDir, sec);
    for (const f of readdirSync(d).filter(f => f.endsWith(".yaml") && !f.startsWith("_"))) {
      let doc; try { doc = load(readFileSync(join(d, f), "utf8")); } catch { continue; }
      for (const b of (doc && doc.blocks) || []) blocks.push(b);
    }
  }
  const prose = blocks.filter(b => PROSE.has(b.t) && !b.core && !b.gist && String(b.h || "").trim());
  if (!blocks.length) continue;
  const row = [6, 8].map(n => {
    const got = prose.filter(b => derive(b.h, n)).length;
    return `${n}w: ${Math.round(got / Math.max(1, prose.length) * 100)}%`;
  }).join("  ");
  const authored = blocks.filter(b => b.core || b.gist).length;
  console.log(`${cid.padEnd(14)} ${String(blocks.length).padStart(4)} blocks · ` +
    `${String(authored).padStart(3)} authored · ${String(prose.length).padStart(4)} unclaimed prose · ${row}`);
}
