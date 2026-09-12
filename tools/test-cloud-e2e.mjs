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
const install = async page => {
  await page.goto(ORIGIN + "/");
  await page.waitForTimeout(500);
  await page.locator("#lib-add").click();
  await page.waitForTimeout(300);
  await page.locator('.modal .cio input[accept*="zip"]').setInputFiles([{
    name: "onlylaptop.course.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(course))
  }]);
  await page.waitForTimeout(1500);
};
await install(A);

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

/* Bin the course with this id, from the card that holds it.
 *
 * Management sits behind each card's overflow control, so removing a course is
 * two presses and the second one is on markup that does not exist until the
 * first has re-rendered — which is why this cannot be one page.evaluate. */
async function binCourse(P, cid) {
  const card = P.locator(".lcard").filter({ has: P.locator(`.lhit[href="#/${cid}"]`) });
  await card.locator(".lmore").click();
  await P.waitForTimeout(120);
  await card.locator(".lop.warn").click();
}

/* Deleting on one device reaches the other, and the bin offers it back. */
await A.goto(ORIGIN + "/");
await A.waitForTimeout(500);
await binCourse(A, "onlylaptop");
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

/* ------------------------------------------------------------ re-adding one --
 * The reported bug, in the reader's own words: "when I upload the new courses,
 * and then click backup now, they disappear."
 *
 * A removal leaves a tombstone, and the tombstone outlives it. The client read
 * every tombstone as "never resurrect", so the fresh import was not handed up —
 * and the pull, still holding a listing fetched before the push, then purged
 * the copy the reader had just installed, and its answers with it. The server
 * had always disagreed: a put clears the tombstone, "a restore by any other
 * name". This is the one path where the two had to agree. */
{
  /* Bin it again, so the account is holding a tombstone for this id. */
  await A.goto(ORIGIN + "/");
  await A.waitForTimeout(500);
  await binCourse(A, "onlylaptop");
  await A.waitForTimeout(300);
  await A.locator("#lib-drop").click();
  await A.waitForTimeout(400);
  await backUp(A);
  await backUp(B);

  /* Now add it back the way a reader does, and press the button. */
  await install(A);
  const readded = await shelf(A);
  check("the re-imported course is on the shelf before syncing",
        readded.includes("onlylaptop"), readded.join(", "));

  await backUp(A);
  const kept = await shelf(A);
  check("backing up does not delete a course just re-imported",
        kept.includes("onlylaptop"), kept.join(", "));

  /* And the tombstone is genuinely cleared, not merely ignored here. */
  await backUp(B);
  const onPhone = await shelf(B);
  check("the re-import reaches the other device too",
        onPhone.includes("onlylaptop"), onPhone.join(", "));
}

/* A push and a pull in one sync: the listing that came back is older than the
   upload, so a course handed up must not then be fetched straight back down. */
hits.course = 0;
await backUp(A);
check("a synced shelf still transfers no bodies", hits.course === 0, `${hits.course} body calls`);

await browser.close();
server.close();
console.log(fail.length ? `\nFAIL cloud-e2e  ${fail.length} failing` : "\nall passing");
process.exitCode = fail.length ? 1 : 0;
