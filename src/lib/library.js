/* ============================================================================
 * src/lib/library.js — the one way any component reaches a course
 *
 * A course is a map of file path to text, fetched once and parsed in the
 * browser. Built-in courses ship as `courses/<id>.json` beside the app;
 * imported ones live in IndexedDB. Neither is compiled, so the bytes a model
 * writes are the bytes the app runs.
 *
 * `INDEX` is the part that is never lazy: the library card, the accent, and
 * the drill keys and retention target. lib/queue.js decides what is due from
 * drill *keys* alone, never the items, so the cross-course due badge is right
 * on first paint without fetching a single course.
 * ==========================================================================*/
import { INDEX as BUILTIN, ORDER as BUILTIN_ORDER } from "virtual:courses";
import { parseCourse } from "./parse.js";
import { imported, importedIndex } from "./courses.js";
import { getItem, setItem } from "./store.js";

/* Built-in courses the reader has dismissed.
 *
 * A bundled course cannot be deleted the way an imported one can — it ships
 * with the site, so the next reload would bring it back — but the demo is an
 * introductory guide, and a guide you have read should not sit on the shelf
 * forever. Dismissing it hides the card and nothing else: the entry stays in
 * INDEX, so a link to it still opens and an import cannot silently collide
 * with its id or its code. It is per device, like everything else the browser
 * holds about the reader.
 */
const HIDDEN = "hidden:v1";
const readHidden = () => {
  try { return new Set(JSON.parse(getItem(HIDDEN)) || []); } catch { return new Set(); }
};

/** The bundled courses currently dismissed, in the order the site ships them. */
export const dismissed = () => BUILTIN_ORDER.filter(id => readHidden().has(id));

/** Dismiss a bundled course, or bring it back. Imported courses are deleted
 *  outright (lib/courses.js) rather than hidden — there is a copy to delete. */
export function setDismissed(cid, on) {
  if (!BUILTIN[cid]) throw new Error(`${cid} is not a bundled course`);
  const set = readHidden();
  on ? set.add(cid) : set.delete(cid);
  setItem(HIDDEN, JSON.stringify([...set]));
  refresh();
}

const cache = Object.create(null);
const inflight = Object.create(null);

/* Mutated in place by `refresh`, never reassigned: components hold a reference
   to these from module load, and store.init() has not read IndexedDB yet when
   this file is first evaluated. main.jsx calls refresh() once init resolves. */
export const INDEX = { ...BUILTIN };
export const ORDER = [...BUILTIN_ORDER];

/** The course if it is already parsed, else null. Never fetches. */
export const peek = cid => cache[cid] || null;

const use = (cid, files) => {
  const { course, errors } = parseCourse(files);
  if (!course) throw new Error(errors[0] || "unreadable course");
  if (errors.length) console.warn(`${cid}:`, errors.join("; "));
  return (cache[cid] = course);
};

export async function get(cid) {
  if (cache[cid]) return cache[cid];
  if (inflight[cid]) return inflight[cid];
  if (!INDEX[cid]) return null;

  const own = imported(cid);
  if (own) return use(cid, own.files);

  inflight[cid] = fetch(`courses/${cid}.json`)
    .then(r => { if (!r.ok) throw new Error(`courses/${cid}.json ${r.status}`); return r.json(); })
    .then(files => { const c = use(cid, files); delete inflight[cid]; return c; })
    .catch(e => { delete inflight[cid]; throw e; });

  return inflight[cid];
}

/** Load several, skipping any that fail. Used by cross-course review. */
export async function getAll(cids) {
  const out = [];
  await Promise.all(cids.map(c => get(c).then(C => C && out.push([c, C]), () => {})));
  return out;
}

/** After an import, a delete, or a dismissal, so the next read sees the set. */
export function refresh() {
  const own = importedIndex();
  const gone = readHidden();
  for (const k of Object.keys(INDEX)) if (!BUILTIN[k] && !own[k]) delete INDEX[k];
  Object.assign(INDEX, own);
  /* Only the *listing* drops a dismissed course. Its INDEX entry stays, so a
     bookmark still resolves and `taken` still refuses an import that would
     collide with it. */
  ORDER.length = 0;
  ORDER.push(...BUILTIN_ORDER.filter(k => !gone.has(k)),
             ...Object.keys(own).filter(k => !BUILTIN[k]));
}
