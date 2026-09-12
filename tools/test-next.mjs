#!/usr/bin/env node
/* The order the Desk recommends in.
 *
 * `nextUp` is the only place in the engine that arbitrates between the two
 * loops, and it decides what a reader sees first every time they open a course.
 * The ordering is a judgement, but the properties below are not: they are what
 * the ordering has to hold for the recommendation to be honest.
 *
 *   node tools/test-next.mjs
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { nextUp, DUE_FLOOR } = await import("../src/lib/next.js");

/* ---- a course of three sections, two subsections each -------------------- */

const sub = (id, title, nq) => ({
  id, title,
  blocks: [{ h: "word ".repeat(420) }],           /* ~2 minutes of reading */
  quiz: Array.from({ length: nq }, (_, i) => ({ type: `t${i}` }))
});
const C = {
  sections: [
    { id: "s1", num: 1, title: "First", subs: [sub("s1-1", "Opening", 3), sub("s1-2", "Second", 3)] },
    { id: "s2", num: 2, title: "Middle", subs: [sub("s2-1", "Third", 3), sub("s2-2", "Fourth", 3)] },
    { id: "s3", num: 3, title: "Last",   subs: [sub("s3-1", "Fifth", 3)] }
  ]
};
const idx = { SUBS: {} };
C.sections.forEach(s => s.subs.forEach((u, k) => {
  idx.SUBS[u.id] = { sec: s, sub: u, num: `${s.num}.${k + 1}` };
}));

/* `state` is faked to the shape state.js exposes: `seen` of `total` answered
   and `got` of those mastered, per list of question ids. */
const stateWith = answered => ({
  on: true,
  stats(ids) {
    const s = { seen: 0, got: 0, missed: 0, over: 0, under: 0, due: 0, total: ids.length };
    ids.forEach(i => {
      const r = answered[i];
      if (!r) { s.due++; return; }
      s.seen++;
      if (r.got) s.got++; else s.missed++;
    });
    return s;
  }
});
const allOf = subId => [0, 1, 2].map(i => `${subId}#t${i}`);
const mastered = subs => Object.fromEntries(
  subs.flatMap(allOf).map(i => [i, { got: true }]));

const noDrills = { has: false, keys: [] };
const run = (o) => nextUp({ C, cid: "c", idx, drills: noDrills, ...o });

/* ---- a fresh course opens on "start", never on a stat ------------------- */

const fresh = run({ state: stateWith({}) });
check("a fresh course recommends something", fresh.length > 0);
check("a fresh course starts at section 1", fresh[0].kind === "start",
      JSON.stringify(fresh[0]));
check("the first recommendation carries a reason", !!fresh[0].why);
/* A reason has to be a reason, not a count.
 *
 * The browser suite caught this and this file did not: `why` had collapsed to
 * "6 parts" while the title still said "Start", so the row was well-formed,
 * non-empty, and said nothing a reader could act on. Asserting the field exists
 * is not the same as asserting it earns its place. */
check("a first-time reader is told the course assumes nothing before this",
      /assumes nothing/.test(fresh[0].why), fresh[0].why);
check("and the reason is a sentence, not a count",
      fresh[0].why.split(/\s+/).length >= 5, fresh[0].why);

/* Counts agree with their nouns. "1 parts" shipped. */
const oneSub = {
  sections: [{ id: "s1", num: 1, title: "Only", subs: [sub("s1-1", "Single", 2)] }]
};
const oneIdx = { SUBS: { "s1-1": { sec: oneSub.sections[0], sub: oneSub.sections[0].subs[0], num: "1.1" } } };
const single = nextUp({ C: oneSub, cid: "c", idx: oneIdx, drills: noDrills,
                        state: stateWith({}) });
check("a one-part section does not say \"1 parts\"",
      !/\b1 parts\b/.test(single[0].why), single[0].why);
check("the first recommendation goes somewhere", fresh[0].href === "#/c/s1",
      fresh[0].href);

/* ---- never empty, whatever the state ------------------------------------ */

const done = run({ state: stateWith(mastered(["s1-1", "s1-2", "s2-1", "s2-2", "s3-1"])) });
check("a finished course still recommends something", done.length > 0,
      JSON.stringify(done));
check("a finished course offers practice, not a dead end",
      done[0].kind === "practice", JSON.stringify(done[0]));

/* ---- an unanswered quiz behind an answered one is surfaced -------------- */

const midway = run({ state: stateWith(mastered(["s1-1"])) });
check("an untouched quiz behind an answered one is offered",
      midway.some(x => x.kind === "quiz"), JSON.stringify(midway));
check("and it names the subsection it belongs to",
      (midway.find(x => x.kind === "quiz") || {}).href === "#/c/s1-2",
      JSON.stringify(midway.find(x => x.kind === "quiz")));

/* ---- due reviews lead only once enough have collected ------------------- */

const drillsDue = n => ({ has: true, keys: Array.from({ length: n }, (_, i) => `k${i}`) });
/* retention.counts reads real storage, which is absent here, so the due branch
   is exercised through the shape rather than the store: with no storage every
   key counts as not-in-contact and `due` is 0. That is the correct fresh-install
   answer, and it is asserted rather than assumed. */
const withKeys = run({ state: stateWith({}), drills: drillsDue(9) });
check("no storage means nothing is due, not everything",
      !withKeys.some(x => x.kind === "review"), JSON.stringify(withKeys));

check("the floor is a small number of cards", DUE_FLOOR >= 2 && DUE_FLOOR <= 12, String(DUE_FLOOR));

/* ---- a stored place in another course is ignored ------------------------ */

const elsewhere = run({
  state: stateWith(mastered(["s1-1"])),
  place: { hash: "#/other/s1-1", id: "s1-1", into: 300 }
});
check("a place in another course does not become a resume",
      !elsewhere.some(x => x.kind === "resume"), JSON.stringify(elsewhere));

const mine = run({
  state: stateWith(mastered(["s1-1"])),
  place: { hash: "#/c/s2-1", id: "s2-1", into: 300, frac: 0.4 }
});
check("a place in this course leads", mine[0].kind === "resume", JSON.stringify(mine[0]));
check("resume names the subsection by its number",
      mine[0].title.startsWith("2.1 ·"), mine[0].title);
check("resume estimates what is left", /\d+ min left/.test(mine[0].why), mine[0].why);

/* ---- every item is actionable ------------------------------------------- */

for (const set of [fresh, done, midway, mine]) {
  const bad = set.filter(x => !x.href || !x.title || !x.kind);
  check(`every recommendation is complete (${set[0].kind})`, bad.length === 0,
        JSON.stringify(bad));
}

console.log(fail.length ? `\n${fail.length} failed` : "\nall passed");
process.exit(fail.length ? 1 : 0);
