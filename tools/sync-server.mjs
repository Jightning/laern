#!/usr/bin/env node
/* ============================================================================
 * tools/sync-server.mjs — the sync backend, on your own machine
 *
 *   npm run sync                 # serves, then exits after 10 idle minutes
 *   IDLE=0 npm run sync          # stays up until you stop it
 *
 * Manual by default. Sync is opportunistic — a device that cannot reach the
 * server keeps its answers locally, leaves its cursors untouched and catches up
 * on the next attempt — so nothing is lost by the server being down most of the
 * time. Running it only when wanted costs nothing and leaves no process idling
 * for the days you are not studying.
 *
 * This does not run on Cloudflare, and that is the point. A Pages Function
 * would draw on the account-wide 100,000 Workers requests/day shared with every
 * other project, and the hostname is public in Certificate Transparency logs —
 * so anyone could spend that quota, and each rejected request would count
 * before being rejected. Here there is no public endpoint at all: the server is
 * reachable only from inside your own tailnet, so there is nothing to find and
 * nothing to flood.
 *
 * It stores rows exactly as functions/api/log.js did, minus the database: one
 * append-only file per device. No device ever writes another's file, which is
 * why merging is a union with no conflict to resolve. `seq` is assigned here on
 * arrival, because a client cursor must never be a client clock — two devices
 * have two clocks, and a fast one would advance the other's cursor past rows it
 * had not yet seen.
 *
 * The token is not the security boundary — the tailnet is. It exists so that a
 * mistaken `tailscale funnel` (which does expose publicly) is not immediately
 * an open door.
 * ==========================================================================*/
import { createServer } from "node:http";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { courseFiles } from "./lib/files.mjs";
import { loadCourse } from "./lib/load.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.env.SYNC_DIR || join(ROOT, ".sync");
const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY = 4 * 1024 * 1024;
const MAX_ROWS = 5000;
/* Minutes of no requests before the server stops. 0 keeps it up forever. */
const IDLE_MIN = process.env.IDLE === undefined ? 10 : Number(process.env.IDLE);

mkdirSync(DATA, { recursive: true });

/* A token is generated once and kept beside the data, so starting the server
   never demands setup and the same secret survives restarts. */
const TOKEN_FILE = join(DATA, "token");
if (!existsSync(TOKEN_FILE)) writeFileSync(TOKEN_FILE, randomUUID() + randomUUID());
const TOKEN = readFileSync(TOKEN_FILE, "utf8").trim();

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/* Rows live in one file per device; `seq` is a single counter across all of
   them, so "everything after my cursor" is answerable without a database. */
const fileFor = dev => join(DATA, `rows-${dev.replace(/[^\w-]/g, "")}.json`);
const readRows = dev => {
  try { return JSON.parse(readFileSync(fileFor(dev), "utf8")); } catch { return []; }
};
const allRows = () => {
  const out = [];
  for (const f of readdirSync(DATA)) {
    if (!/^rows-.+\.json$/.test(f)) continue;
    try { out.push(...JSON.parse(readFileSync(join(DATA, f), "utf8"))); } catch {}
  }
  return out.sort((a, b) => a.seq - b.seq);
};
const nextSeq = () => allRows().reduce((n, r) => Math.max(n, r.seq || 0), 0) + 1;

/* ------------------------------------------------------------- courses ---
 * The authoring machine already has every course on disk, so it is the source
 * of truth and there is nothing to upload: a device asks what exists, compares
 * hashes with what it holds, and pulls whatever changed.
 *
 * Courses are mutable, unlike log rows, so they cannot be merged by union.
 * They do not need to be: a course has one writer at a time, so newest-wins is
 * sufficient. The hash is what makes that cheap — an unchanged course costs one
 * small listing, not a transfer.
 *
 * Courses also travel the other way. A course installed only in a browser —
 * someone sent you a zip, and the phone is the only device that has it — used
 * to be stranded there, because the server served this repo and nothing else.
 * A device may now upload one, and it is staged in `.sync/courses/` rather
 * than written into `courses/`: that folder is the authoring source and the
 * backup, and a device must not be able to overwrite it.
 *
 * Staging is a pipe, not a store. Once every device the server knows about has
 * fetched a staged course, the staged copy is deleted — the courses live in the
 * browsers, and this is only how they get between them.
 *
 * A course in `courses/` is authoritative and an upload for that id is refused.
 * The tempting alternative — newest wins, by upload time — is wrong: arrival is
 * not authorship, so a phone holding a month-old copy would displace a folder
 * edited an hour ago simply by syncing later. There is no clock that can order
 * two devices' edits, which is why staging only ever fills a gap.
 */
const COURSES = join(ROOT, "courses");
const STAGE = join(DATA, "courses");
mkdirSync(STAGE, { recursive: true });

