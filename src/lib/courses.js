/* ============================================================================
 * src/lib/courses.js — courses the reader brought, and what the library needs
 *                      to know about them before opening one
 *
 * An imported course is stored exactly as it was written: a map of file path
 * to text. Nothing is compiled, so exporting is the same map back out and a
 * model edits the same YAML an author would.
 *
 * The index entry is derived once, on import, because the library card and the
 * cross-course due count are on screen before any course is opened and must
 * not each cost a parse.
 * ==========================================================================*/
import { allBooks, getBook, putBook, dropBook } from "./store.js";
import { parseCourse } from "./parse.js";

export const imported = cid => getBook(cid);

export function importedIndex() {
  const out = {};
  for (const b of allBooks()) out[b.id] = b.index;
  return out;
}

/** The scalars every view needs before the course itself is loaded. */
export function indexOf(course) {
  const subs = (course.sections || []).reduce((n, s) => n + s.subs.length, 0);
  const questions = (course.sections || []).reduce((n, s) =>
    n + s.subs.reduce((m, u) => m + (u.quiz || []).length, 0), 0);
  return {
    code: course.code || "",
    title: course.title || "",
    tagline: course.tagline || "",
    theme: { hue: Number((course.theme || {}).hue) || 0 },
    meta: course.meta || "",
    state: course.state || {},
    retention: course.retention || {},
    sections: (course.sections || []).length,
    subs, questions,
    drillKeys: Object.keys(course.drills || {})
      .filter(k => ((course.drills[k] || {}).items || []).length)
  };
}

/** The version this device holds, so sync can skip an unchanged course. */
export const versionOf = cid => (getBook(cid) || {}).version || null;

/**
 * Take a course in. `taken` is the ids and codes already in use, so a clash is
 * refused rather than silently merging two courses' progress — learner state
 * is keyed on `code`, so a duplicate would quietly pool two schedules.
 * `version` is the server's content hash, or null for a hand-installed file.
 */
export function importCourse(id, files, taken = {}, version = null) {
  const { course, errors } = parseCourse(files);
  if (!course) return { ok: false, errors };

  const index = indexOf(course);
  const clashes = [];
  if (taken.ids && taken.ids.includes(id) && !getBook(id))
    clashes.push(`a course with id "${id}" is already installed`);
  if (index.code && taken.codes && taken.codes[index.code] && taken.codes[index.code] !== id)
    clashes.push(`code "${index.code}" is already used by ${taken.codes[index.code]}`);
  if (clashes.length) return { ok: false, errors: clashes };

  putBook({ id, files, index, version, at: Date.now() });
  return { ok: true, errors, course, index };
}

export function removeCourse(cid) { dropBook(cid); }

/** After the server has taken a copy: record the version it assigned, so this
 *  device stops offering the course up on every sync. A null version is what
 *  marks a course as installed here and unknown to the server. */
export function markSynced(cid, version) {
  const b = getBook(cid);
  if (!b || !version) return false;
  putBook({ ...b, version });
  return true;
}


/** Everything needed to write the course back out, unchanged. */
export const filesOf = cid => (getBook(cid) || {}).files || null;
