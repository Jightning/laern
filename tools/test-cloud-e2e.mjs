#!/usr/bin/env node
/* Two devices, one account, the whole round trip in real browsers.
 *
 *   node tools/test-cloud-e2e.mjs
 *
 * tools/test-cloud.mjs proves the Functions behave; this proves the *product*
 * does. The distinction earned its place: the backend was correct and the
 * button still did nothing, because the client decided what to offer from a
 * local marker rather than from the account's listing, and no unit test on
 * either side could see the gap between them.
 *
 * So this runs the real page against the real handlers: one browser profile
 * holding courses, another holding none, a secret pasted into both, and the
 * assertion the reader actually cares about — press the button, and the other
 * device has the courses.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { d1, freshDb } from "./lib/d1shim.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SECRET = "e2e-secret-value";

const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("playwright not installed.  npm i -D playwright"); process.exit(2); }

const { onRequestPost: syncRoute } = await import("../functions/api/sync.js");
const { onRequestPost: courseRoute } = await import("../functions/api/course.js");

/* ------------------------------------------------------- the deployment, local
 * Static assets exactly as Pages serves them, plus the two Functions bound to
 * a real database. Requests are counted, because "one round trip per sync" is
 * a claim this file is in a position to check. */
const db = freshDb(join(ROOT, "tools/schema.sql"));
const counter = { n: 0 };
const hits = { sync: 0, course: 0 };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
               ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request("https://local" + url.pathname, {
      method: req.method,
      headers: req.headers.authorization ? { authorization: req.headers.authorization } : {},
      body: Buffer.concat(chunks).toString() || "{}"
    });
    const route = url.pathname.endsWith("/sync") ? syncRoute : courseRoute;
    hits[url.pathname.endsWith("/sync") ? "sync" : "course"]++;
    const out = await route({ request, env: { SYNC_SECRET: SECRET, DB: d1(db, counter) } });
    res.writeHead(out.status, { "content-type": "application/json" });
    return res.end(await out.text());
  }

  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const ORIGIN = `http://localhost:${server.address().port}`;

/* --------------------------------------------------------------- the devices */
const browser = await chromium.launch();
const laptop = await browser.newContext();   /* separate contexts: separate IndexedDB */
const phone = await browser.newContext();
const A = await laptop.newPage();
const B = await phone.newPage();
for (const p of [A, B]) p.on("pageerror", e => console.error("PAGEERROR:", e.message));

const enrol = async page => {
  await page.goto(ORIGIN + "/#/sync");
  await page.waitForTimeout(500);
  await page.fill("#cloud-secret", SECRET);
  await page.locator("#cloud-sync").click();
  await page.waitForTimeout(1200);
};
const backUp = async page => {
  await page.goto(ORIGIN + "/");
  await page.waitForTimeout(500);
  await page.locator("#cloud-sync").click();
  await page.waitForTimeout(2500);
  return page.locator(".sync-msg").innerText().catch(() => "");
};
const shelf = async page => {
  await page.goto(ORIGIN + "/");
  await page.waitForTimeout(600);
  return page.evaluate(() =>
    [...document.querySelectorAll(".lcard .lhit")].map(a => a.getAttribute("href").slice(2)));
};

/* A course that exists only on the laptop, installed the way a reader installs
   one — the same path a course pulled from anywhere else would land on. */
const course = {
  "course.yaml": "code: E2E 1\ntitle: Only On The Laptop\ntagline: one\n",
  "sections/01-a/_section.yaml": "title: A\n",
  "sections/01-a/1-b.yaml": "title: B\nblocks:\n  - t: p\n    h: hello\nquiz: []\n"
};
/* Both devices join the account first, while there is nothing to move: the
   scenario under test is "one device has everything, the other has nothing",
   and enrolling afterwards would resolve it before the assertions ran. */
await enrol(A);
await enrol(B);
const beforeB = await shelf(B);
check("the phone starts with only the bundled course",
      !beforeB.includes("onlylaptop"), beforeB.join(", "));

/* Installed through the UI, because that is how a course actually arrives. */
await A.goto(ORIGIN + "/");
await A.waitForTimeout(500);
await A.locator("#lib-add").click();
await A.waitForTimeout(300);
await A.locator('.modal .cio input[accept*="zip"]').setInputFiles([{
  name: "onlylaptop.course.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(course))
}]);
await A.waitForTimeout(1500);

const beforeA = await shelf(A);
check("the laptop has the course", beforeA.includes("onlylaptop"), beforeA.join(", "));

/* The report: press the button on the device that has the material. */
const msgA = await backUp(A);
check("the laptop reports handing it up", /backed up 1 course/i.test(msgA), msgA);

const msgB = await backUp(B);
check("the phone reports installing it", /installed 1/i.test(msgB), msgB);

const afterB = await shelf(B);
check("the phone now has the course", afterB.includes("onlylaptop"), afterB.join(", "));

/* Nothing changed since: the second press must not re-upload or re-download. */
hits.course = 0;
const again = await backUp(A);
check("an unchanged shelf transfers no bodies", hits.course === 0, `${hits.course} body calls`);
check("and says so rather than claiming work", !/backed up/i.test(again), again);

/* Deleting on one device reaches the other, and the bin offers it back. */
await A.goto(ORIGIN + "/");
await A.waitForTimeout(500);
await A.evaluate(() => [...document.querySelectorAll(".lcard")]
  .find(c => c.querySelector(".lhit").getAttribute("href") === "#/onlylaptop")
  .querySelector(".lop.warn").click());
await A.waitForTimeout(300);
await A.locator("#lib-drop").click();
await A.waitForTimeout(400);
await backUp(A);
await backUp(B);
const afterDelete = await shelf(B);
check("a deletion on one device removes it on the other",
      !afterDelete.includes("onlylaptop"), afterDelete.join(", "));

await A.goto(ORIGIN + "/");
await A.waitForTimeout(600);
const binButton = await A.locator("[data-restore='onlylaptop']").count();
check("the deleted course is offered back from the bin", binButton === 1);
if (binButton) {
  await A.locator("[data-restore='onlylaptop']").click();
  await A.waitForTimeout(2000);
  const restored = await shelf(A);
  check("restoring brings it back", restored.includes("onlylaptop"), restored.join(", "));
}

await browser.close();
server.close();
console.log(fail.length ? `\nFAIL cloud-e2e  ${fail.length} failing` : "\nall passing");
process.exitCode = fail.length ? 1 : 0;
