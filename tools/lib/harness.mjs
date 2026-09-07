/* ============================================================================
 * tools/lib/harness.mjs — put the built app in front of a browser
 *
 * Two things every browser-driving tool now needs, and neither is obvious.
 *
 * Courses are fetched at runtime, so the page needs an origin: `file://` cannot
 * fetch. And only the courses in `PUBLIC` reach dist/, so the private ones —
 * which is every other one — arrive the way a reader's own courses do, through
 * the import control. Sweeping only the public course would leave every other
 * palette and every other course's routes ungated.
 * ==========================================================================*/
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json"
};

/** Serve dist/ on a free port. Returns { origin, close }. */
export async function serveDist(root) {
  const dist = join(root, "dist");
  if (!existsSync(join(dist, "index.html")))
    throw new Error("dist/ not built. run: npm run build");

  const server = createServer((q, res) => {
    const rel = decodeURIComponent((q.url || "/").split("?")[0]);
    /* The deployment has no Function; a sync attempt must not read as a fault. */
    if (rel.startsWith("/api/")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ cursor: 0, more: false, rows: [] }));
    }
    const file = join(dist, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });

  await new Promise(r => server.listen(0, r));
  return {
    origin: `http://localhost:${server.address().port}`,
    close: () => server.close()
  };
}

/**
 * Install every packed course into the page, as a reader would.
 * Returns how many were installed; zero when `packed/` is absent.
 */
export async function installPacked(page, root) {
  const packed = join(root, "packed");
  if (!existsSync(packed)) return 0;
  const files = readdirSync(packed).filter(f => f.endsWith(".course.json")).sort();
  if (!files.length) return 0;

  /* Install lives behind the shelf's plus now, so the dialog is opened the way
     a reader opens it. Two inputs inside it: a folder picker and a file picker.
     Packed courses are files, so target that one explicitly rather than by
     type. */
  await page.locator("#lib-add").click();
  await page.locator('.modal .cio input[accept*="zip"]').setInputFiles(files.map(f => join(packed, f)));
  /* One import parses and indexes a whole course; a shelf of them needs room. */
  await page.waitForTimeout(1000 + files.length * 400);
  /* The dialog is left open: its own message is what the caller checks, and the
     caller reloads the library immediately afterwards. */
  return files.length;
}
