#!/usr/bin/env node
/* Behavioural tests in a real browser. Loads the built index.html in Chromium
 * and asserts the engine contract for every course it contains.
 *
 *   node tools/test-ui.mjs [--shots]
 *
 * --shots also writes screenshots to .shots/ so the result can be looked at.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serveDist, installPacked } from "./lib/harness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { origin: ORIGIN, close: closeServer } = await serveDist(ROOT);

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("playwright not installed.  npm i -D playwright"); process.exit(2); }

const SHOTS = process.argv.includes("--shots");
const shotDir = join(ROOT, ".shots");
if (SHOTS) mkdirSync(shotDir, { recursive: true });

const URL = ORIGIN + "/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push("PAGEERROR: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()); });

const R = [];
const ck = (n, ok, x = "") => R.push({ n, ok, x });
const go = async (h = "") => { await page.goto(URL + h); await page.waitForTimeout(450); };
const shot = async name => { if (SHOTS) await page.screenshot({ path: join(shotDir, name + ".png") }); };

await go();

/* Only the courses in PUBLIC reach dist/, so the deployment ships one. The
   rest are private and arrive the way a reader's own courses do — through the
   import control — which both restores full coverage here and exercises that
   path on every run. */
const installed = await installPacked(page, ROOT);
if (installed) {
  const failed = await page.locator(".cio-msg.bad").count();
  ck("packed courses install", failed === 0,
     failed ? await page.locator(".cio-msg.bad").first().innerText() : `${installed} courses`);
  await go();
}

/* the app does not expose its data, so drive it through the DOM instead */
const courseIds = await page.evaluate(() =>
  [...document.querySelectorAll(".lcard .lhit")].map(a => a.getAttribute("href").slice(2)));
const single = courseIds.length === 0;
let ids = courseIds;

