/* ============================================================================
 * src/lib/next.js — what this reader should do next, and why
 *
 * The course's front page used to be an inventory. It opened on "0/166 types
 * cleared · 0/32 concepts durable · 0 due today", then "0 mastered · 166 not
 * yet seen · 0 overconfident" — six numbers, two of which say the same thing,
 * none of which is an action, and every one of them zero on the day a reader
 * first arrives. The first thing the site said to a new reader was how much
 * they did not know, three different ways.
 *
 * What it could not say was the one thing a reader actually opens a course to
 * find out. Both loops already know their own half of the answer: `queue.js`
 * knows which concepts are due, `state.js` knows which question types are
 * uncleared, `place.js` knows which subsection reading stopped in. Nothing
 * arbitrated between them, so the reader did.
 *
 * This module is that arbitration and nothing else — a fold over state that
 * already exists into one ranked list. It is pure, it takes `now` as an
 * argument like the scheduler does, and it touches no DOM, so the ordering can
 * be tested without a browser (`tools/test-next.mjs`).
 *
 * ## Why this order
 *
 * Reviews decay and nothing else on the site does. A concept that came due
 * yesterday is losing the interval it earned, which is the one cost here that
 * grows while the reader does something else — so it leads, but only once
 * enough of them have collected to be worth a detour (DUE_FLOOR). Below that
 * they wait, because interrupting a reading session to answer two cards
 * teaches the reader that the site will nag.
 *
 * Everything after that is ordered by how much context the reader still holds:
 * finishing the subsection they were reading is cheaper than starting a new
 * one, and answering the questions on a subsection they just read is cheaper
 * than either. The last entry is the only one that is not work the reader has
 * already begun.
 *
 * ## What it will not do
 *
 * It never invents urgency. No streak, no daily goal, no count that exists to
 * be driven to zero — the meta-analytic result on badges and points is that
 * they raise extrinsic motivation and can undermine autonomy, which is poison
 * for a site whose whole premise is calibrated self-knowledge. Every item here
 * names a real piece of state and disappears when that state is cleared.
 *
 * It also never returns nothing. An empty queue is the moment a reader decides
 * whether to come back, and "Nothing due." with no way forward is the worst
 * answer available; when there is genuinely no outstanding work the last
 * branch offers the next unread section, and past the end of the course, free
 * practice.
 * ==========================================================================*/
import { qid } from "./util.js";
import { counts } from "./retention.js";

/* Fewer due than this and they ride along with the next reading session
   instead of interrupting it. Chosen as one short sitting rather than measured:
   the cost of being wrong is small in both directions, and the reader can
   always open review from the rail. */
export const DUE_FLOOR = 5;

/** Every question id in a subsection, in the order they are asked. */
const idsOf = sub => (sub.quiz || []).map(q => qid(sub.id, q.type));

/** Roughly how long the rest of `sub` will take, in whole minutes. */
const minutesLeft = (sub, frac = 0) => {
  /* Words, not blocks: a subsection is one screen or five depending on its
     prose, and a block count says nothing about which. 210wpm is the middle of
     the range usually quoted for careful reading of technical material, and it
     is deliberately not tuned per course — the number is here to distinguish
     "two minutes" from "twenty", not to be accurate. */
  const words = (sub.blocks || []).reduce(
    (n, b) => n + String(b.h || b.core || b.gist || "").split(/\s+/).length, 0);
  return Math.max(1, Math.round((words * (1 - frac)) / 210));
};

/**
 * Rank what is outstanding, most worth doing first.
 *
 * `place` is the reader's stored position, or null — it is only used when it
 * points into this course, since the record is global and the reader may have
 * been somewhere else since.
 *
 * Returns `[{ kind, href, title, why, count }]`, never empty. The caller shows
 * the first as the primary action and the rest as secondary; nothing is hidden,
 * so the ranking is a suggestion the reader can always overrule.
 */