const stagePath = id => join(STAGE, `${id}.json`);
const readStaged = id => {
  try { return JSON.parse(readFileSync(stagePath(id), "utf8")); } catch { return null; }
};
const stagedIds = () => {
  try { return readdirSync(STAGE).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)); }
  catch { return []; }
};

/* Every device that has ever pushed a row, plus whoever uploaded the course.
   A device the server has never heard from cannot be waited for. */
const knownDevices = () => {
  const out = new Set();
  for (const f of readdirSync(DATA)) {
    const m = /^rows-(.+)\.json$/.exec(f);
    if (m) out.add(m[1]);
  }
  return out;
};


const hashOf = files => createHash("sha256")
  .update(JSON.stringify(Object.keys(files).sort().map(k => [k, files[k]])))
  .digest("hex").slice(0, 16);

function courseList() {
  const byId = new Map();

  for (const e of readdirSync(COURSES, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_")) continue;
    let files;
    try { files = courseFiles(join(COURSES, e.name), () => {}); } catch { continue; }
    let title = e.name;
    try { title = loadCourse(join(COURSES, e.name)).course.title || e.name; } catch {}
    byId.set(e.name, { id: e.name, title, version: hashOf(files),
                       files: Object.keys(files).length, where: "disk" });
  }

  /* Staging fills gaps and never covers the disk. */
  for (const id of stagedIds()) {
    if (byId.has(id)) continue;
    const st = readStaged(id);
    if (!st || !st.files) continue;
    byId.set(id, { id, title: st.title || id, version: st.version,
                   files: Object.keys(st.files).length, where: "staged" });
  }

  return [...byId.values()];
}

/* Delivered to everyone the server knows of? Then the pipe has done its job.
   The courses live in the browsers; this copy was only how they travelled. */
function purgeIfDelivered(id, st) {
  const want = knownDevices();
  want.add(st.from);
  const seen = new Set(st.seen || []);
  for (const d of want) if (!seen.has(d)) return false;
  rmSync(stagePath(id), { force: true });
  console.log(`  ${id}: delivered to every known device — staged copy removed`);
  return true;
}

const send = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    /* The app is served from another origin, so the browser will not read a
       response without these. `*` is safe here: authentication is a bearer
       token, not a cookie, and no other origin can read the token to send it. */
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400"
  });
  res.end(JSON.stringify(body));
};

/* Two routes take a POST now, so the size guard and the JSON parse live in one
   place rather than being written twice and drifting. */
function readBody(req, res, then) {
  let body = "", over = false;
  req.on("data", d => {
    body += d;
    if (body.length > MAX_BODY && !over) { over = true; send(res, 413, { error: "too large" }); req.destroy(); }
  });
  req.on("end", () => {
    if (over) return;
    let payload;
    try { payload = JSON.parse(body); } catch { return send(res, 400, { error: "bad json" }); }
    then(payload);
  });
}

let idleTimer = null;
let served = 0;
function touch() {
  if (!IDLE_MIN) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log(`\nidle for ${IDLE_MIN} min after ${served} request(s) — stopping.`);
    console.log("run `npm run sync` again next time you want to sync.");
    process.exit(0);
  }, IDLE_MIN * 60_000);
}

