import { useState } from "preact/hooks";
import { importCourse, importedIndex } from "../lib/courses.js";
import { INDEX, refresh } from "../lib/library.js";
import { fromFolder, fromZip, fromJSON } from "../lib/intake.js";

/* Installing a course onto this device.
 *
 * A course is a folder of YAML — that is what a model writes when it follows
 * docs/create_course.md — so a folder is what this accepts. Re-importing the
 * same course replaces it, which is how an edit lands: hand the model the
 * folder, take back the changed folder, drop it here again. Answer history
 * survives, because learner state is keyed on the course code rather than on
 * the import.
 *
 * Nothing is uploaded. An installed course exists only in this browser, which
 * is why it can be private at all.
 *
 * This is the body of the library's Add dialog. Removing and exporting live on
 * the card of the course they act on (Library.jsx), where the object is in
 * front of the reader — a list of names under an install control made the
 * reader match a row to a card before they could act on it.
 *
 * What arrives is data from outside, so it is bounded before it is trusted. The
 * limits sit far above any real course — the largest here is 1.5MB
 * across 262 files — and far below anything that could wedge the tab.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_ENTRY = 2 * 1024 * 1024;

const kb = n => `${(n / 1024).toFixed(0)}KB`;

/* webkitdirectory is unsupported on every mobile browser, iOS Safari included,
   so the folder button is offered only where it works. Zip is the path that
   works everywhere. */
const canPickFolder = typeof document !== "undefined" &&
  "webkitdirectory" in document.createElement("input");

/** Refuse a file map before parsing it. Returns an error string, or null. */
function refuse(files) {
  const paths = Object.keys(files || {});
  if (!paths.length) return "that course is empty";
  if (paths.length > MAX_FILES) return `too many files (${paths.length}); the limit is ${MAX_FILES}`;
  let total = 0;
  for (const p of paths) {
    if (typeof files[p] !== "string") return `entry "${p}" is not text`;
    total += files[p].length;
    if (files[p].length > MAX_ENTRY) return `entry "${p}" is larger than ${kb(MAX_ENTRY)}`;
  }
  if (total > MAX_BYTES) return `that course is ${kb(total)}; the limit is ${kb(MAX_BYTES)}`;
  if (!paths.some(p => /^course\.(ya?ml|json)$/.test(p)))
    return "no course.yaml at the top level — is this a course folder?";
  return null;
}

export default function CourseIO({ onChange }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const installed = Object.keys(importedIndex());

  /* Throws on refusal; callers collect failures so one bad course in a
     selection does not stop the others. */
  const install = async ({ id, files }, label = "that course") => {
    /* Naming the source is the whole value of the message: a batch of five
       folders reporting "could not tell what this course is called" says
       nothing about which one to go and look at. */
    if (!id) throw new Error(
      `${label}: could not tell what this course is called — pick the course ` +
      `folder itself (the one holding course.yaml), not the files inside it`);
    const bad = refuse(files);
    if (bad) throw new Error(bad);

    const taken = { ids: Object.keys(INDEX), codes: {} };
    for (const [cid, e] of Object.entries(INDEX)) if (e.code) taken.codes[e.code] = cid;

    const r = importCourse(id, files, taken);
    if (!r.ok) throw new Error(r.errors.join("; "));
    if (r.errors.length) console.warn(`${id}:`, r.errors.join("\n"));
    return (r.index.title || id) + (installed.includes(id) ? " (updated)" : "");
  };

  const report = (ok, failed) => {
    refresh();
    onChange && onChange();
    setBusy(false);
    if (failed.length) console.warn(failed.join("\n"));
    setMsg({
      ok: failed.length === 0,
      text: [ok.length ? `Installed ${ok.join(", ")}.` : "",
             failed.length ? `${failed.length} failed — ${failed[0]}` +
               (failed.length > 1 ? ` (and ${failed.length - 1} more; see the console)` : "") : ""]
        .filter(Boolean).join(" ")
    });
  };

  /* A whole directory: every file arrives at once, each carrying its own path. */
  const takeFolder = async e => {
    const list = [...(e.currentTarget.files || [])];
    e.currentTarget.value = "";
    if (!list.length) return;
    setBusy(true); setMsg(null);
    /* Every entry from a directory picker carries the folder it came from, so
       the failure can name it even when the course id could not be derived. */
    const folder = (list[0].webkitRelativePath || list[0].name || "").split("/")[0]
      || "that folder";
    try { report([await install(await fromFolder(list), folder)], []); }
    catch (err) { report([], [err.message]); }
  };

  /* Zips and packed JSON, any number at once. */
  const takeFiles = async e => {
    const picked = [...(e.currentTarget.files || [])];
    e.currentTarget.value = "";
    if (!picked.length) return;
    setBusy(true); setMsg(null);

    const ok = [], failed = [];
    for (const f of picked) {
      try {
        if (f.size > MAX_BYTES) throw new Error(`${kb(f.size)} exceeds the ${kb(MAX_BYTES)} limit`);
        ok.push(await install(
          /\.zip$/i.test(f.name) ? await fromZip(f) : await fromJSON(f), f.name));
      } catch (err) {
        /* The label is already inside the message when install() threw it. */
        failed.push(err.message.startsWith(f.name) ? err.message : `${f.name}: ${err.message}`);
      }
    }
    report(ok, failed);
  };

  return (
    <div class="cio">
      <p>
        Refer to the github documentation on creating a new course.
      </p>

      <div class="cio-foot">
        {canPickFolder && (
          <label class="dbtn">
            {busy ? "Reading..." : "Upload course folder"}
            {/* Bare booleans, not empty strings: Preact assigns these as DOM
                properties, and `webkitdirectory=""` is falsy — the picker then
                silently behaves as an ordinary file input. */}
            <input type="file" webkitdirectory directory multiple
                   data-folder onChange={takeFolder} disabled={busy} hidden />
          </label>
        )}
        <label class={"dbtn" + (canPickFolder ? " ghost" : "")}>
          {busy ? "Reading..." : "Upload .zip or .json"}
          <input type="file" accept=".zip,.json,application/json,application/zip" multiple
                 onChange={takeFiles} disabled={busy} hidden />
        </label>
      </div>

      {!canPickFolder && (
        <p class="cal-cap">
          This browser cannot pick a folder. Compress the course folder first.
          On iPhone, long-press it in Files and choose Compress.
        </p>
      )}

      {msg && <p class={"cio-msg" + (msg.ok ? "" : " bad")}>{msg.text}</p>}
    </div>
  );
}