export function nextUp({ C, cid, idx, state, drills, place = null, now = Date.now() }) {
  const out = [];
  const H = r => `#/${cid}${r ? "/" + r : ""}`;
  const stats = ids => (state && state.on ? state.stats(ids) : null);

  /* ---- 1. what is decaying ---------------------------------------------- */
  const due = drills && drills.has ? counts(cid, drills.keys).due : 0;
  if (due >= DUE_FLOOR) {
    out.push({
      kind: "review", href: "#/review", count: due,
      title: `${due} concepts due for review`,
      why: "Answering these now keeps the intervals you have already earned."
    });
  }

  /* ---- 2. the subsection reading stopped in ------------------------------ */
  /* The stored place is one record for the whole app, so it counts only when
     its route is this course's. A reader who has been elsewhere since gets the
     next branch instead, which is the honest answer rather than a stale one. */
  const here = place && place.id && idx.SUBS[place.id] ? idx.SUBS[place.id] : null;
  if (here && (place.hash || "").startsWith(`#/${cid}`)) {
    const { sub, num } = here;
    /* `into` is a pixel offset into a subsection whose height this module
       cannot know, so the fraction is left to the caller when it has one and
       treated as "part way" otherwise. */
    const frac = typeof place.frac === "number" ? place.frac : 0.5;
    const done = stats(idsOf(sub));
    if (!done || done.got < done.total || frac < 0.95) {
      out.push({
        kind: "resume", href: `#/${cid}/${sub.id}`,
        title: `${num} · ${sub.title}`,
        why: `You stopped part way in · about ${minutesLeft(sub, frac)} min left`,
        count: null
      });
    }
  }

  /* ---- 3. a subsection read but not answered ---------------------------- */
  /* "Read" is inferred from its neighbours rather than tracked: the site has
     no read-receipt and adding one would be a second record of something the
     answer log already implies. A subsection whose questions are untouched,
     sitting behind one whose questions are not, is one the reader passed
     through. */
  let lastAnswered = null;
  for (const sec of C.sections) {
    for (const sub of sec.subs) {
      const s = stats(idsOf(sub));
      if (s && s.seen > 0) lastAnswered = { sec, sub };
    }
  }
  const openQuiz = (() => {
    let prevSeen = false;
    for (const sec of C.sections) {
      for (const sub of sec.subs) {
        const ids = idsOf(sub);
        if (!ids.length) continue;
        const s = stats(ids);
        if (!s) return null;
        const num = idx.SUBS[sub.id].num;
        if (s.seen === 0 && prevSeen) return { num, sub, n: ids.length };
        if (s.seen > 0 && s.seen < s.total) return { num, sub, n: s.total - s.seen };
        prevSeen = prevSeen || s.seen > 0;
      }
    }
    return null;
  })();
  if (openQuiz && (!out.length || out[0].kind !== "resume" || out[0].href !== `#/${cid}/${openQuiz.sub.id}`)) {
    out.push({
      kind: "quiz", href: `#/${cid}/${openQuiz.sub.id}`, count: openQuiz.n,
      title: `${openQuiz.n} question${openQuiz.n === 1 ? "" : "s"} on ${openQuiz.num}`,
      why: "Checking what stuck is worth more than reading it again."
    });
  }

  /* ---- 4. the next section that has not been opened --------------------- */
  const firstUnread = C.sections.find(sec =>
    sec.subs.every(sub => {
      const s = stats(idsOf(sub));
      return !s || s.seen === 0;
    }));
  if (firstUnread) {
    const fresh = !lastAnswered;
    const parts = firstUnread.subs.length;
    out.push({
      kind: fresh ? "start" : "read", href: `#/${cid}/${firstUnread.id}`, count: null,
      title: `${fresh ? "Start" : "Read"} section ${firstUnread.num}: ${firstUnread.title}`,
      /* A reader opening a course for the first time is told the one thing that
         decides whether they can start here — the course assumes nothing before
         it. After that the count is all the row needs, because they already
         know how the course is shaped. */
      why: fresh
        ? `${parts} ${parts === 1 ? "part" : "parts"} · the course assumes nothing before this`
        : `${parts} ${parts === 1 ? "part" : "parts"}`
    });
  }

  /* ---- 5. below the floor, and the floor of all ------------------------- */
  if (due > 0 && due < DUE_FLOOR) {
    out.push({
      kind: "review", href: "#/review", count: due,
      title: `${due} concept${due === 1 ? "" : "s"} due for review`,
      why: "Short enough to do alongside whatever else you are working on."
    });
  }
  if (!out.length) {
    /* Everything read, everything answered, nothing due. This is a real state
       and it is a good one, so it is not an empty page — it is the only branch
       where practice is the right recommendation rather than a distraction. */
    out.push({
      kind: "practice", href: H("practice"), count: null,
      title: "Nothing is due — practise anyway",
      why: "You are ahead of the schedule. Mixed practice is what keeps you there."
    });
  }
  return out;
}
