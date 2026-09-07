#!/usr/bin/env node
/* ============================================================================
 * tools/deploy.mjs — build, publish, prune, and check
 *
 *   node tools/deploy.mjs            # keep the 2 newest deployments
 *   KEEP=1 node tools/deploy.mjs     # keep only the one just published
 *
 * Three things happen after the upload, and each exists because forgetting it
 * fails silently.
 *
 * **Prune.** Cloudflare never expires a deployment. Every one keeps its own
 * permanent `<hash>.<project>.pages.dev` address and goes on serving whatever
 * was in it, forever. Since a course is private by *absence* from the build,
 * an old deployment is a standing copy of everything that was public when it
 * was made. Keeping a couple for rollback is reasonable; keeping all of them
 * means the oldest mistake is the one still online.
 *
 * **Verify.** The production alias is checked for a course that should not be
 * there. This catches a stale `dist/` — uploading a folder built before a
 * course was made private looks exactly like a successful deploy, and the only
 * symptom is material being readable by anyone.
 *
 * The production URL never changes. Each deployment gets an immutable hash
 * address, and `<project>.pages.dev` is an alias that always points at the
 * newest one.
 * ==========================================================================*/
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEEP = Math.max(1, Number(process.env.KEEP) || 2);

const project = (() => {
  const m = /^\s*name\s*=\s*"([^"]+)"/m.exec(readFileSync(join(ROOT, "wrangler.toml"), "utf8"));
  if (!m) throw new Error("wrangler.toml has no project name");
  return m[1];
})();

const run = (args, opts = {}) =>
  execFileSync("npx", ["wrangler", ...args], { cwd: ROOT, encoding: "utf8", ...opts });

/* A failing step has already printed why; a Node stack trace on top of it just
   buries the message. */
const step = (what, fn) => {
  try { return fn(); }
  catch { console.error(`\n${what} failed — see the output above.`); process.exit(1); }
};

/* --------------------------------------------------------------- 1. build --*/
console.log("building…");
step("build", () =>
  execFileSync(process.execPath, [join(ROOT, "tools", "build.mjs")], { cwd: ROOT, stdio: "inherit" }));

/* --------------------------------------------------------------- 2. ship ---*/
console.log("\npublishing…");
step("publish", () =>
  execFileSync("npx", ["wrangler", "pages", "deploy", "dist", "--project-name", project],
    { cwd: ROOT, stdio: "inherit" }));

/* -------------------------------------------------------------- 3. prune ---*/
const list = () => {
  const out = run(["pages", "deployment", "list", "--project-name", project, "--json"]);
  return JSON.parse(out.slice(out.indexOf("[")));
};

let deployments = [];
try { deployments = list(); }
catch (e) { console.error("\ncould not list deployments; nothing pruned:", e.message); }

const stale = deployments.slice(KEEP);
if (stale.length) {
  console.log(`\npruning ${stale.length} old deployment(s), keeping the newest ${KEEP}:`);
  for (const d of stale) {
    try {
      run(["pages", "deployment", "delete", d.Id, "--project-name", project],
        { stdio: ["ignore", "pipe", "pipe"] });
      console.log(`  deleted ${d.Id.slice(0, 8)}  (${d.Status})`);
    } catch (e) {
      console.error(`  could not delete ${d.Id.slice(0, 8)}: ${e.message.split("\n")[0]}`);
    }
  }
} else if (deployments.length) {
  console.log(`\n${deployments.length} deployment(s); nothing to prune (keeping ${KEEP}).`);
}

/* ------------------------------------------------------------- 4. verify ---*/
const origin = (deployments[0] && deployments[0].Deployment || "")
  .replace(/^https:\/\/[0-9a-f]+\./, "https://");
if (!origin) { console.log("\nno production URL to check."); process.exit(0); }

const shipped = existsSync(join(ROOT, "dist", "courses"))
  ? readdirSync(join(ROOT, "dist", "courses")).map(f => f.replace(/\.json$/, ""))
  : [];
const priv = readdirSync(join(ROOT, "courses"), { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith("_"))
  .map(d => d.name)
  .filter(id => !shipped.includes(id));

console.log(`\nchecking ${origin}`);
console.log(`  public:  ${shipped.join(", ") || "(none)"}`);

/* Pages answers a missing file with index.html and HTTP 200, so status alone
   proves nothing — a course is present only if the response is actually JSON.
 *
 * And a course can be absent from the deployment yet still served from
 * Cloudflare's edge cache, which holds `/courses/*` for seven days and has no
 * purge API on pages.dev. The two are told apart by asking twice: a
 * cache-busting query reaches the deployment, the plain URL reaches the public.
 * Re-deploying fixes one and cannot touch the other. */
const present = async url => {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok && (res.headers.get("content-type") || "").includes("json");
  } catch { return false; }
};

const inDeploy = [], inCache = [];
for (const id of priv) {
  const url = `${origin}/courses/${id}.json`;
  if (await present(`${url}?nocache=${Date.now()}`)) inDeploy.push(id);
  else if (await present(url)) inCache.push(id);
}

if (inDeploy.length) {
  console.error(`\n  ✗ IN THE DEPLOYMENT: ${inDeploy.join(", ")}`);
  console.error(`    The uploaded dist/ was not the one just built. Re-run this command.`);
}
if (inCache.length) {
  console.error(`\n  ! STILL IN CLOUDFLARE'S CACHE: ${inCache.join(", ")}`);
  console.error(`    Not in this deployment, but the edge cached them while they were`);
  console.error(`    public and holds /courses/* for 7 days. There is no purge API for`);
  console.error(`    pages.dev. They expire on their own; deleting and recreating the`);
  console.error(`    project under a new name is the only way to drop them sooner.`);
}
if (inDeploy.length) process.exit(1);
if (!inCache.length) console.log(`  private: ${priv.length} course(s), none reachable ✓`);
console.log(`\nlive at ${origin}`);
