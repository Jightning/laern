/* ============================================================================
 * tools/lib/files.mjs — a course as the files it is written in
 *
 * One map of path to text: what the build ships, what `npm run pack` writes,
 * what the app imports, what IndexedDB stores. Shared so the deployment and a
 * hand-packed file can never disagree about what a course is — including which
 * of them the deployment is allowed to hold at all.
 * ==========================================================================*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative, sep } from "node:path";

/* The courses that may reach the public deployment, named here and nowhere
   else. This was once a `publish: true` flag in course.yaml, which made
   exposure something an author could turn on by typing one line — in a file a
   model routinely rewrites. Coursework is not publishable material, so the set
   is closed: `demo` is the site's own showcase, and every other course reaches
   its reader's devices by import or sync. Adding to this list is a deliberate
   edit to the engine, which is the point. (`_`-prefixed folders, `_template`
   among them, are skipped before this is ever consulted.) */
export const PUBLIC = new Set(["demo"]);

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };

const TEXT = /\.(ya?ml|json|md)$/i;
const SKIP = new Set(["sources", "node_modules"]);

/** Every file of a course as text, keyed by its path relative to the folder. */
export
function courseFiles(dir, fail) {
  const files = {};
  let assetBytes = 0;

  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }

      const rel = relative(dir, full).split(sep).join("/");
      if (TEXT.test(e.name)) { files[rel] = readFileSync(full, "utf8"); continue; }

      /* Images travel as data URIs under their own path, so a course stays one
         self-contained map with nothing to fetch alongside it. */
      const type = MIME[extname(e.name).toLowerCase()];
      if (!type) continue;
      assetBytes += statSync(full).size;
      files[rel] = `data:${type};base64,${readFileSync(full).toString("base64")}`;
    }
  })(dir);

  if (assetBytes > 8e6) fail(`assets total ${(assetBytes / 1e6).toFixed(1)}MB`);
  return files;
}