createServer((req, res) => {
  served++; touch();
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url, "http://localhost");
  const sent = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!same(sent, TOKEN)) return send(res, 401, { error: "unauthorized" });

  /* GET /courses            -> [{ id, title, version, files }]
     GET /courses/<id>       -> the file map, exactly as `npm run pack` writes */
  if (req.method === "GET" && url.pathname.endsWith("/courses"))
    return send(res, 200, { courses: courseList() });

  const one = /\/courses\/([\w-]+)$/.exec(url.pathname);
  if (req.method === "GET" && one) {
    const id = one[1];
    /* The id comes from the network: never let it become a path. */
    if (!/^[\w-]+$/.test(id)) return send(res, 404, { error: "no such course" });
    const listed = courseList().find(c => c.id === id);
    if (!listed) return send(res, 404, { error: "no such course" });

    if (listed.where === "staged") {
      const st = readStaged(id);
      if (!st) return send(res, 404, { error: "no such course" });
      /* Record the delivery before answering, so a device that asks twice does
         not hold the staged copy open forever. */
      const who = url.searchParams.get("device") || "";
      if (who && !(st.seen || []).includes(who)) {
        st.seen = [...(st.seen || []), who];
        writeFileSync(stagePath(id), JSON.stringify(st));
      }
      const files = st.files;
      purgeIfDelivered(id, st);
      return send(res, 200, { id, files });
    }
    return send(res, 200, { id, files: courseFiles(join(COURSES, id), () => {}) });
  }

  /* POST /courses/<id> — a device hands up a course this machine has never
     seen. It is staged, never written into `courses/`: that folder is the
     authoring source, and a device must not be able to overwrite it. */
  if (req.method === "POST" && one) {
    const id = one[1];
    if (!/^[\w-]+$/.test(id)) return send(res, 400, { error: "bad course id" });
    /* The authoring source is not writable from the network, at any age. */
    if (existsSync(join(COURSES, id)))
      return send(res, 409, { error: "that course is authored on this machine" });
    return readBody(req, res, payload => {
      const { device, files } = payload || {};
      if (!device || !files || typeof files !== "object" || Array.isArray(files))
        return send(res, 400, { error: "device and files required" });
      const paths = Object.keys(files);
      if (!paths.length) return send(res, 400, { error: "empty course" });
      if (paths.some(k => typeof files[k] !== "string"))
        return send(res, 400, { error: "every entry must be text" });
      if (!paths.some(k => /^course\.(ya?ml|json)$/.test(k)))
        return send(res, 400, { error: "no course.yaml at the top level" });

      const version = hashOf(files);
      const prev = readStaged(id);
      /* Re-uploading the same bytes must not reset delivery, or two devices
         that both have it would keep the staged copy alive forever. */
      if (prev && prev.version === version) {
        prev.seen = [...new Set([...(prev.seen || []), device])];
        writeFileSync(stagePath(id), JSON.stringify(prev));
        purgeIfDelivered(id, prev);
        return send(res, 200, { id, version, staged: false });
      }

      /* The listing shows a name; read it off the course file rather than
         parsing the whole course just to label one row. */
      const head = files["course.yaml"] || files["course.yml"] || "";
      const title = (/^\s*title:\s*(.+)$/m.exec(head) || [, id])[1].trim() || id;

      writeFileSync(stagePath(id), JSON.stringify(
        { id, title, version, at: Date.now(), from: device, seen: [device], files }));
      console.log(`  ${id}: staged from ${device} (${paths.length} files)` +
        ` — \`node tools/unpack.mjs ${stagePath(id)}\` to keep it`);
      return send(res, 200, { id, version, staged: true });
    });
  }

  if (!url.pathname.endsWith("/log")) return send(res, 404, { error: "not found" });

  if (req.method === "GET") {
    const since = Number(url.searchParams.get("since")) || 0;
    const not = url.searchParams.get("not") || "";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 2000, MAX_ROWS);
    const page = allRows().filter(r => r.seq > since && r.device !== not).slice(0, limit);
    return send(res, 200, {
      cursor: page.length ? page[page.length - 1].seq : since,
      more: page.length === limit,
      rows: page.map(({ seq, device, ...row }) => row)
    });
  }

  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  readBody(req, res, payload => {
    const { device, rows } = payload || {};
    if (!device || !Array.isArray(rows)) return send(res, 400, { error: "device and rows required" });
    if (rows.length > MAX_ROWS) return send(res, 413, { error: "too many rows" });

    /* A device may only write rows it owns — otherwise one of your own devices
       could rewrite another's history, the conflict this design exists to make
       impossible. */
    const mine = rows.filter(r => r && typeof r.id === "string" && r.id.startsWith(device + ":"));
    const have = readRows(device);
    const seen = new Set(have.map(r => r.id));
    let seq = nextSeq(), added = 0;
    for (const r of mine) {
      if (seen.has(r.id)) continue;
      seen.add(r.id); have.push({ ...r, device, seq: seq++ }); added++;
    }
    if (added) writeFileSync(fileFor(device), JSON.stringify(have));
    send(res, 200, { written: added });
  });
/* Loopback only. Binding every interface put this on whatever network the
   laptop happened to join — a café, a campus, a hotel — where anyone could
   reach it and start guessing the token. `tailscale serve` runs on this same
   machine and proxies to localhost, so the tailnet remains the only way in,
   which is what the design claims and now what it does. */
}).listen(PORT, "127.0.0.1", () => {
  console.log(`sync server on http://127.0.0.1:${PORT}  (loopback only)`);
  console.log(`data in ${DATA}`);
  console.log(`\nToken (paste into the app's Sync panel):\n  ${TOKEN}`);
  console.log(`\nTo reach it from your phone, in another terminal:\n  tailscale serve --bg ${PORT}`);
  console.log(`then use that https://<machine>.<tailnet>.ts.net address as the endpoint.`);
  if (IDLE_MIN) {
    console.log(`\nOpen the app on each device you want to sync; it syncs on load.`);
    console.log(`This server stops on its own after ${IDLE_MIN} idle minutes (IDLE=0 to keep it up).`);
    touch();
  } else {
    console.log(`\nStaying up until stopped (IDLE=0).`);
  }
});
