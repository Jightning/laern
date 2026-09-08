#!/usr/bin/env node
/* Proves the central claim continuously: a new subject needs no code.
 * Scaffolds a throwaway course from courses/_template, rebuilds the shared
 * page (which then holds two courses, exercising the library view), validates
 * and tests it, then removes the probe and rebuilds clean.
 */
import { rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TITLE = "Cloneability Probe";
const name = "probe" + Date.now().toString(36);
const dir = join(ROOT, "courses", name);
const run = (f, a = []) => execFileSync(process.execPath, [join(ROOT, "tools", f), ...a],
  { cwd: ROOT, encoding: "utf8" });

/* The probe is a whole course sitting in courses/, and the run that plants it
 * spends over ten minutes inside test-ui. If it dies without unwinding, the
 * scaffold is stranded — and a stranded probe is not inert, it silently joins
 * the next build as a ninth subject. One was found in the tree this way.
 *
 * Cleaning up on the way out cannot cover it. Ctrl-C at a terminal signals the
 * whole process group, so the child dies, execFileSync throws, and the finally
 * below already handles that. Anything that signals only this process is the
 * case that strands, and a handler cannot help there either: execFileSync
 * blocks the event loop, so a handler registered here would not run until the
 * child it is waiting on had finished anyway. SIGKILL runs nothing at all.
 *
 * So the guard runs on the way *in*, where nothing can prevent it. It matches
 * on the scaffold's own title and not the name prefix alone, so no real course
 * can be caught by it.
 */
function sweep() {
  for (const n of readdirSync(join(ROOT, "courses"))) {
    if (!/^probe[0-9a-z]+$/.test(n)) continue;
    const y = join(ROOT, "courses", n, "course.yaml");
    if (existsSync(y) && readFileSync(y, "utf8").includes(TITLE))
      rmSync(join(ROOT, "courses", n), { recursive: true, force: true });
  }
}
sweep();

let ok = false, detail = "";
try {
  run("new-course.mjs", [name, TITLE]);
  const built = run("build.mjs");
  if (!new RegExp(name + "[\\s\\S]*?no code").test(built))
    throw new Error("probe course required custom code");
  run("validate.mjs", [name]);
  const tested = run("test-ui.mjs");
  if (!/^ok/m.test(tested)) throw new Error("probe course failed UI checks:\n" + tested);
  const m = /(\d+) course\(s\)/.exec(tested);
  detail = m ? ` · library exercised with ${m[1]} courses` : "";
  ok = true;
} catch (e) {
  console.error("FAIL template  a new subject could not be created from data alone");
  console.error((e.stdout || "") + (e.stderr || e.message));
  process.exitCode = 1;
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  sweep();
  try { run("build.mjs"); } catch { /* reported above */ }
}
if (ok) console.log(`ok   template  scaffold → build → validate → test · no code required${detail}`);