if (single) {
  /* one course redirects straight past the picker */
  const cid = await page.evaluate(() => (location.hash.match(/#\/([^/]+)/) || [])[1]);
  ids = [cid];
  ck("single course opens directly", !!cid, cid);
} else {
  ck("library lists courses", courseIds.length > 0, courseIds.join(", "));
  /* the picker has no sidebar, so it must not render inside the reserved
     sidebar track — it once did, at 308px of a 1440px viewport */
  const libW = await page.evaluate(() =>
    document.querySelector("main").getBoundingClientRect().width / innerWidth);
  ck("library uses the full width", libW > 0.9, Math.round(libW * 100) + "% of viewport");
  /* each card wears its own course's accent rotation. Two courses may pick the
     same hue, so the invariant is that the accent tracks the hue, not that all
     cards differ: as many distinct accents as there are distinct hues. */
  const hues = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".lcard")];
    return {
      h: new Set(cards.map(a => getComputedStyle(a).getPropertyValue("--hue").trim())).size,
      c: new Set(cards.map(a => getComputedStyle(a).borderTopColor)).size
    };
  });
  ck("card accent follows the course hue", hues.c === hues.h,
     hues.c + " accents / " + hues.h + " hues");
  await shot("library");

  /* Adding is a dialog behind a plus, not a slab under the shelf. */
  ck("the shelf carries an add control", await page.locator("#lib-add").count() === 1);
  await page.locator("#lib-add").click(); await page.waitForTimeout(220);
  ck("add opens a dialog", await page.locator("dialog.modal[open]").count() === 1);
  ck("the dialog holds the install controls",
     await page.locator(".modal .cio-foot .dbtn").count() >= 1);
  await shot("library-add");
  await page.keyboard.press("Escape"); await page.waitForTimeout(220);
  ck("escape closes the dialog", await page.locator(".modal").count() === 0);
  /* The top layer is what keeps it on screen once the reading column is
     zoomed: a fixed overlay inside .wrap is laid out against the zoomed
     column, not the viewport. */
  await page.keyboard.press("Control+Equal");
  await page.keyboard.press("Control+Equal");
  await page.waitForTimeout(250);
  await page.locator("#lib-add").click(); await page.waitForTimeout(250);
  const z = await page.evaluate(() => {
    const m = document.querySelector(".modal").getBoundingClientRect();
    return { on: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth,
             box: [Math.round(m.top), Math.round(m.height)] };
  });
  ck("the dialog ignores the reading column's zoom", z.on, z.box.join("/"));
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  await page.keyboard.press("Control+Digit0"); await page.waitForTimeout(200);

  /* Removal acts on the card it belongs to, and only on courses this device
     installed — the built-in one ships with the site and cannot be dropped. */
  const ops = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".lcard")];
    return { cards: cards.length,
             gone: cards.filter(c => c.querySelector(".lop.warn")).length,
             exports: cards.filter(c => c.querySelector(".lop:not(.warn)")).length,
             hit: document.querySelectorAll(".lcard .lhit").length };
  });
  ck("every card opens its course", ops.hit === ops.cards, `${ops.hit}/${ops.cards}`);
  /* Every course can leave the shelf — a bundled one is hidden rather than
     deleted, since the next load would bring it back either way. Only a course
     this device holds the bytes for can be exported. */
  ck("every card can be taken off the shelf", ops.gone === ops.cards,
     `${ops.gone} of ${ops.cards}`);
  ck("only imported courses offer export", ops.exports === ops.cards - 1 || ops.exports === ops.cards,
     `${ops.exports} of ${ops.cards} exportable`);

  const before = ops.cards;

  /* Remove and Hide do opposite things to the reader's answers — Remove purges
     them (lib/purge.js), Hide keeps them because it is reversible — so the two
     dialogs have to say opposite things. A confirmation that promised the wrong
     one would be the most expensive sentence in the product. */
  const openConfirm = word => page.evaluate(w => {
    const card = [...document.querySelectorAll(".lcard")]
      .find(c => c.querySelector(".lop.warn").textContent.trim() === w);
    if (!card) return false;
    card.querySelector(".lop.warn").click();
    return true;
  }, word);

  await openConfirm("Remove"); await page.waitForTimeout(220);
  ck("removal asks first", await page.locator(".modal.danger").count() === 1);
  const removeSays = await page.locator(".modal.danger").innerText();
  ck("removing says the answers go too",
     /* The wording is the author's; what is asserted is that both halves of the
        promise are made — irreversible, and the answers go too. */
     /answers[^.]*deleted/i.test(removeSays) && /cannot be undone/i.test(removeSays),
     removeSays.replace(/\s+/g, " "));
  /* A question waits in front of the reader; a notification slides in along an
     edge. The confirm is the first kind, and on a desktop it was rendering as
     the second: `.lib>*:last-child{margin-bottom:0}` matched the dialog and
     zeroed the bottom half of the `margin:auto` the browser centres it with,
     so it sat on the viewport floor. Measured rather than asserted on the
     rule, because any later rule reaching the dialog's margin breaks it the
     same way. The phone sheet is a deliberate exception and is checked
     alongside it, so a fix to one cannot quietly undo the other. */
  {
    const box = () => page.evaluate(() => {
      const r = document.querySelector("dialog[open]").getBoundingClientRect();
      return { top: Math.round(r.top), gap: Math.round(innerHeight - r.bottom) };
    });
    const wide = await box();
    ck("the confirm sits in the middle of a desktop window",
       Math.abs(wide.top - wide.gap) <= 2, `top ${wide.top} / bottom ${wide.gap}`);

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
    const narrow = await box();
    ck("the confirm stays centred on a phone rather than docking",
       Math.abs(narrow.top - narrow.gap) <= 2, `top ${narrow.top} / bottom ${narrow.gap}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(250);
  }

  await shot("library-remove");
  await page.locator(".modal.danger .dbtn.ghost").click(); await page.waitForTimeout(220);
  ck("cancelling removes nothing",
     await page.locator(".modal").count() === 0 &&
     await page.locator(".lcard").count() === before);

  /* An icon set is only correct if the page points at it and the platform
     constraints hold: iOS needs an opaque 180, Android crops to a circle, and
     the tab falls back to favicon.ico when SVG is not understood. */
  const icons = await page.evaluate(async () => {
    const link = sel => document.querySelector(sel)?.getAttribute("href") || "";
    const head = {
      svg: link('link[rel="icon"][type="image/svg+xml"]'),
      ico: link('link[rel="alternate icon"]'),
      apple: link('link[rel="apple-touch-icon"]'),
      themes: [...document.querySelectorAll('meta[name="theme-color"]')]
        .map(m => m.getAttribute("content"))
    };
    const status = {};
    for (const [k, href] of Object.entries(head)) {
      if (typeof href !== "string" || !href) continue;
      status[k] = (await fetch(href, { method: "GET" })).status;
    }
    const manifest = await (await fetch(link('link[rel="manifest"]'))).json();
    /* Every pixel opaque: iOS composites transparency onto black. */
    const img = new Image();
    img.src = head.apple;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = img.width;
    c.getContext("2d").drawImage(img, 0, 0);
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) clear++;
    return { head, status, manifest, appleSize: img.width, clear };
  });
  ck("the page points at an SVG favicon and an ICO fallback",
     /icon\.svg/.test(icons.head.svg) && /favicon\.ico/.test(icons.head.ico));
  ck("every icon the head names is actually served",
     Object.values(icons.status).every(s => s === 200), JSON.stringify(icons.status));
  ck("the apple icon is 180 square", icons.appleSize === 180, String(icons.appleSize));
  ck("and fully opaque, as iOS requires", icons.clear === 0, `${icons.clear} translucent pixels`);
  ck("the manifest declares a maskable icon",
     (icons.manifest.icons || []).some(i => i.purpose === "maskable"));
  ck("the browser chrome uses the app's own ground, per scheme",
     icons.head.themes.includes("#DFE3E9") && icons.head.themes.includes("#101319"),
     icons.head.themes.join(" "));

  /* The backup belongs to whoever holds the secret, and the site is public, so
     a reader without one must not be shown it, told about it, or able to spend
     its quota. The setup route is reachable only by knowing it. */
  const seenByVisitor = await page.evaluate(() => ({
    panel: document.querySelectorAll(".cloud").length,
    words: /backup|cloudflare|secret/i.test(document.querySelector(".lib").innerText)
  }));
  ck("a reader without the secret sees no backup panel", seenByVisitor.panel === 0);
  ck("and is told nothing about a backend", !seenByVisitor.words);

  await go("#/sync");
  ck("the setup route exists for whoever knows it",
     await page.locator("#cloud-secret").count() === 1);
  await page.fill("#cloud-secret", "suite-secret");
  await page.locator("#cloud-sync").click(); await page.waitForTimeout(400);
  await go();
  ck("entering a secret is what makes a device the owner's",
     await page.locator(".cloud").count() === 1);
  /* Put it back: the rest of the suite runs as an ordinary reader. */
  await page.locator("#cloud-forget").click(); await page.waitForTimeout(400);
  await go();
  ck("forgetting the secret removes it again", await page.locator(".cloud").count() === 0);

  /* The bundled guide: hidden, then brought back from the Add dialog. Its
     entry survives the hiding, so a link to it still opens. */
  const demo = await page.evaluate(() =>
    [...document.querySelectorAll(".lcard")]
      .find(c => c.querySelector(".lhit").getAttribute("href") === "#/demo")
      ?.querySelector(".lop.warn")?.textContent.trim());
  if (demo) {
    ck("the bundled course says hide, not remove", demo === "Hide", demo);
    await page.evaluate(() => [...document.querySelectorAll(".lcard")]
      .find(c => c.querySelector(".lhit").getAttribute("href") === "#/demo")
      .querySelector(".lop.warn").click());
    await page.waitForTimeout(200);
    const hideSays = await page.locator(".modal.danger").innerText();
    ck("hiding says the answers are kept, and that it comes back",
       /answers are kept/i.test(hideSays) && /add this back/i.test(hideSays),
       hideSays.replace(/\s+/g, " "));
    await page.locator("#lib-drop").click(); await page.waitForTimeout(300);
    ck("the bundled course leaves the shelf",
       await page.locator(".lcard").count() === before - 1);
    /* Hidden is not gone: the route still resolves, which is what keeps an old
       link and an id collision honest. */
    await go("#/demo");
    ck("a hidden course still opens from a link",
       await page.locator(".start h1").count() === 1);
    await go();
    ck("hiding survives a reload", await page.locator(".lcard").count() === before - 1);
    await page.locator("#lib-add").click(); await page.waitForTimeout(250);
    ck("the add dialog offers it back",
       await page.locator('[data-restore="demo"]').count() === 1);
    await page.locator('[data-restore="demo"]').click(); await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    ck("restoring puts it back", await page.locator(".lcard").count() === before);
  }

  /* The Home Screen advice is for a reader who is not already there. WebKit
     deletes an origin's storage after seven days without a visit and installing
     is the exemption, so once installed the sentence names a rule that no
     longer applies and an action already taken. Driven under an iOS user agent
     because that is the only place the warning is shown at all. */
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
              "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  for (const [where, standalone] of [["a Safari tab", false], ["the Home Screen", true]]) {
    const ip = await browser.newPage({ viewport: { width: 390, height: 844 },
                                       isMobile: true, hasTouch: true, userAgent: IOS });
    await ip.addInitScript(on => {
      Object.defineProperty(navigator, "standalone", { get: () => on, configurable: true });
      const mm = window.matchMedia.bind(window);
      window.matchMedia = q => /display-mode/.test(q)
        ? { matches: on && /standalone/.test(q), media: q,
            addEventListener() {}, removeEventListener() {},
            addListener() {}, removeListener() {} }
        : mm(q);
      /* storage that is never granted persistence, which is the case the
         warning exists for */
      if (navigator.storage) {
        navigator.storage.persisted = async () => false;
        navigator.storage.persist = async () => false;
      }
    }, standalone);
    await ip.goto(URL); await ip.waitForTimeout(400);
    await installPacked(ip, ROOT);
    await ip.goto(URL); await ip.waitForTimeout(1100);
    const warn = await ip.locator(".cio-warn").count();
    ck(`on ${where} the install advice is ${standalone ? "silent" : "shown"}`,
       standalone ? warn === 0 : warn === 1, "warnings: " + warn);
    await ip.close();
  }
}

for (const cid of ids) {
  const P = n => `${cid}: ${n}`;
  await go(`#/${cid}`);
  ck(P("course home renders"), await page.locator(".start h1").isVisible());
  const nSections = await page.locator(".toc .tocrow").count();
  ck(P("contents lists sections"), nSections > 0, nSections + " sections");
  await shot(cid + "-home");

  const secIds = await page.evaluate(() =>
    [...document.querySelectorAll(".toc .tocrow")].map(a => a.getAttribute("href").split("/").pop()));
  const last = secIds[secIds.length - 1];

  await go(`#/${cid}/${last}`);
  ck(P("one section in the flow"), await page.locator("section.sec-body").count() === 1);
  ck(P("no end-of-section dump"), await page.locator(".refby").count() === 0);

  /* T7/T8: the measure is a property of the face, not the pixel width, so it
     is measured rather than assumed — changing the body font moves it. */
  const cpl = await page.evaluate(() => {
    const para = [...document.querySelectorAll(".bmain p")].find(e => e.textContent.length > 200);
    if (!para) return null;
    const cs = getComputedStyle(para);
    const probe = document.createElement("span");
    probe.style.cssText = `font:${cs.font};visibility:hidden;position:absolute;white-space:pre`;
    probe.textContent = "abcdefghijklmnopqrstuvwxyz".repeat(2);
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 52;
    probe.remove();
    return Math.round(para.getBoundingClientRect().width / w);
  });
  if (cpl) ck(P("reading measure is 50-75 characters"), cpl >= 50 && cpl <= 75, cpl + " CPL");

  /* T7 must hold at the reader's text size too, not only the default. A px-locked
     body once made the UI scale while the prose did not. */
  const cplLarge = await page.evaluate(() => {
    document.documentElement.style.fontSize = "22px";
    const para = [...document.querySelectorAll(".bmain p")].find(e => e.textContent.length > 200);
    if (!para) return null;
    const cs = getComputedStyle(para);
    const s = document.createElement("span");
    s.style.cssText = `font:${cs.font};visibility:hidden;position:absolute;white-space:pre`;
    s.textContent = "abcdefghijklmnopqrstuvwxyz".repeat(2);
    document.body.appendChild(s);
    const w = para.getBoundingClientRect().width / (s.getBoundingClientRect().width / 52);
    s.remove();
    document.documentElement.style.fontSize = "";
    return Math.round(w);
  });
  if (cplLarge) ck(P("measure holds at 22px text"), cplLarge >= 50 && cplLarge <= 75, cplLarge + " CPL");

  /* T41: uppercase is for labels the reader scans. The renderer cannot tell a
     label from a sentence, so the check is the string — anything set in caps
     that runs past a short label is being shouted at the reader. Captions, the
     why_prompt, the answer and the course meta line all used to fail this. */
  const shouted = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      if (getComputedStyle(el).textTransform !== "uppercase") continue;
      if ([...el.children].some(c => getComputedStyle(c).textTransform === "uppercase")) continue;
      const t = el.textContent.trim().replace(/\s+/g, " ");
      if (t && t.split(" ").length > 5) bad.push(t.slice(0, 40));
    }
    return [...new Set(bad)];
  });
  ck(P("nothing longer than a label is set in caps"), shouted.length === 0, shouted.slice(0, 2).join(" | "));

  /* A row flow gives every step an equal share of the width, so a step is not
     as wide as its longest word: an unbreakable token was drawn straight
     through the step's border. Nothing inside a figure may exceed its own box
     unless that box is a scroll container. */
  const spill = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".fx-step, .fcap, .fx-leg span")) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "visible") continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        bad.push(el.className + " by " + (el.scrollWidth - el.clientWidth) + "px");
    }
    return bad;
  });
  ck(P("no figure step is drawn outside its own box"), spill.length === 0, spill.slice(0, 2).join(" "));

  /* The toolbar's contents line up with the reading column beneath it: the
     breadcrumb starts where the heading starts. They were 71px apart. */
  const crumbAlign = await page.evaluate(() => {
    const crumb = document.querySelector(".crumb").getBoundingClientRect();
    const text = document.querySelector(".bmain").getBoundingClientRect();
    return Math.round(Math.abs(crumb.left - text.left));
  });
  ck(P("the breadcrumb starts where the prose does"), crumbAlign <= 1, crumbAlign + "px apart");

  /* Collapsing the sidebar gives the reader the space rather than spending it
     on gutter, and cannot strand a narrow reader with no navigation at all. */
  if (await page.locator(".tuck").count()) {
    await page.locator(".tuck").click();
    await page.waitForTimeout(250);
    const t = await page.evaluate(() => {
      const b = document.querySelector(".bmain").getBoundingClientRect();
      const w = document.querySelector(".wrap").getBoundingClientRect();
      return {
        off: Math.round(Math.abs(b.left + b.width / 2 - innerWidth / 2)),
        gutter: Math.round(innerWidth - w.right),
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth)
      };
    });
    ck(P("tucked, the reading column is centred"), t.off <= 2, t.off + "px off centre");
    ck(P("tucked, the rail keeps a gutter"), t.gutter >= 20 && !t.overflow,
       t.gutter + "px, overflow " + t.overflow);
    /* Nothing sits in front of the crumb, so the bar stays aligned with the
       column beneath it here too. */
    const tuckedCrumb = await page.evaluate(() => {
      const crumb = document.querySelector(".crumb").getBoundingClientRect();
      const text = document.querySelector(".bmain").getBoundingClientRect();
      return Math.round(Math.abs(crumb.left - text.left));
    });
    ck(P("tucked, the breadcrumb still starts where the prose does"),
       tuckedCrumb <= 1, tuckedCrumb + "px apart");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(250);
    const stranded = await page.evaluate(() => !document.querySelector(".sidebar"));
    ck(P("the tuck does not strand a narrow reader"), !stranded);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(220);
    /* the control that brings it back is the tab, not the one that hid it */
    await page.locator(".untuck").click();
    await page.waitForTimeout(220);
  }

  /* T6: a control pushed off-screen is unreachable. The toolbar used to put
     Theme and Reset past the right edge on a phone. */
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(250);
  const narrow = await page.evaluate(() => {
    const bar = document.querySelector(".topbar");
    const shown = [...bar.querySelectorAll(".tbtn")].filter(b => b.offsetParent !== null);
    const mid = b => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; };
    return {
      overflow: document.body.scrollWidth > window.innerWidth + 1,
      offscreen: shown.filter(b => b.getBoundingClientRect().right > window.innerWidth + 1).length,
      barH: Math.round(bar.getBoundingClientRect().height),
      rows: new Set(shown.map(b => Math.round(mid(b)))).size,
      /* what moved into the drawer has to still exist there */
      drawer: document.querySelectorAll(".side-actions .tbtn").length,
      drawerShown: getComputedStyle(document.querySelector(".side-actions")).display !== "none"
    };
  });
  ck(P("no horizontal overflow at 390px"), !narrow.overflow);
  ck(P("no toolbar control off-screen at 390px"), narrow.offscreen === 0, narrow.offscreen + " clipped");
  /* The toolbar is sticky, so its height is charged against the reading area
     for the whole session. It was 142px of a 664px viewport, in two wrapped
     rows, before the secondary controls moved into the drawer. */
  ck(P("toolbar is one row on a phone"), narrow.rows === 1, narrow.rows + " rows");
  ck(P("toolbar costs under a sixth of a phone screen"), narrow.barH < 800 / 6, narrow.barH + "px");
  ck(P("the controls it sheds are in the drawer"), narrow.drawerShown && narrow.drawer >= 2,
     narrow.drawer + " in drawer");

  /* WCAG 2.5.8 is 24px; 44px is the platform guidance. Inline links inside a
     sentence are exempt and excluded. Measured by hit-testing rather than by
     reading boxes, because a target may be widened by a pseudo-element. */
  const taps = await page.evaluate(() => {
    const small = [];
    for (const el of document.querySelectorAll(
      ".topbar .tbtn, .crumb-home, .cbtn, .gbtn, .tstub-b, .note-pull")) {
      const r0 = el.getBoundingClientRect();
      if (!r0.width || !r0.height) continue;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const owns = y => { const t = document.elementFromPoint(cx, y); return t === el || el.contains(t); };
      let up = 0, down = 0;
      while (up < 24 && owns(cy - up - 1)) up++;
      while (down < 24 && owns(cy + down + 1)) down++;
      if (up + down < 24) small.push(el.className + ":" + (up + down));
    }
    return small;
  });
  ck(P("every control is at least 24px tappable"), taps.length === 0, taps.slice(0, 3).join(" "));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  await shot(cid + "-section");

  /* A flow figure is an ordered list with CSS connectors. It used to emit
     arrow characters between boxes, and the arrow — centred in the figure —
     never lined up with boxes sized by their own text. */
  const flows = await page.locator(".fx-flow").count();
  if (flows) {
    const flow = await page.evaluate(() => {
      const f = document.querySelector(".fx-flow");
      const steps = [...f.querySelectorAll(".fx-step")];
      return {
        ol: f.tagName === "OL",
        strayArrows: document.querySelectorAll(".fx-arr").length,
        /* every step starts on the same left edge, or in a row every step
           shares one top edge — either way nothing is half-aligned */
        aligned: new Set(steps.map(e => Math.round(e.getBoundingClientRect().left))).size === 1 ||
                 new Set(steps.map(e => Math.round(e.getBoundingClientRect().top))).size === 1,
        fits: [...document.querySelectorAll(".figure")].every(g =>
                g.scrollWidth <= g.clientWidth + 1)
      };
    });
    ck(P("flow figure is an ordered list"), flow.ol);
    ck(P("flow figure has no stray arrow glyphs"), flow.strayArrows === 0);
    ck(P("flow steps share an edge"), flow.aligned);
    ck(P("figures do not overflow their frame"), flow.fits);
  }

  /* Questions are separate cards, not one wall of text. */
  const qGap = await page.evaluate(() => {
    const q = document.querySelectorAll(".q");
    if (q.length < 2) return null;
    return Math.round(q[1].getBoundingClientRect().top - q[0].getBoundingClientRect().bottom);
  });
  if (qGap !== null) ck(P("questions are spaced apart"), qGap >= 12, qGap + "px");

  /* A margin stack is a margin, not a second column of prose. */
  const stack = await page.evaluate(() =>
    Math.max(0, ...[...document.querySelectorAll(".bside")].map(a => a.querySelectorAll(".mnote:not(.is-x):not(.is-f)").length)));
  ck(P("margin card stacks are bounded"), stack <= 2, stack + " cards");

  /* A row is as tall as the taller of the block and its card, so a card beside
     a one-line heading is paid for with a hole in the reading column. "Used
     later in" rides the first block instead, and where that block already
     carries reference cards it gives up its titles rather than the row. */
  const headCard = await page.evaluate(() =>
    [...document.querySelectorAll(".brow:has(h3) .bside .mnote.is-f")].length);
  ck(P("no full card beside a heading"), headCard === 0, headCard + " rows");
  const ulStack = await page.evaluate(() =>
    [...document.querySelectorAll(".bside:has(.mnote.is-f)")]
      .filter(a => a.querySelector(".mnote:not(.is-f)")
                && !a.querySelector(".mnote.is-f .mn-chips")).length);
  ck(P("used-later yields to reference cards"), ulStack === 0, ulStack + " rows");

  /* Maths is rendered at build time, so if it is wrong it is wrong here. */
  const maths = await page.locator(".katex").count();
  if (maths) {
    const m = await page.evaluate(() => {
      const k = document.querySelector(".katex");
      const mml = document.querySelector(".katex-mathml");
      const glyph = k.querySelector(".katex-html .mord");
      return {
        drew: !!glyph && glyph.getBoundingClientRect().width > 0,
        face: glyph ? getComputedStyle(glyph).fontFamily : "",
        /* KaTeX ships the equation twice; the MathML twin is for assistive
           technology and must never be painted, or every formula doubles */
        mathmlHidden: !mml || mml.getBoundingClientRect().height < 2
      };
    });
    ck(P("equations render"), m.drew);
    ck(P("KaTeX fonts are present"), /KaTeX/.test(m.face), m.face);
    ck(P("the MathML twin is not painted"), m.mathmlHidden);
  }

  /* figures must actually draw, not fail silently */
  const figs = await page.locator(".figure").count();
  if (figs) {
    const drawn = await page.locator(".figure svg, .figure .fx-flow, .figure .fx-grid, .figure .fx-mx, .figure .fx-tm").count();
    ck(P("figures draw a body"), drawn >= figs, `${drawn}/${figs}`);
  }
  ck(P("no render errors"), await page.locator(".blabel", { hasText: /Render error|Unknown block/ }).count() === 0);
  ck(P("no unrendered figure or block"), await page.locator(".fx-miss").count() === 0);

  /* A course may register its own block and style it from its own `styles`.
     Both were supported and unexercised; ECE 20001 uses both. */
  const custom = await page.evaluate(() => {
    const el = document.querySelector("svg.sc");
    if (!el) return null;
    const wire = el.querySelector(".sc-w");
    return { drew: !!wire, styled: wire && getComputedStyle(wire).strokeWidth !== "1px" };
  });
  if (custom) {
    ck(P("a course's own block renders"), custom.drew);
    ck(P("a course's own styles apply"), custom.styled);
  }
  ck(P("no unresolved figure references"), await page.locator(".xr-miss").count() === 0);

  /* a caption is citable only once it carries a number */
  const capped = await page.locator(".fcap, figcaption").count();
  if (capped) {
    const numbered = await page.locator(".fcap .fnum, figcaption .fnum").count();
    ck(P("captions are numbered"), numbered === capped, `${numbered}/${capped}`);
  }

  /* T6: the first tab stop must reach the material, not the rail */
  await page.evaluate(() => document.querySelector(".skip")?.focus());
  await page.waitForTimeout(250);      /* it slides in; measuring mid-transition lies */
  const skipVisible = await page.evaluate(() => {
    const el = document.querySelector(".skip");
    return !!el && el.getBoundingClientRect().top >= 0;
  });
  ck(P("skip link appears on focus"), skipVisible);

  /* The margin channel aligns with the block it annotates. A block that
     carries its own top margin pushes its text down while the card beside it
     stays put, so the note reads as floating above what it annotates. */
  const align = await page.evaluate(() => {
    const off = [];
    for (const r of document.querySelectorAll(".brow")) {
      const side = r.querySelector(".bside > *"), main = r.querySelector(".bmain > div > *");
      if (!side || !main) continue;
      const sb = side.getBoundingClientRect(), mb = main.getBoundingClientRect();
      /* only meaningful while the card is actually beside the block; below a
         breakpoint the row wraps and the card sits under it by design */
      if (sb.left < mb.right) continue;
      off.push(Math.round(sb.top - mb.top));
    }
    return off;
  });
  if (align.length) {
    const worst = align.reduce((a, b2) => Math.abs(b2) > Math.abs(a) ? b2 : a, 0);
    ck(P("margin cards align with their blocks"), Math.abs(worst) <= 2,
       `${align.length} rows, worst ${worst}px`);
  }

  /* A sidebar that scrolls away with the page is not navigation. */
  await page.evaluate(() => scrollTo(0, 1400));
  await page.waitForTimeout(350);
  const sbTop = await page.evaluate(() =>
    Math.round(document.querySelector(".sidebar").getBoundingClientRect().top));
  ck(P("sidebar stays put while the page scrolls"), sbTop >= -1 && sbTop <= 1, sbTop + "px");
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);

  /* Hovering a section must not move its neighbours: motion that carries no
     information is noise, and it once came from a mangled selector. */
  const rowsBefore = await page.evaluate(() =>
    [...document.querySelectorAll(".sec")].map(e => Math.round(e.getBoundingClientRect().top)));
  await page.locator(".sec-btn").nth(Math.min(3, nSections - 1)).hover();
  await page.waitForTimeout(250);
  const rowsAfter = await page.evaluate(() =>
    [...document.querySelectorAll(".sec")].map(e => Math.round(e.getBoundingClientRect().top)));
  const moved = rowsBefore.filter((v, i) => Math.abs(v - rowsAfter[i]) > 1).length;
  ck(P("hovering the rail moves nothing"), moved === 0, moved + " rows moved");
  /* Off the sidebar, not to 4,4 — that is over it, and the rail deliberately
     holds still while the pointer is on it. */
  await page.mouse.move(Math.round(page.viewportSize().width * 0.7), 400);

  /* The rail marks where the reader IS, not where they clicked. The two agree
     for one screen and then part company for the rest of the section, which is
     most of a session — a subsection runs 2000px and the route does not change
     while somebody reads. */
  const railSubs = await page.evaluate(() => [...document.querySelectorAll(".sub")].map(e => e.id));
  if (railSubs.length > 1) {
    const marked = () => page.evaluate(() =>
      document.querySelector(".rail .subs a.cur")?.getAttribute("href")?.split("/").pop() || null);
    /* Park the reader on the last subsection without touching the route. */
    await page.evaluate(id => {
      const el = document.getElementById(id);
      const bar = document.querySelector(".topbar").getBoundingClientRect().bottom;
      scrollTo({ top: scrollY + el.getBoundingClientRect().top - bar - 1, behavior: "instant" });
    }, railSubs[railSubs.length - 1]);
    await page.waitForTimeout(220);
    const at = await marked();
    const route = await page.evaluate(() => location.hash);
    ck(P("the rail follows the scroll, not the route"),
       at === railSubs[railSubs.length - 1] && !route.endsWith(at),
       `rail ${at}, route ${route}`);

    /* A mark below the fold of its own list is not a mark. At 900px of sidebar
       a 15-section course put it 721px down and a 62-section one 2021px down,
       so this is most courses, not an edge case. */
    /* The rail may still be gliding; a fixed wait is a guess, and on the
       62-section course it was the wrong one. */
    const railStill = async () => {
      let last = -1, same = 0;
      for (let i = 0; i < 40 && same < 3; i++) {
        const v = await page.evaluate(() => Math.round(document.querySelector(".sidebar").scrollTop));
        same = v === last ? same + 1 : 0;
        last = v;
        await page.waitForTimeout(50);
      }
      return last;
    };
    await railStill();
    ck(P("the rail keeps the mark in view"), await page.evaluate(() => {
      const side = document.querySelector(".sidebar");
      const cur = side.querySelector(".rail .subs a.cur");
      if (!cur) return true;
      const s = side.getBoundingClientRect(), c = cur.getBoundingClientRect();
      return c.top >= s.top - 1 && c.bottom <= s.bottom + 1;
    }));

    /* ...but never while the reader is working down the list by hand. */
    await page.evaluate(() => { document.querySelector(".sidebar").scrollTop = 0; });
    await railStill();                       /* no glide left to fight */
    await page.locator(".sidebar .brand").hover();
    await page.waitForTimeout(150);
    await page.evaluate(id => {
      const el = document.getElementById(id);
      const bar = document.querySelector(".topbar").getBoundingClientRect().bottom;
      scrollTo({ top: scrollY + el.getBoundingClientRect().top - bar - 1, behavior: "instant" });
    }, railSubs[0]);
    await page.waitForTimeout(500);
    ck(P("a hovered rail is not yanked"), (await railStill()) === 0);
    await page.mouse.move(Math.round(page.viewportSize().width * 0.7), 400);

    /* And back: it has to let go as well as take hold. */
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(220);
    ck(P("above the first subsection the rail marks none"), (await marked()) === null);

    /* A subsection reached by its own URL is marked once the scroll settles.
       This used to be silently broken on a cold load: the course had not
       arrived, so the scroll found no element and never retried. */
    await go(`#/${cid}/${railSubs[1]}`);
    await page.waitForTimeout(900);
    ck(P("a linked subsection is marked on arrival"), (await marked()) === railSubs[1],
       `${await marked()} wanted ${railSubs[1]}`);
    await go(`#/${cid}/${secIds[0]}`);
  }

  /* Ctrl +/- scales the reading column and leaves the chrome alone. */
  /* height, not width: the column is often already at the width its container
     allows, and zoom then shows up as taller type rather than a wider box */
  const wrapAt = () => page.evaluate(() =>
    Math.round(document.querySelector(".wrap").getBoundingClientRect().height));
  const sideAt = () => page.evaluate(() =>
    Math.round(document.querySelector(".sidebar").getBoundingClientRect().width));
  const w0 = await wrapAt(), s0 = await sideAt();
  await page.keyboard.press("Control+Equal"); await page.waitForTimeout(300);
  const w1 = await wrapAt(), s1 = await sideAt();
  ck(P("ctrl + zooms the content"), w1 > w0, `${w0} -> ${w1}`);
  ck(P("ctrl + leaves the chrome alone"), s1 === s0, `${s0} -> ${s1}`);
  await page.keyboard.press("Control+0"); await page.waitForTimeout(300);
  ck(P("ctrl 0 resets the zoom"), (await wrapAt()) === w0, `${await wrapAt()} vs ${w0}`);

  /* cross-reference round trip */
  const xr = page.locator(".bmain a.xr").first();
  if (await xr.count()) {
    await xr.hover(); await page.waitForTimeout(180);
    ck(P("hover pairs mention and card"), await page.locator(".mnote.hot").count() > 0);

    /* Where the mention sits on screen before the trip, so the return can be
       measured against it rather than against the subsection it happens to be
       in. A subsection runs 2000px and a mention can be at the bottom of one.
     *
     * Positioned and clicked from inside the page rather than through the
     * locator. Playwright re-runs scrollIntoViewIfNeeded as part of clicking,
     * so a seat measured beforehand is a seat the click then moves — which
     * read as a 50px miss by the product when the product was exact. */
    await page.evaluate(() =>
      document.querySelector(".bmain a.xr").scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(250);
    const seat = await page.evaluate(() => {
      const a = document.querySelector(".bmain a.xr");
      return { top: Math.round(a.getBoundingClientRect().top), href: a.getAttribute("href") };
    });
    await page.evaluate(() => document.querySelector(".bmain a.xr").click());
    await page.waitForTimeout(400);
    ck(P("return pill appears"), await page.locator(".pill.on").isVisible());
    await page.locator(".pill.on").click(); await page.waitForTimeout(400);
    ck(P("pill returns"), await page.locator("section.sec-body").count() === 1);

    /* And returns to the sentence, not to the heading above it. Waited out
       rather than sampled once: the section re-renders on the way back and its
       maths and figures settle over the next few frames, which used to leave
       the landing 250-380px short. */
    let seatNow = null;
    for (let i = 0; i < 30; i++) {
      seatNow = await page.evaluate(() => {
        const a = document.querySelector(".bmain a.xr");
        return a ? Math.round(a.getBoundingClientRect().top) : null;
      });
      if (seatNow !== null && Math.abs(seatNow - seat.top) <= 8) break;
      await page.waitForTimeout(100);
    }
    ck(P("the return lands where the link was clicked"),
       seatNow !== null && Math.abs(seatNow - seat.top) <= 8,
       `mention was ${seat.top}px from the top, came back at ${seatNow}px`);

    /* The trail ends when the reader steps off it. Otherwise the pill sits
       there offering to return to a page they left several sections ago. */
    await xr.click(); await page.waitForTimeout(400);
    await page.locator(".sec-btn").nth(Math.min(2, nSections - 1)).click();
    await page.waitForTimeout(500);
    ck(P("return pill clears on a deliberate move"),
       await page.locator(".pill.on").count() === 0);
  }

  /* A concept mention promises a click with a dashed underline and a pointer
     cursor; it has to keep that promise, and the way back has to work. */
  const cref = page.locator(".bmain a.cref").first();
  if (await cref.count()) {
    await cref.click(); await page.waitForTimeout(450);
    ck(P("a concept mention opens its entry"), await page.locator(".cdet h1").count() === 1);
    await page.locator(".pill.on").click(); await page.waitForTimeout(450);
    ck(P("returning from a concept lands on the section"),
       await page.locator("section.sec-body").count() === 1,
       await page.evaluate(() => location.hash));
  }

  /* WCAG 1.4.1: mastery must not be carried by colour alone. */
  const dots = await page.locator(".mdot").count();
  if (dots) {
    const named = await page.evaluate(() =>
      [...document.querySelectorAll(".mdot")].every(d => (d.getAttribute("aria-label") || "").length > 3));
    ck(P("mastery markers are named, not just coloured"), named);
  }

  /* quiz + state: predict, state a reason, then reveal */
  await go(`#/${cid}/${secIds[0]}`);
  /* No AI affordance precedes an attempt. The browser's assistant is not ours
     to gate, but our own pointer to help is. */
  ck(P("no help control before a prediction"), await page.locator(".qstuck").count() === 0);
  const conf = page.locator(".q .cbtn[data-conf='1']").first();
  if (await conf.count()) {
    await conf.click(); await page.waitForTimeout(250);
    ck(P("the reveal stays inert until a reason is stated"),
       await page.locator(".q.open").count() === 0 && await page.locator(".q .why-in").count() === 1);
    await page.locator(".q .why-in").first().fill("stating the reason before looking");
    await page.locator(".q .why-nav .cbtn").first().click(); await page.waitForTimeout(250);
    ck(P("a stated reason reveals the answer"), await page.locator(".q.open").first().isVisible());
    const missed = page.locator(".q.open .gbtn[data-got='0']").first();
    if (await missed.count()) {
      await missed.click(); await page.waitForTimeout(250);
      const note = await page.locator(".gnote").first().innerText();
      ck(P("overconfidence flagged"), /expected this one|goes into review/i.test(note), note);
      /* a confident miss on a concept with a bank is corrected in place */
      const drilled = await page.locator(".recruit .drill").count();
      if (drilled) ck(P("a confident miss recruits a drill"), drilled === 1);
    }
    /* The reason comes back beside the question the next time it is met.
       The round trip leaves the section rather than reloading it, so a
       single-section course exercises the same path as any other. */
    await go(`#/${cid}`);
    await go(`#/${cid}/${secIds[0]}`);
    await page.locator(".q .cbtn[data-conf='1']").first().click(); await page.waitForTimeout(250);
    ck(P("the reader's previous reason returns"),
       await page.locator(".q .why-prior").count() >= 1);
  }

  /* The context record: course content in, answers and reader content out.
     It is what the browser's own assistant reads, and it is invisible. */
  {
    const raw = await page.evaluate(() => {
      const el = document.getElementById("page-context");
      return el ? el.textContent : null;
    });
    ck(P("a context record sits in the head"), !!raw);
    if (raw) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch { /* reported below */ }
      ck(P("the context record is valid JSON-LD"), !!parsed && !!parsed["@context"]);
      ck(P("the context record names the section it describes"),
         !!parsed && typeof parsed.name === "string" && parsed.name.length > 2);
      ck(P("the context record changes nothing visible"),
         await page.evaluate(() => {
           const el = document.getElementById("page-context");
           return !el || el.getClientRects().length === 0;
         }));
      const ans = await page.locator(".q.open .ans").first().innerText().catch(() => "");
      if (ans && ans.trim().length > 6)
        ck(P("the context record withholds quiz answers"), !raw.includes(ans.trim()), ans.slice(0, 30));
      ck(P("the context record carries nothing the reader wrote"),
         !raw.includes("stating the reason before looking"));
    }
  }

  /* lanes: the count changes, the route and the scroll do not */
  {
    await go(`#/${cid}/${secIds[0]}`);
    const all = await page.locator(".brow").count();
    const hash = await page.evaluate(() => location.hash);
    await page.locator(".lane-b[data-lane='spine']").click(); await page.waitForTimeout(300);
    const spine = await page.locator(".brow").count();
    ck(P("the lane selector is at the head of the material"),
       await page.locator(".sec-head ~ .lane, .lane").count() >= 1);
    ck(P("the spine lane never shows more than every lane"), spine <= all, `${spine} of ${all} rows`);
    ck(P("changing lane does not change the route"), await page.evaluate(() => location.hash) === hash);
    const stubs = await page.locator(".tstub").count();
    if (stubs) {
      ck(P("a stub names what it holds"),
         (await page.locator(".tstub-t").first().innerText()).trim().length > 3);
      ck(P("a collapsed run leaves no margin card"),
         await page.locator(".brow:has(.tstub) .bside .mnote").count() === 0);
      await page.locator(".tstub-b").first().click(); await page.waitForTimeout(300);
      ck(P("a stub expands in place"),
         await page.locator(".tstub").count() === stubs - 1 &&
         await page.evaluate(() => location.hash) === hash);
    }
    await page.locator(".lane-b[data-lane='apply']").click(); await page.waitForTimeout(250);
  }

  /* search */
  await page.keyboard.press("/"); await page.waitForTimeout(250);
  await page.locator("#s-input").fill(await page.evaluate(() =>
    document.querySelector(".sec-title")?.textContent.split(" ")[0] || "a"));
  await page.waitForTimeout(350);
  ck(P("search returns results"), await page.locator(".sres").count() > 0);
  /* the browser's own clear glyph is the one thing on the page this stylesheet
     does not draw, and it is redundant beside `esc` and Close */
  /* getComputedStyle on a webkit pseudo-element reports the host element, so
     the shipped rule is what gets asserted */
  ck(P("no native search clear button"), await page.evaluate(() =>
    [...document.styleSheets].some(sh => {
      try {
        return [...sh.cssRules].some(r =>
          /search-cancel-button/.test(r.selectorText || "") && /none/.test(r.style.appearance || ""));
      } catch { return false; }
    })));
  /* T6: results must be reachable without tabbing through every hit */
  if (await page.locator(".sres").count() > 1) {
    await page.mouse.move(4, 4);       /* off the list, so hover cannot answer for it */
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(150);
    const second = await page.evaluate(() =>
      [...document.querySelectorAll(".sres")].findIndex(e => e.classList.contains("on")));
    ck(P("arrow keys move the search selection"), second === 1, "row " + second);
  }
  await shot(cid + "-search");
  await page.keyboard.press("Escape");

  /* Past a threshold the hub groups by where a concept is first needed; below
     it, grouping would produce a page of one-card groups. Assert the rule. */
  await go(`#/${cid}/concepts`);
  const nCards = await page.locator(".ccard").count();
  if (nCards) {
    const heads = await page.locator(".cgroup .cghead").count();
    ck(P("concept hub groups only when large"), nCards >= 8 ? heads > 0 : heads === 0,
       `${nCards} concepts, ${heads} groups`);
  }

  /* map + practice */
  await go(`#/${cid}/map`);
  ck(P("map has a node per section"), await page.locator(".mapwrap .fx-node").count() === nSections);
  /* Edgeless sections are packed into a band rather than columned, so they cost
     a strip of height instead of stretching every other node apart. Overlap is
     what a wrong packing looks like, and it cannot be seen in a node count. */
  const overlap = await page.evaluate(() => {
    const n = [...document.querySelectorAll(".mapwrap .fx-node")].map(e => {
      const b = e.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 };
    });
    let hits = 0;
    for (let i = 0; i < n.length; i++)
      for (let j = i + 1; j < n.length; j++)
        if (Math.hypot(n[i].x - n[j].x, n[i].y - n[j].y) < (n[i].r + n[j].r) * 0.9) hits++;
    return hits;
  });
  ck(P("map nodes do not overlap"), overlap === 0, overlap + " overlapping pairs");
  await shot(cid + "-map");
  /* arriving from a section rings the node you came from */
  await go(`#/${cid}/map/${last}`);
  ck(P("map rings the section you came from"),
     await page.locator(`.fx-node.is-here[data-node="${last}"]`).count() === 1);
  /* the drill bank: a concept enters Loop B on contact, never before, and the
     concept page is one of the three places contact can happen */
  await go(`#/${cid}/concepts`);
  const banked = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".ccard")].find(c => c.querySelector(".cphase"));
    return card ? card.getAttribute("href") : null;
  });
  if (banked) {
    await go(banked);
    ck(P("a banked concept names its state in words"),
       (await page.locator(".cstate-box b").first().innerText()).length > 3);
    await page.locator("#c-drill").click(); await page.waitForTimeout(300);
    ck(P("the concept page drills its own concept"), await page.locator(".drill").count() === 1);
    ck(P("a drill withholds its answer until the reader commits"),
       await page.locator(".drill .drill-a").count() === 0);
    await page.locator(".drill .cbtn[data-conf='sure']").click(); await page.waitForTimeout(200);
    await page.locator(".drill .why-in").fill("stating it first");
    await page.locator(".drill .why-nav .cbtn").click(); await page.waitForTimeout(250);
    ck(P("a stated reason reveals the worked solution"),
       await page.locator(".drill .drill-steps li").count() > 0);
    await page.locator(".drill .gbtn[data-got='1']").click(); await page.waitForTimeout(250);
    ck(P("a graded drill reports the concept's new state"),
       /learning|criterion|durable/.test(await page.locator(".drill .gnote").innerText()));
    await shot(cid + "-drill");
  }

  await go(`#/${cid}/practice`);
  const drillMode = await page.locator("#p-source").count() > 0;

  /* A scope the reader cannot see is a scope they cannot change: the control is
     disabled in drill mode, so it must not hold a section from before the
     switch and hand it back on the way out. */
  if (drillMode) {
    /* Drills are the default where a bank exists, and the scope control is
       disabled there — so the trap is set from the other side, exactly as a
       reader sets it: pick a section under Question types, then switch. */
    await page.selectOption("#p-source", "types"); await page.waitForTimeout(150);
    await page.selectOption("#p-scope", { index: 1 });
    const picked = await page.inputValue("#p-scope");
    await page.selectOption("#p-source", "drills"); await page.waitForTimeout(150);
    const after = await page.inputValue("#p-scope");
    ck(P("switching to drills resets the scope"), after === "all",
       `${picked} -> ${after}`);
    await page.selectOption("#p-source", "types"); await page.waitForTimeout(150);
    ck(P("the scope comes back usable"),
       await page.inputValue("#p-scope") === "all" &&
       !(await page.locator("#p-scope").isDisabled()));
    await page.selectOption("#p-source", "drills"); await page.waitForTimeout(150);
  }

  await page.locator("#p-start").click(); await page.waitForTimeout(400);
  ck(P("practice serves an item"),
     await page.locator(drillMode ? "#p-run .drill" : "#p-run .q").count() === 1 ||
     await page.locator(".pempty").count() === 1);
  /* Nothing due is the normal state of an unanswered course, so the empty
     drill queue has to say that rather than blame a scope that is not in play. */
  if (drillMode && await page.locator(".pempty").count() === 1) {
    ck(P("an empty drill queue explains itself"),
       /nothing is due/i.test(await page.locator(".pempty").innerText()));
  }
  await shot(cid + "-practice");

  /* T6-adjacent: the library is where courses are installed and removed, so a
     way back to it cannot depend on chrome the reader is allowed to hide. */
  ck(P("the breadcrumb starts at the library"), await page.locator(".crumb #tb-home").count() === 1);
  await page.locator("#tb-home").click(); await page.waitForTimeout(300);
  ck(P("home reaches the library"),
     await page.evaluate(() => location.hash === "#/" || location.hash === ""));
  await page.setViewportSize({ width: 390, height: 800 });
  await go(`#/${cid}/practice`);
  /* Tappability is swept for every control at this width above; what matters
     here is that the crumb truncating does not take the way home with it. */
  /* The crumb clips, and it clips from the right, so the trail's deep end is
     what yields. The root must never be what gets cut — including when the
     Review count beside it is wide enough to squeeze the whole line. */
  const home = await page.evaluate(() => {
    const a = document.getElementById("tb-home");
    if (!a || a.offsetParent === null) return null;
    const crumb = document.querySelector(".crumb").getBoundingClientRect();
    const box = a.getBoundingClientRect();
    return { w: Math.round(box.width), whole: box.right <= crumb.right + 1,
             bar: Math.round(document.querySelector(".topbar").getBoundingClientRect().height) };
  });
  ck(P("the route home survives a phone"), !!home && home.whole && home.w > 0,
     home ? `${home.w}px wide, bar ${home.bar}px` : "absent");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);

  /* calibration reports on the log rather than on the literature */
  await go(`#/${cid}/calibration`);
  ck(P("calibration leads with figures from the log"),
     await page.locator(".cal .dash .dstat").count() >= 4);
  ck(P("confidence is reported against correctness"),
     await page.locator(".cal-t").first().locator("tr").count() > 0);
  ck(P("the model's prediction is reported against the outcome"),
     await page.locator(".cal-t").count() === 2 ||
     await page.locator(".cal-empty").count() === 1);
  ck(P("the log can be taken away"), await page.locator("#cal-export").count() === 1);
  ck(P("calibration states what leaves the device"),
     await page.locator(".cal-priv").count() === 1);
  await shot(cid + "-calibration");

  /* the collapse control belongs to the sidebar, and must not take the margin
     cards with it — those are a benefit, not clutter */
  await go(`#/${cid}/${secIds[0]}`);
  const cardsBefore = await page.locator(".mnote").count();
  ck(P("collapse control is on the sidebar"), await page.locator(".sidebar .tuck").count() === 1);
  await page.locator(".sidebar .tuck").click(); await page.waitForTimeout(350);
  ck(P("collapse hides the sidebar"), await page.locator(".sidebar").count() === 0);
  ck(P("collapse keeps the margin cards"), await page.locator(".mnote").count() === cardsBefore,
     `${cardsBefore} before/after`);
  ck(P("a reveal tab remains"), await page.locator(".untuck").count() === 1);
  await shot(cid + "-tucked");
  await page.locator(".untuck").click(); await page.waitForTimeout(350);
  ck(P("collapse is reversible"), await page.locator(".sidebar").count() === 1);

  /* pre-training: panel on the section, and the stepped module behind it */
  ck(P("key terms panel present"), await page.locator(".pretrain").count() > 0);
  /* A gloss is flattened from a block's HTML. KaTeX renders one span per
     glyph, so flattening a formula like ordinary prose turns an integral into
     "∫ 0 ∞ e −st d t" — space-heavy in a way real prose never is. */
  const airy = await page.evaluate(() =>
    [...document.querySelectorAll(".pt-list dd")]
      .map(e => e.textContent.trim())
      .filter(t => t.length > 24)
      .map(t => ({ t: t.slice(0, 40), r: (t.match(/ /g) || []).length / t.length }))
      .filter(x => x.r > 0.35));
  ck(P("glosses are not shredded maths"), airy.length === 0,
     airy.length ? airy[0].t : "");
  const primerLink = page.locator(".pt-run").first();
  if (await primerLink.count()) {
    await primerLink.click(); await page.waitForTimeout(400);
    ck(P("primer withholds the meaning"), await page.locator(".primer-hint").count() === 1);
    await page.locator("button.dbtn", { hasText: "Show meaning" }).click(); await page.waitForTimeout(200);
    ck(P("primer reveals on request"), await page.locator(".primer-gloss").count() === 1);
    await shot(cid + "-primer");
  }

  /* A note is started by pulling the foot of a block down, and once written it
     is a card in the margin channel stacked with the author's own cards. There
     is no standing affordance to click: the "+ note" button that used to sit in
     every block's margin was 32 permanently visible buttons on one section of a
     phone. */
  await go(`#/${cid}/${secIds[0]}`);
  const grip = page.locator(".note-pull").first();
  if (await grip.count()) {
    ck(P("no standing note button"), await page.locator(".note-add").count() === 0);
    /* The reason the affordance is allowed to be on every block at all. */
    ck(P("the note affordance costs no layout"), await page.evaluate(() =>
      [...document.querySelectorAll(".notes")].every(e => !e.getBoundingClientRect().height)));
    ck(P("a block with no note shows nothing in the margin"),
       await page.locator(".mnote.is-n").count() === 0);

    await grip.scrollIntoViewIfNeeded();
    const g = await grip.boundingBox();
    const pull = async dy => {
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      for (const y of [6, dy]) {
        await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + y);
        await page.waitForTimeout(40);
      }
      await page.mouse.up(); await page.waitForTimeout(250);
    };
    /* A scroll that grazes the grip must not drop a textarea under the reader. */
    await pull(12);
    ck(P("a short pull snaps back"), await page.locator(".note-area").count() === 0);
    await pull(48);
    ck(P("a pull past the threshold opens the note in the margin"),
       await page.locator(".bside .note-area").count() === 1);
    ck(P("the opened note takes focus"),
       await page.evaluate(() => document.activeElement?.classList.contains("note-area")));

    await page.locator(".note-area").first().fill("**check** note `persistence`");
    await page.locator(".note-area").first().blur();       /* commit before leaving */
    await page.waitForTimeout(500);
    await go(`#/${cid}/concepts`);
    await go(`#/${cid}/${secIds[0]}`);

    /* Shown by default, and read as Markdown rather than as raw asterisks. */
    ck(P("a written note shows in the margin by default"),
       await page.locator(".bside .mnote.is-n .note-body").count() === 1);
    ck(P("the card is labelled NOTE"),
       (await page.locator(".note-fold").first().innerText()).trim().toUpperCase() === "NOTE",
       await page.locator(".note-fold").first().innerText());
    const body = await page.locator(".note-body").first().innerHTML();
    ck(P("the note renders as markdown"), /<b>check<\/b>/.test(body) && /<code>persistence<\/code>/.test(body), body);
    /* T12: a reference card must be level with its mention, a note need not be,
       so the note is what yields when the two want the same row. */
    ck(P("the note stacks under the author's cards"), await page.evaluate(() => {
      const side = [...document.querySelectorAll(".bside")].find(a => a.querySelector(".mnote.is-n"));
      const kids = [...side.children];
      return kids.indexOf(side.querySelector(".mnote.is-n")) === kids.length - 1;
    }));

    /* Folding is per note and is remembered. */
    await page.locator(".note-fold").first().click(); await page.waitForTimeout(250);
    ck(P("folding hides the note body"), await page.locator(".note-body").count() === 0);
    await go(`#/${cid}/concepts`);
    await go(`#/${cid}/${secIds[0]}`);
    ck(P("a folded note stays folded"),
       await page.locator(".mnote.is-n.is-shut").count() === 1 &&
       await page.locator(".note-body").count() === 0);
    await page.locator(".note-fold").first().click(); await page.waitForTimeout(250);
    ck(P("unfolding brings it back"), await page.locator(".note-body").count() === 1);

    await page.locator(".note-edit").first().click(); await page.waitForTimeout(250);
    const saved = await page.locator(".note-area").first().inputValue();
    ck(P("notes persist"), saved.includes("persistence"), saved.slice(0, 30) || "not found");
    await page.locator(".note-area").first().blur(); await page.waitForTimeout(300);

    /* A block takes more than one note: a lecture adds one thing and a past
       paper another, and a single textarea makes the reader edit around what
       they already wrote. The grip stays put and adds the next one. */
    await grip.scrollIntoViewIfNeeded();
    await grip.click(); await page.waitForTimeout(300);
    await page.locator(".note-area").first().fill("a second note");
    await page.locator(".note-edit", { hasText: "done" }).first().click();
    await page.waitForTimeout(400);
    ck(P("a block takes a second note"), await page.locator(".note-one").count() === 2,
       (await page.locator(".note-one").count()) + " shown");
    await go(`#/${cid}/concepts`);
    await go(`#/${cid}/${secIds[0]}`);
    ck(P("both notes survive"), await page.locator(".note-one").count() === 2);

    /* Deleting one was impossible at first: the textarea blurs before the
       button beside it receives pointerdown, and both handlers then wrote the
       same stale array back, so the note reappeared. */
    await page.locator(".note-edit", { hasText: "edit" }).last().click();
    await page.waitForTimeout(250);
    await page.locator(".note-drop").click(); await page.waitForTimeout(400);
    ck(P("a note can be deleted"), await page.locator(".note-one").count() === 1,
       (await page.locator(".note-one").count()) + " left");
  }

  /* One course's styles at a time: they used to be appended and never removed,
     so opening several courses left several stylesheets fighting. */
  const sheets = await page.evaluate(() => document.querySelectorAll('style[id^="cs-"]').length);
  ck(P("at most one course stylesheet is live"), sheets <= 1, sheets + " injected");

  /* dark theme actually repaints */
  await go(`#/${cid}/${secIds[0]}`);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator(".topbar .tbtn", { hasText: "Theme" }).click(); await page.waitForTimeout(300);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ck(P("theme toggle repaints"), before !== after, `${before} -> ${after}`);
  await shot(cid + "-dark");
}

