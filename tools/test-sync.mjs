#!/usr/bin/env node
/* Two devices, two clocks, one schedule.
 *
 * The sync design claims to be conflict-free: rows are immutable, each is owned
 * by one device, and state is refolded rather than merged. That claim is only
 * as good as the cursor. This file exercises the three ways it can quietly not
 * be — clock skew, same-millisecond ties, and simultaneous answers to the same
 * concept — and asserts the property that actually matters: after syncing,
 * both devices hold the same rows and compute the same schedule.
 *
 *   node tools/test-sync.mjs
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { mergeRows, logRows, clearLog, appendRow } = await import("../src/lib/store.js");
const { fold } = await import("../src/lib/replay.js");

const DAY = 864e5;
const T0 = Date.UTC(2026, 0, 1);
const cfg = { target: 0.9, deadline: null };

/* ---- a stand-in for functions/api/log.js, with the same SQL semantics ---- */
function server() {
  const store = [];               /* seq is the index + 1, as AUTOINCREMENT */
  return {
    post(device, rows) {
      const have = new Set(store.map(r => r.id));
      for (const r of rows) {
        if (!r.id.startsWith(device + ":") || have.has(r.id)) continue;  /* INSERT OR IGNORE */
        store.push({ ...r, device });
      }
    },
    /* SELECT seq, body FROM rows WHERE seq > ? AND device != ? ORDER BY seq */
    get(since, not, limit = 2) {
      const page = store
        .map((r, i) => ({ seq: i + 1, r }))
        .filter(x => x.seq > since && x.r.device !== not)
        .slice(0, limit);
      return {
        cursor: page.length ? page[page.length - 1].seq : since,
        more: page.length === limit,
        rows: page.map(x => x.r)
      };
    },
    size: () => store.length
  };
}

/* The client pull loop from src/lib/sync.js, over a local store. */
function pullAll(srv, device, cursor, into) {
  let pages = 0;
  for (;;) {
    const res = srv.get(cursor, device);
    into.push(...res.rows);
    cursor = res.cursor;
    if (!res.more || ++pages > 100) break;
  }
  return cursor;
}

const row = (dev, ts, n, over) =>
  ({ id: `${dev}:${ts}:${n}`, ts, course: "c", loop: "B", concept: "sep",
     itemId: `i${n}`, correct: true, confidence: "sure", ...over });

/* ---- 1. clock skew must not hide the slower device's rows -------------- */
{
  const srv = server();
  /* The phone runs 90 seconds fast and syncs first. */
  const phone = [row("phone", T0 + 90e3, 0), row("phone", T0 + 91e3, 1)];
  srv.post("phone", phone);
  /* The laptop, with a correct clock, writes later in real time but lower ts. */
  const laptop = [row("laptop", T0 + 1e3, 0), row("laptop", T0 + 2e3, 1)];
  srv.post("laptop", laptop);

  const got = [];
  pullAll(srv, "phone", 0, got);
  check("a slow clock's rows still reach the fast device",
    got.length === 2 && got.every(r => r.id.startsWith("laptop:")),
    `got ${got.length}: ${got.map(r => r.id).join(",")}`);

  /* The bug this replaced, shown explicitly: a timestamp cursor loses them. */
  const tsCursor = Math.max(...phone.map(r => r.ts));
  const naive = [...laptop].filter(r => r.ts > tsCursor);
  check("a timestamp cursor would have lost them (so the test is meaningful)",
    naive.length === 0);
}

/* ---- 2. rows sharing a millisecond survive a page boundary ------------- */
{
  const srv = server();
  const same = [row("phone", T0, 0), row("phone", T0, 1), row("phone", T0, 2)];
  srv.post("phone", same);
  const got = [];
  pullAll(srv, "laptop", 0, got);          /* page size is 2, so it must page */
  check("three rows in one millisecond all arrive",
    got.length === 3, `got ${got.length}`);
  check("their ids stay distinct",
    new Set(got.map(r => r.id)).size === 3);
}

/* ---- 3. both devices converge on the same rows and the same schedule --- */
{
  const srv = server();
  /* Offline on both: the same concept answered on each, seconds apart. */
  const phone = [row("phone", T0 + 10 * DAY, 0, { itemId: "a", correct: true })];
  const laptop = [row("laptop", T0 + 10 * DAY + 5e3, 0, { itemId: "b", correct: false })];

  srv.post("phone", phone);
  srv.post("laptop", laptop);

  const onPhone = [...phone];
  pullAll(srv, "phone", 0, onPhone);
  const onLaptop = [...laptop];
  pullAll(srv, "laptop", 0, onLaptop);

  const sortIds = rs => rs.map(r => r.id).sort().join(",");
  check("both devices hold the same rows", sortIds(onPhone) === sortIds(onLaptop),
    `\n    phone  ${sortIds(onPhone)}\n    laptop ${sortIds(onLaptop)}`);

  const byTs = rs => [...rs].sort((a, b) => a.ts - b.ts);
  const a = fold(byTs(onPhone), cfg);
  const b = fold(byTs(onLaptop), cfg);
  check("both devices compute the same schedule",
    JSON.stringify(a.retain) === JSON.stringify(b.retain));
  check("neither answer was discarded", a.retain.sep.reps === 2);
}

/* ---- 4. merging is idempotent: a re-delivered row changes nothing ------ */
{
  clearLog();
  const rows = [row("phone", T0, 0), row("phone", T0 + 1e3, 1)];
  check("first merge takes both", mergeRows(rows) === 2);
  check("second merge takes none", mergeRows(rows) === 0);
  check("the log did not grow", logRows().length === 2);
  check("a re-sorted redelivery is still ignored",
    mergeRows([...rows].reverse()) === 0);
}

/* ---- 5. a row without an id is refused rather than silently dropped ---- */
{
  let threw = false;
  try { appendRow({ ts: T0, course: "c" }); } catch { threw = true; }
  check("an id-less row throws instead of vanishing", threw);
}

console.log(fail.length ? `\n${fail.length} failing` : "\nall passing");
process.exit(fail.length ? 1 : 0);
