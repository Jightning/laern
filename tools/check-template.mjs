#!/usr/bin/env node
/* Proves the central claim continuously: a new subject needs no code.
 * Scaffolds a throwaway course from courses/_template, rebuilds the shared
 * page (which then holds two courses, exercising the library view), validates
 * and tests it, then removes the probe and rebuilds clean.
 */
import { rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = "probe" + Date.now().toString(36);
const dir = join(ROOT, "courses", name);
const run = (f, a = []) => execFileSync(process.execPath, [join(ROOT, "tools", f), ...a],
  { cwd: ROOT, encoding: "utf8" });

let ok = false, detail = "";
try {
  run("new-course.mjs", [name, "Cloneability Probe"]);
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
  try { run("build.mjs"); } catch { /* reported above */ }
}
if (ok) console.log(`ok   template  scaffold → build → validate → test · no code required${detail}`);