/* The review route: cross-course, and deliberately without the reading chrome.
   It renders whether or not anything is due — an empty queue is a state, and
   the reader has to be able to see that it is empty. */
{
  await go("#/review");
  const has = await page.locator(".review").count() === 1;
  ck("review route renders", has);
  if (has) {
    ck("review drops the sidebar", await page.locator(".sidebar").count() === 0);
    ck("review drops the margin rail", await page.locator(".bside").count() === 0);
    ck("review states its progress in words", await page.locator(".review-n, .review h1").count() >= 1);
    await shot("review");
    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ck("review does not scroll sideways on a phone", overflow <= 1, overflow + "px");
    await page.setViewportSize({ width: 1440, height: 900 });
  }
}

/* Syntax highlighting, on the route a reader actually arrives at.
 *
 * Two defects hid behind each other here. The block config is read while a
 * block renders, and it used to be set in an effect that runs after that
 * render — so a deep link or a reload painted a section with no highlighting
 * and no valueStyles, and only navigating in from another view looked right.
 * Underneath that, the highlighter ran a regex pass per token type over a
 * string the previous pass had already put markup into, so the `strings` pass
 * matched the quoted class name inside an emitted span and shredded it.
 *
 * So this loads the route cold rather than clicking to it, and asserts on the
 * markup rather than on a span count: a corrupt run still produces spans. */
{
  let found = null;
  for (const cid of ids) {
    await go("#/" + cid);
    const secs = await page.evaluate(() =>
      [...document.querySelectorAll(".toc a[href]")].map(a => a.getAttribute("href")));
    for (const h of secs) {
      await go(h);                       /* go() is a full load, not a click */
      if (await page.locator("pre code [class^=tok-]").count()) { found = h; break; }
    }
    if (found) break;
  }
  if (found) {
    /* A hash change is not a load. goto() with only the fragment different
       leaves the app mounted, so the config the previous view's effect set is
       still in place — which is exactly the state that hid this bug. Only a
       reload puts a reader on the route cold. */
    await page.reload();
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const el = document.querySelector("pre code");
      return { html: el.innerHTML, text: el.textContent,
               classes: [...new Set([...el.querySelectorAll("[class]")].map(e => e.className))] };
    });
    ck("a code block reloaded cold is highlighted",
       r.classes.some(c => /^tok-/.test(c)), r.classes.join(",") || "no spans");
    /* The shredded form produced `class="<span`: an emitted class that is
       itself markup. It survives any span count, so the count is not the test. */
    ck("highlighter does not mark up its own output",
       r.classes.every(c => /^[\w- ]+$/.test(c)) && !/&lt;span|class="&lt;/.test(r.html),
       r.classes.join(","));
    /* The listing must read as the author wrote it. A class name showing up as
       visible text is the corruption reaching the reader. */
    ck("no markup leaks into the listing text",
       !/tok-[cksn]|<span|&lt;/.test(r.text), JSON.stringify(r.text.slice(0, 60)));
  }
}

ck("no JavaScript errors", errs.length === 0, errs.join(" | "));
await browser.close();
closeServer();

const bad = R.filter(r => !r.ok);
console.log(`${bad.length ? "FAIL" : "ok  "} dist/       ${R.length - bad.length}/${R.length} checks` +
  (SHOTS ? ` · screenshots in .shots/` : ""));
bad.forEach(r => console.log(`       ✗ ${r.n}${r.x ? "  [" + r.x + "]" : ""}`));
process.exit(bad.length ? 1 : 0);
