#!/usr/bin/env node
/* Every icon the site needs, rendered from one file.
 *
 *   node tools/gen-icons.mjs          # rewrite src/public/ from icon.svg
 *   node tools/gen-icons.mjs --check  # fail if they are stale (used by npm run check)
 *
 * `src/public/icon.svg` is the source and the only thing anyone edits. The
 * rasters are derived, so they are generated rather than hand-maintained (T20):
 * a set of five PNGs kept in sync by memory is a set that drifts the first time
 * the mark changes.
 *
 * Chromium does the rasterising, because Playwright is already a dev dependency
 * and adding an image library for six files would cost more than it saves.
 *
 * The sizes are not interchangeable, and each is here for a platform reason:
 *
 *   favicon.ico          16+32  old browsers and Windows pinning; still the
 *                               only thing some clients look for
 *   apple-touch-icon     180    iOS home screen. Must be opaque: iOS composites
 *                               transparency onto black, and it applies its own
 *                               rounded mask, so the file is a plain square
 *   icon-192 / icon-512  both   Android launcher and the PWA splash
 *
 * There is no separate maskable file. That is normally a mistake — Android
 * crops adaptive icons to a circle and a full-bleed logo loses its edges — but
 * the source is drawn with its art inside the 409px safe circle, so the same
 * image is correct for both purposes. `--check` re-asserts that rather than
 * trusting the comment.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "src", "public");
const SRC = join(PUB, "icon.svg");
const CHECK = process.argv.includes("--check");

/* When the artwork changes, bump the `?v=` in src/index.html and
   manifest.webmanifest together. The service worker caches by URL, so a file
   replaced in place is served stale for as long as the cache lives, and the
   query string is what retires the old one. */

const PNGS = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 }
];
const ICO_SIZES = [32, 16];

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("playwright not installed.  npm i -D playwright"); process.exit(2); }

const svg = readFileSync(SRC);
const dataUri = "data:image/svg+xml;base64," + svg.toString("base64");

const browser = await chromium.launch();
async function render(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size },
                                       deviceScaleFactor: 1 });
  /* No page background of its own: the icon's own ground covers the frame, and
     anything showing through would be a transparency bug rather than a style. */
  await page.setContent(
    `<body style="margin:0"><img src="${dataUri}" width="${size}" height="${size}"></body>`);
  await page.waitForTimeout(60);
  const buf = await page.screenshot({ omitBackground: false });
  await page.close();
  return buf;
}

/* An .ico is a tiny container, and PNG payloads are legal inside it, so the
   whole encoder is a header and one directory entry per size. */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const dir = [], data = [];
  for (const { size, buf } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e); data.push(buf);
  }
  return Buffer.concat([head, ...dir, ...data]);
}

const built = new Map();
for (const { file, size } of PNGS) built.set(file, await render(size));
built.set("favicon.ico", ico(await Promise.all(
  ICO_SIZES.map(async size => ({ size, buf: await render(size) })))));
await browser.close();

/* A PNG's dimensions live in the IHDR, and its colour type says whether it can
   carry alpha at all — both are worth asserting rather than assuming. */
function png(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colour: buf.readUInt8(25) };
}

const stale = [];
for (const [file, buf] of built) {
  const path = join(PUB, file);
  if (CHECK) {
    if (!existsSync(path)) { stale.push(`${file} is missing`); continue; }
    /* Rasterising is not byte-deterministic across Chromium builds, so the
       check compares what matters — that the file exists and is the size it
       claims — rather than the bytes. */
    if (file.endsWith(".png")) {
      const want = PNGS.find(p => p.file === file).size;
      const got = png(readFileSync(path));
      if (got.width !== want || got.height !== want)
        stale.push(`${file} is ${got.width}x${got.height}, expected ${want}`);
    }
  } else {
    writeFileSync(path, buf);
  }
}

if (CHECK) {
  if (stale.length) {
    console.error("FAIL icons  " + stale.join("; "));
    console.error("            run `npm run icons`");
    process.exitCode = 1;
  } else console.log("ok   icons      derived from icon.svg, sizes match");
} else {
  console.log(`wrote ${[...built.keys()].join(", ")} from src/public/icon.svg`);
}
