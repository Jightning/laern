#!/usr/bin/env node
/* The scheduler and the criterion, checked as arithmetic.
 *
 *   node tools/test-schedule.mjs
 *
 * These are the claims the site makes about the reader's memory. They are the
 * one part of the system a browser test cannot reach, because reaching them
 * would mean waiting three days.
 */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

const { review, grade, retrievability, interval, due, nextDeadline } = await import("../src/lib/schedule.js");
const R = await import("../src/lib/retention.js");

const DAY = 864e5;
let failed = 0;
const ck = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
};

/* ---- the model ---- */
{
  const t0 = Date.now();
  let m = review(null, grade(true, "unsure"), t0);
  const first = interval(m);

  const better = review(m, grade(true, "sure"), t0 + first * DAY);
  ck("a success never shortens the interval", interval(better) >= first,
     `${first}d → ${interval(better)}d`);

  const worse = review(m, grade(false), t0 + first * DAY);
  ck("a miss never lengthens the interval", interval(worse) <= first,
     `${first}d → ${interval(worse)}d`);

  const target = 0.9;
  const at = due(m, { target });
  const r = retrievability(m, at, target);
  ck("recall on the scheduled day sits at target", Math.abs(r - target) < 0.06, `R=${r.toFixed(3)}`);

  let held = m;
  for (let i = 0; i < 5; i++) held = review(held, grade(true, "sure"), held.last + interval(held) * DAY);
  const exam = held.last + 30 * DAY;
  ck("deadline mode never steps over the exam", due(held, { deadline: exam }) <= exam,
     `interval would be ${interval(held)}d`);
  ck("a deadline already past does not move the interval",
     due(held, { deadline: held.last - DAY }) === due(held));

  ck("only exam dates still ahead count",
     nextDeadline(["2020-01-01", "2099-06-01"]) === +new Date("2099-06-01"));
}

/* ---- the criterion ---- */
{
  store.clear();
  const t0 = Date.parse("2026-03-01T09:00:00Z");
  const one = { itemId: "k:d1", correct: true, conf: "sure", now: t0 };
  R.answer("c", "k", one); R.answer("c", "k", one); R.answer("c", "k", one);
  ck("three answers to one item do not meet the criterion",
     R.phase(R.get("c", "k")) === "learning", R.label(R.get("c", "k")));

  R.answer("c", "k", { ...one, itemId: "k:d2" });
  R.answer("c", "k", { ...one, itemId: "k:d3" });
  ck("three distinct items meet the criterion", R.phase(R.get("c", "k")) === "criterion");

  for (let d = 0; d < 2; d++)
    R.answer("c", "k", { ...one, itemId: "k:d1", now: t0 + (d + 1) * DAY });
  ck("two relearn days are not durable", R.phase(R.get("c", "k")) === "criterion",
     R.label(R.get("c", "k")));

  R.answer("c", "k", { ...one, itemId: "k:d1", now: t0 + 3 * DAY });
  const c = R.get("c", "k");
  ck("three relearn days on three dates are durable", R.phase(c) === "durable");
  ck("durable took at least three calendar days", c.relearnDays.length === 3,
     c.relearnDays.join(" "));

  R.answer("c", "k", { ...one, correct: false, now: t0 + 4 * DAY });
  ck("a miss revokes durable", R.phase(R.get("c", "k")) !== "durable");

  store.clear();
  R.recruit("c", "x");
  const rec = R.get("c", "x");
  ck("a recruit is due within a day", rec.dueAt - Date.now() <= DAY + 1000);
}

console.log(failed ? `\n${failed} failed` : "\nscheduler ok");
process.exit(failed ? 1 : 0);
