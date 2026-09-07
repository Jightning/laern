/* ============================================================================
 * src/lib/intake.js — turn what a reader hands over into a course file map
 *
 * A course is a folder of YAML, and that is what a model writes when it follows
 * docs/create_course.md. So the app has to accept a folder, not a format of its
 * own invention — otherwise every edit needs a build step the reader may not
 * have.
 *
 * Three ways in, because no single one works everywhere:
 *
 *   folder   `webkitdirectory` — the best desktop experience, and unsupported
 *            on *every* mobile browser, iOS Safari included
 *   zip      the universal path: Finder and the iOS Files app both create them
 *            from a folder with one gesture
 *   json     one file of {path: text}, which is what `npm run pack` writes
 *
 * All three produce the same thing, so nothing downstream knows the difference.
 * ==========================================================================*/
import { unzipSync, strFromU8 } from "fflate";

const TEXT = /\.(ya?ml|json|md|txt)$/i;
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
               gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

const ext = p => (p.split(".").pop() || "").toLowerCase();

const b64 = bytes => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/* A folder zipped on any platform carries its own name on every entry, and a
   folder picked with webkitdirectory does too. Strip it, so "ma26600/" and a
   bare set of files produce the same map — and remember it, because it is the
   course id the reader chose by naming the folder. */
function splitPrefix(paths) {
  const parts = paths.map(p => p.split("/"));
  if (parts.some(p => p.length < 2)) return { prefix: "", id: "" };
  const first = parts[0][0];
  return parts.every(p => p[0] === first) ? { prefix: first + "/", id: first } : { prefix: "", id: "" };
}

const clean = p => p.replace(/^\.?\//, "").replace(/\\/g, "/");

/* Archives and pickers both carry entries a course has no use for, and some
   are actively hostile. Refuse rather than sanitise: a path trying to escape
   is not a mistake worth guessing the intent of. */
const junk = p => !p || p.endsWith("/") || /(^|\/)(\.|__MACOSX|node_modules)/.test(p);
const hostile = p => p.startsWith("/") || p.split("/").includes("..");

function build(entries) {
  const kept = entries.filter(e => !junk(clean(e.path)));
  for (const e of kept) if (hostile(clean(e.path))) throw new Error(`unsafe path: ${e.path}`);

  const { prefix, id } = splitPrefix(kept.map(e => clean(e.path)));
  const files = {};
  for (const e of kept) {
    const rel = clean(e.path).slice(prefix.length);
    if (!rel) continue;
    if (typeof e.text === "string") { files[rel] = e.text; continue; }
    const type = MIME[ext(rel)];
    if (type) files[rel] = `data:${type};base64,${b64(e.bytes)}`;
  }
  return { id, files };
}

/** A directory chosen with `webkitdirectory`, or any FileList with paths. */
export async function fromFolder(fileList) {
  const entries = [];
  for (const f of fileList) {
    const path = f.webkitRelativePath || f.name;
    if (junk(clean(path))) continue;
    entries.push(TEXT.test(path)
      ? { path, text: await f.text() }
      : { path, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return build(entries);
}

/** A .zip of the course folder. */
export async function fromZip(file) {
  let unzipped;
  try { unzipped = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch (e) { throw new Error(`could not read that zip: ${e.message}`); }

  const entries = Object.entries(unzipped).map(([path, bytes]) =>
    TEXT.test(path) ? { path, text: strFromU8(bytes) } : { path, bytes });
  const out = build(entries);
  if (!out.id) out.id = file.name.replace(/\.zip$/i, "");
  return out;
}

/** One JSON file of {path: text}, as `npm run pack` writes. */
export async function fromJSON(file) {
  let files;
  try { files = JSON.parse(await file.text()); }
  catch { throw new Error("that file is not valid JSON"); }
  if (!files || typeof files !== "object" || Array.isArray(files))
    throw new Error("expected a map of file paths to text");
  for (const p of Object.keys(files)) if (hostile(p)) throw new Error(`unsafe path: ${p}`);
  return { id: file.name.replace(/\.course\.json$/, "").replace(/\.json$/, ""), files };
}
