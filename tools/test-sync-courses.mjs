#!/usr/bin/env node
/* Courses move both ways, and the staging area is a pipe rather than a store.
 *
 *   node tools/test-sync-courses.mjs
 *
 * The log syncs by union because rows are immutable and each is owned by one
 * device. Courses are neither, so they get the other rule — newest wins — and
 * the three things worth proving are that a course which exists on only one
 * device reaches the others, that an upload can never overwrite the authoring
 * source on disk, and that the staged copy is deleted once every device the
 * server knows about has taken it.
 *
 * Run against the real server on a scratch data directory, because the parts
 * that can go wrong (path handling, staging, purge) are the parts a stub would
 * not have.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const DATA = mkdtempSync(join(tmpdir(), "sync-"));
const PORT = 8900 + (process.pid % 90);
const TOKEN = "t".repeat(24);
mkdirSync(DATA, { recursive: true });
writeFileSync(join(DATA, "token"), TOKEN);

const srv = spawn(process.execPath, [join(ROOT, "tools", "sync-server.mjs")], {
  env: { ...process.env, SYNC_DIR: DATA, PORT: String(PORT), IDLE: "0" },
  stdio: ["ignore", "pipe", "pipe"]
});
const log = [];
srv.stdout.on("data", d => log.push(String(d)));
srv.stderr.on("data", d => log.push(String(d)));

const base = `http://127.0.0.1:${PORT}`;
const api = async (path, init = {}) => {
  const res = await fetch(base + path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}`, ...init.headers }
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

/* wait for the port */
for (let i = 0; i < 100; i++) {
  try { await fetch(base + "/courses", { headers: { authorization: `Bearer ${TOKEN}` } }); break; }
  catch { await new Promise(r => setTimeout(r, 50)); }
}

const phone = "phone-aaa", laptop = "laptop-bbb";
const course = {
  "course.yaml": "code: ZZ 1\ntitle: Handed To The Phone\ntagline: one\n",
  "sections/01-x/_section.yaml": "title: X\n",
  "sections/01-x/1-y.yaml": "title: Y\nblocks: []\nquiz: []\n"
};

/* Both devices exist as far as the server is concerned: it learns a device from
   the rows it has pushed, and that set is what "delivered to everyone" means. */
for (const dev of [phone, laptop]) {
  await api("/log", { method: "POST", body: JSON.stringify({
    device: dev, rows: [{ id: `${dev}:1:1`, ts: Date.now(), course: "demo" }] }) });
}

/* ---------------------------------------------------------------- upload --*/
const up = await api("/courses/handed", {
  method: "POST", body: JSON.stringify({ device: phone, files: course })
});
check("a device can hand a course up", up.status === 200 && up.body.staged === true,
      JSON.stringify(up.body));
check("the upload is staged, not written into courses/",
      existsSync(join(DATA, "courses", "handed.json")) &&
      !existsSync(join(ROOT, "courses", "handed")));

const listed = (await api("/courses")).body.courses;
check("a staged course is offered to the other devices",
      listed.some(c => c.id === "handed" && c.version === up.body.version));
check("it carries the title from its own course.yaml",
      (listed.find(c => c.id === "handed") || {}).title === "Handed To The Phone");
check("the courses on disk are still listed", listed.some(c => c.id === "demo"));

/* ------------------------------------------------------------- delivery --*/
const got = await api(`/courses/handed?device=${laptop}`);
check("the other device can fetch it",
      got.status === 200 && got.body.files["course.yaml"] === course["course.yaml"]);
check("the staged copy is purged once every known device has it",
      !existsSync(join(DATA, "courses", "handed.json")));
check("the purge is reported", log.join("").includes("delivered to every known device"));

/* --------------------------------------------------------------- guards --*/
const bad = await api("/courses/nope", {
  method: "POST", body: JSON.stringify({ device: phone, files: { "a.txt": "x" } }) });
check("a file map with no course.yaml is refused", bad.status === 400, String(bad.status));

const notext = await api("/courses/nope", {
  method: "POST", body: JSON.stringify({ device: phone, files: { "course.yaml": 7 } }) });
check("a non-text entry is refused", notext.status === 400, String(notext.status));

const traverse = await fetch(`${base}/courses/..%2f..%2fetc`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ device: phone, files: course })
});
check("an id that is a path is refused", traverse.status === 404 || traverse.status === 400,
      String(traverse.status));

const noauth = await fetch(`${base}/courses/handed`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ device: phone, files: course })
});
check("an upload without the token is refused", noauth.status === 401, String(noauth.status));

/* ------------------------------------------- the authoring source is read-only */
const again = await api("/courses/demo", {
  method: "POST", body: JSON.stringify({ device: phone, files: course }) });
check("an upload for a course authored here is refused", again.status === 409,
      String(again.status));
check("and the disk copy is untouched",
      (await api("/courses")).body.courses.find(c => c.id === "demo").title !== "Handed To The Phone");

srv.kill();
rmSync(DATA, { recursive: true, force: true });
console.log(fail.length ? `\nFAIL sync-courses  ${fail.length} failing` : "\nall passing");
process.exitCode = fail.length ? 1 : 0;
