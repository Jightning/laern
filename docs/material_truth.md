# Material truth

Invariants for course content, meaning anything written into `courses/<id>/`.
These hold for every subject, every author, and every level. If content breaks
one of these, the content is wrong.

For what governs the engine, see [`code_truth.md`](code_truth.md).
For *how* to write files, see [`create_course.md`](create_course.md); this file
says what must be true of the result.

**Numbering is historical, not positional.** Truths keep the number they were
given so that references stay valid; they are grouped by subject rather than by
number. §8 and §9 in particular run out of numeric order, because declaring the
review set has to be read before the obligation it creates.

**Effect sizes name their control condition.** A number without one invites
ranking errors, and the layout principles were for a long time quoted at figures
drawn from a single research program. Where a figure appears below it is from a
meta-analysis that includes laboratories outside that program.

---

## 1. The two rules everything else serves

**M1. Every piece of information appears exactly once.**
If two subsections need the same idea, one defines it and the other references
it. Restating is not thoroughness; it is a second copy that will drift out of
agreement with the first.

M1 governs *explanation*. A second application of an idea is not a second copy
of it; it is a different reader activity on the same idea. Repetition for
fluency lives in the drill bank, where M26 **requires** it. Without this clause
a careful author deletes the exact repetition long-term retention needs.

**A `core:` is not a second copy; a `gist:` is.** `core:` holds a block's
opening claim in its own field and `h:` holds only what develops it — one
paragraph split at a declared point, so the sentence exists once and there is
nothing to drift. `gist:` is a summary *about* a block whose prose is left
whole, and it is therefore a genuine second copy, permitted only under M34 and
counted against a declared ceiling. The difference is not stylistic: one of
them can fall out of agreement with the prose beside it and the other cannot.

**M2. Nothing is assumed beyond the stated calibration.**
Completeness is measured against a written record of what the reader already
knows, not against the author's sense of what is obvious.

Where a course uses tiers, completeness is measured against the **spine** (M23).
A reader who never expands a stub has still read a complete course.

M1 and M2 pull against each other. The reference system is how they coexist:
you can be complete without repeating, because the reader can always reach the
definition from wherever they are.

**M3. The calibration is written down.**
`materials/expectations.md` records what is assumed known, what is bridged, what
is taught in full, the exam format and dates, and the basis on which the review
set was chosen (M31). An unstated calibration is not a calibration; it is the
author guessing, unrecorded, and it cannot be checked or revised.

This is not bureaucracy. Whether a worked example helps or *hurts* depends on
the reader's expertise (see [Trade-offs](#trade-offs)), so a course that has not
stated its reader cannot know whether its scaffolding is correct.

`expectations.md` is therefore required, not optional. The build reads its front
matter, and the scheduler cannot aim at an exam that was never declared.

---

## 2. Every subsection

**M4. Every subsection carries at least one question.**
A subsection without retrieval is a document. Practice testing beats restudy at
g = 0.51 and no activity at g = 0.93 (Adesope et al. 2017, *RER*, 272 effects),
and content that omits it forfeits the main reason the site exists.

M4 guarantees retrieval exists; it does not guarantee it recurs, and spacing is
where the size of the effect comes from (g = 0.74 spaced over massed, Latimier
et al. 2021). Recurrence is guaranteed by M26 for the review set and by nothing
else, so a course whose review set is empty satisfies M4 and has no retention
loop. M31 makes that a declared choice rather than an accident.

**M5. One question per distinct question type, and no type repeats.**
The target is coverage of the *question surface*, not volume. A reader who can
answer every type has met every form the examiner can ask, and a reader who has
absorbed the material can derive any of them on the spot.

M5 governs the subsection quiz and nothing else. Repetition for fluency belongs
in the drill bank (M26), which carries no type-uniqueness constraint and is
scheduled rather than read. This is the Loop A / Loop B boundary that
`code_truth.md` §3b defines.

**M6. Every question carries `type`, `q`, `a`, `why`, `why_prompt`, and a
resolvable concept.**

- `type` and `why` were always required. An answer without reasoning teaches
  recognition of that answer and nothing transferable.
- `why_prompt` is the specific question the reader answers before the reveal.
  A generic "why?" wastes a prompt the author is already in a position to write,
  and elaborated retrieval is what adds d = 0.23 to transfer over plain
  retrieval (Pan & Rickard 2018).
- The concept may be declared with `concept:` or inferred where the subsection
  cites exactly one concept in the review set. It must resolve, because it is
  the identity a confident miss uses to pull the concept into Loop B (T18).

**M7. The `why` explains why the wrong answer is tempting**, not only why the
right one is right. A misconception survives an explanation that never names
it.

**M8. Every subsection names at least one term with a `def` block.**
Named terms are what the pre-training panel and primer are built from. A term
introduced inside a prose block is invisible to both, so the section's primer
silently degrades. This is mechanically checkable and should be checked.

M8 is a structural requirement, not an effect-size claim. Pre-training itself
measured g = 0.28 and not significant against no pre-training. The `def` block
earns its place by feeding the primer, the concept hub and the "Before you
start" panel, and the primer's *prequestioning* behaviour is the stronger and
separate mechanism (M29).

**M9. `type` names a skill, not a number.** "Detect overflow" is a type;
"Question 3" is not. It must describe what is being practised.

`type` is the identity for *coverage*. The concept key is the identity for
*retention*. A subsection tracks types; the scheduler tracks concepts. The two
never substitute for each other.

---

## 3. Order within a subsection

**M10. Nothing that qualifies a rule precedes it, and at most one move
precedes the definition.**

The body order is definition, rule, example, exception. What M10 forbids is a
*qualification* ahead of the thing it qualifies: meeting an exception before the
rule forces the reader to hold an unresolved contradiction, which is load spent
on nothing.

**One move may precede the definition, and only one, and only as the first block
of the subsection.** Its job is to create a target for the definition to land
on, and the definition must retire it explicitly. Two forms qualify:

- An **`attempt`**: a problem the reader cannot yet solve. The definition then
  refers back to what they tried.
- A **concrete anchor**: one specific instance in terms the reader already
  holds, which the definition generalises and names as a special case.

The retirement is not decoration, it is the mechanism. Concreteness fading, in
which a concrete instance is followed by an abstract statement, beat alternative
sequences at d = 0.76–0.83 (McNeil & Fyfe 2012) and led on transfer in
replication, with **concrete-only last** of the sequences tested. An anchor the
definition never retires leaves the reader holding an instance where a schema is
needed, which is the condition that performed worst. An unretired anchor
violates M10; it does not satisfy it.

Using both forms is using two moves, and is not permitted. Where an `attempt` is
used it *is* the anchor. Whether to use either is a trade-off, not a truth.

**M11. Worked examples are fully stepped.** A step the reader cannot reconstruct
is not an example; it is an assertion with numbers in it.

**M12. Anything examinable is in the body, not in a note.** A `note` block is
for material that is genuinely optional. Putting an examinable fact there is a
promise the course breaks. Nor does examinable material belong in a `depth`
block, for the same reason. See M25.

---

## 4. Across a course

**M13. An idea used in three or more places becomes a concept.**
Concepts get one definition site, a hub entry, and automatic margin cards
wherever mentioned. Below that threshold, a `def` is correct. Above it,
repeated `def`s are M1 violations waiting to happen.

M13 follows from M1 and carries no cost ceiling. Promotion is cheap: it is one
file and a link. It does **not** by itself create a scheduling obligation. What
a concept is scheduled for is decided by M31 and paid for by M26.

**M14. No forward reference without a link.**
If §4 needs an idea from §7, either move it earlier or make it a concept. An
unresolvable forward reference strands the reader.

**M15. The sequence follows the institution's own order** where one exists.
The reader sits that institution's exams. A pedagogically superior order that
desynchronises from lectures costs more than it gains.

**M16. Prerequisites are expressed as links, never as prose reminders.**
"Recall from earlier that…" followed by a restatement is M1 violated. A link
renders a margin card, feeds the prerequisite list, and draws an edge on the
dependency map: one action, four benefits, no duplication.

---

## 5. Figures and images

**M17. A figure must carry information the prose does not.**
A decorative diagram costs attention and returns nothing. Removing it improves
learning: this is the coherence principle, it is subtractive, and it is the
largest of the layout effects (removing seductive detail, g = 0.37–0.41,
Sundararajan & Adesope 2020).

**M18. Prefer a declarative figure to a supplied image** where the content can
be described as data. A spec stays sharp, follows the theme, and is corrected by
editing numbers rather than redrawing.

**M19. Every image has alt text describing what it *shows*.**
A figure that cannot be read by everyone is not a learning aid. "Diagram" is not
alt text.

---

## 6. Accuracy

**M20. Facts are grounded in the institution's own sources**, not written from
memory. Catalog, course page, syllabus.

**M21. Anything unverifiable is flagged in place, never guessed.**
A confidently wrong grading weight or lab platform is worse than a blank with a
note saying where to find it. Grading percentages in particular vary by term and
instructor and should be left for the reader to fill in.

**M22. A worked answer that is wrong is worse than no answer.**
Content is checked by re-deriving it, not by re-reading it. Two errors in this
project's own history, a miscounted prime-implicant set and an answer field that
contradicted its own explanation, both survived re-reading and were caught only
by working the problem again.

Re-derivation is recorded, not remembered: every quiz answer and drill item
carries the date it was last re-derived, and `npm run audit` reports the ones
that carry none.

---

## 7. Tiers

**M23. Every block declares a tier: `spine`, `depth` or `apply`.**
The spine alone satisfies M2. Depth and apply may reference the spine; the spine
may not depend on them. A reader who never expands a stub has read a complete,
self-sufficient course.

An absent `tier:` is a declaration of `spine`, not an omission. That default is
what lets a course written before tiers existed keep rendering as one complete
lane, and it fails safe: the mistake it can produce is a block shown to every
reader, never a block hidden from one.

Whether a course uses depth and apply at all is a trade-off. That the spine
stands alone is not (T33), and it is checked by rendering the spine and
resolving every reference.

**M24. An `apply` block instantiates; it never re-explains.**
It uses a concept the spine already states. An application that restates its
concept's definition is an M1 defect, and the fix is a link.

**M25. Nothing examinable lives in `depth`.**
M12 extended: a `depth` block is a promise that collapsing it costs the reader
nothing examinable. If it can be asked, it is spine. This is the failure mode
with the worst consequence, which is why it has its own number.

The mechanical form of the check: no concept with an exam-format drill item may
have its only spine coverage inside a `depth` block.

---

## 8. The review set and the drill bank

**M31. The review set is declared, never inferred.**
Every concept the course intends to hold over months is marked `review: true`,
and `expectations.md` says on what basis the set was chosen. An undeclared
review set is the author guessing about what matters in six weeks, unrecorded,
and it cannot be checked or revised. This is M3 applied to retention.

The declaration and what it costs are checked against each other, in both
directions: a concept marked `review: true` with no drill file fails the build,
a drill file whose concept is not marked warns, and a non-empty review set with
no stated basis fails. Two records of one decision drift; one record with a gate
across it cannot.

M31 exists because promotion and scheduling are different decisions with
different costs. M13 promotes on a non-redundancy threshold and is cheap. Being
scheduled costs three worked items per concept (M26), and nothing in the
evidence says every recurring idea must be scheduled. What the evidence
constrains is the shape of scheduling once you choose it.

A course may declare an empty review set and remain correct. It simply has no
Loop B, and it must not claim retention it does not schedule for.

**M26. A concept marked for review carries at least three drill items with fully
stepped solutions (M11), spanning at least two formats, at least one of which
matches the course's declared exam format.**

Three is the criterion count, not a round number. Criterion learning requires
three *different* items or it degrades into memorising one question (T31).
A higher floor is not better: the benefit of a higher initial criterion washes
out once relearning happens (Vaughn, Dunlosky & Rawson 2016).

Formats vary because format match to the criterial test is a moderator, and
mixed-format practice produced the strongest effect in the largest analysis
(Adesope et al. 2017). The format *ranking* is contested and this rule takes no
position on it; the *match* is not.

**M27. Every drill item names the concept it exercises.**
The scheduling identity is declared, never inferred, for the same reason M16
makes prerequisites links rather than prose.

**M32. At least one drill item per reviewed concept differs in surface from the
section's worked example, while asking for the same kind of response.**
Varying the surface is what stops item memorisation. Holding the response is
what preserves the effect: response congruency between practice and criterial
test moved transfer from d = 0.28 to d = 0.58 (Pan & Rickard 2018). Changing
both at once discards the congruency and tests something else.

**M33. Every specific value stated in a `key` block has a matching drill item.**
A constant, threshold, sign convention, ordering or boundary that is stated and
never retrieved is a sentence, not a memory. The test: could the reader lose a
mark by forgetting this exact thing while understanding everything around it?

This is the mechanical form of what M4's recurrence clause promises, applied at
the grain where detail loss actually happens.

---

## 9. Trust

**M28. Every explanatory claim names its source, or is flagged unverified in
place.** M20 and M21 extended from metadata to explanation, where a confident
error costs more and is much harder to notice. `npm run audit` reports the
unverified fraction and fails above a per-course threshold.

**M30. Model-drafted content carries `source: generated`, which counts as
unverified until a human replaces it with a real source.** Generation is a
drafting step, never a publishing step. A `def` block written by a model is an
unverified claim wearing an authored block's styling, which is the one thing
M28 exists to prevent, and a course written entirely by a model must not be able
to pass the M28 audit at zero percent unverified.

**M29. Each section's primer prequestions a relation, not only a term.**
M8 guarantees a named term. A term is not a relation, and the prequestion
benefit does not generalise past what was asked: g = .66 on the prequestioned
content, g = .01 on everything else in the same activity.

The correction must appear immediately and is not optional. An uncorrected
conceptual pretest error is *more* likely to be repeated later than one never
asked. A primer prequestion without a correction is worse than none.

Primers are section-level and live in `_section.yaml`. `def` blocks are
subsection-level. The two are different mechanisms and neither substitutes for
the other.

---

## 10. Claims and categories

**M34. A block states its claim once, and says which way it did it.**
Every `def`, `key` and `trap` declares exactly one of two fields, never both:

- **`core:`** — the block's own opening claim, stored apart from its
  development. `h:` then carries only what develops it. Nothing is duplicated,
  so this is the default and the one an author should reach for.
- **`gist:`** — a summary about the block, rendered only when the block is
  closed. `h:` stays whole. This *is* a second copy (M1), and it exists for
  prose that must withhold its claim on the first read: a `trap` works because
  the reader believed otherwise thirty words ago, and hoisting the correction
  defuses it. Reading order matters on a first read, and a first read is the
  full text — so a closed view showing the claim costs nothing.

The field name is the declaration. A mode flag beside it would be a second
record of one choice, which is the shape every rule in this file exists to
prevent.

**Why a claim has to be separable at all.** A provided outline of a text raises
memory (g = 0.61) and does not reliably raise comprehension (g = 0.34, not
significant; Ponce, Mayer & Méndez 2023, *Educational Research Review*, on
instructor-provided outlining). So a closed view is a lookup and review
surface, never a substitute for reading, and what it must contain is the claim
itself rather than a topic or a heading. A row reading "The split trap" tells a
reader nothing they can check themselves against; a row reading "random
frame-level splits leak near-duplicates across train and validation" does.

**`gist:` is ungated debt unless it is ceilinged.** Of the two it is the easier
to write — a summary needs no prose discipline, while a `core:` obliges the
block to open with its claim — so a course left to drift writes nothing else.
`npm run audit` reports the fraction and a course declares its ceiling in
`course.yaml`, exactly as it does for `unsourced`.

**M35. A category is declared, never inferred, and carries a boundary.**
This is M31's shape applied to classification, for M31's reason: an undeclared
grouping is the author guessing, unrecorded, and it cannot be checked or
revised.

- **`cat:`** is the principal tag — one per block or concept, optional, and it
  must name a `categories/<key>.yaml`.
- **`tags:`** are secondary and plural, free-form, slugs.

A **label names one block; a category names a set.** That is the whole
distinction and it is why they are different fields rather than one. A category
has an *extension* — members drawn from anywhere in the course, in any section
— and a *boundary*, which is what falls outside it and which sibling it falls
into instead. A category file with no `boundary:` is a label that has been
given a page.

The boundary is required because the contrast is the mechanism rather than the
decoration. Comparing cases beats meeting them one at a time (d = 0.50 against
sequential, single or non-analogous cases; Alfieri, Nokes-Malach & Schunn 2013,
*Educational Psychologist*), and `siblings:` is what turns a list of members
into a comparison. Siblings must name each other, for the reason
`confusable_with` must: a contrast drawn one way is half a contrast.

Scope is deliberately narrow. Categories attach to **blocks and concepts only**.
A drill item's category is its concept's, derived rather than authored, because
the item already names its concept (M27) and two records of one fact drift. A
quiz item has no category at all: `type` is already its identity (M9), and a
second one would compete with it.

**M36. Every block can name itself.**
A block with no `term:`, `label:`, `cap:`, `title:` or registered default has no
row at the closed view and simply vanishes from the reader's index of the
course. This is a structural requirement in the same sense as M8: it is what
the index is *built from*, and a block that cannot be named cannot be found.

The exception is `p`, and it is an exception by definition rather than by
omission. **A `p` block carries no claim** — it sets up, bridges, or fades a
concrete anchor — so it has nothing to name and is not in the index. A `p` that
asserts something is the wrong block type; it is a `key`.

---

## Trade-offs

Legitimate variation. None of these is a truth, and changing them is editorial
judgement rather than a defect.

### Whether to tier at all

M23 requires a declared tier and M25 constrains what `depth` may hold. Whether a
course carries depth and apply tiers, or ships spine-only, is a preference. The
coherence evidence covers material the learner cannot avoid, and opt-in
collapsed detail has not been tested against a single-density alternative.

### How large the review set is

M31 requires it to be declared; it does not say how big. Reviewing everything
costs three items per concept and buys retention of things the exam never asks
about. Reviewing nothing is honest and gives up Loop B. The defensible middle is
what the exam can test plus what the author expects to be error-prone, and
the outcome log is what tells you afterwards whether the set was chosen well.

### Depth per course

A one-credit seminar and a four-credit core course should not have the same
density. Padding the seminar to look substantial would violate M1 directly.
Depth should track what the course actually examines, not what looks impressive
in a table.

### How much scaffolding

Worked examples reduce load for novices facing unfamiliar, highly interactive
material; this is well established. But the benefit **shrinks, disappears, and
eventually reverses** with expertise: for a reader who already holds the schema,
solving beats studying examples, and effect-size differences of d = 0.45 to 2.99
have been found between low and high prior-knowledge learners given the same
support (Kalyuga 2007).

**So the right amount of worked-example support is a function of the reader**,
which is exactly why M3 requires the calibration to be written down.

Deliberately erroneous examples sit on the same axis and reverse the same way.
Studying a worked solution containing an error can foster far transfer, the
benefit is larger for readers with **higher** prior knowledge, and it is larger
when the error is not located for them, because locating it is the work (Große &
Renkl 2007). The conditions are strict: the correct version must come first, and
the reader must be asked to detect, explain and correct rather than to read. For
a novice, correct examples alone were better. So this is calibration, not a
rule.

### Whether a subsection opens with an `attempt`

Problem-solving before instruction was favoured overall against
instruction-first, with the effect strongest for conceptual and transfer
outcomes among older STEM learners, and reversing toward instruction-first for
young learners and domain-general skills (Sinha & Kapur 2021, *RER*). Design
fidelity matters and the evidence outside STEM is thin. M10 permits it; nothing
requires it.

### Subsections per section

Two to five is a reasonable band. Fewer usually means the section is thin; more
usually means it is two sections. Neither is a rule.

### Concepts per course

There is no cap. M13's threshold follows from M1, and a course with many
recurring ideas legitimately has many concepts. What has a cost is the review
set (M31), and that is where restraint belongs. A hub with thirty entries is a
navigation question; a review set with thirty entries is ninety drill items.

### Question count beyond type coverage

A second question of an existing type is wrong *in the quiz* and right *in the
drill bank*. That is a routing decision, not a judgement about volume. What
remains a judgement is how many drills a concept needs beyond M26's floor of
three, and that depends on how error-prone the concept is rather than on how
important it looks.

### Which `materials/` files to write

Not all are optional, and two are no longer written by hand at all.

| File | Status |
|---|---|
| `expectations.md` | **Required.** M3, and the build reads its front matter. |
| `syllabus.md` | Optional; high value per effort. |
| `reference.md` | Optional; high value per effort. |
| `schedule.md` | Optional. |
| `problems.md` | **Generated** from `drills/`. Editing it fails the build (T20, T21). |
| `checklist.md` | **Generated** from the review set and learner state. |

A file that would restate what the site already says should not be written at
all.

### How much of a course is categorised

M35 requires a category to be declared and bounded; it does not say how much of
a course should carry one. Categorising everything makes the chip a decoration
that stops signalling (T13 degrades with density), and categorising nothing
gives up the one grouping that is neither positional nor argumentative.
Categories may be as narrow as the author likes — a category of four things is
useful if those four are genuinely a kind — and the defensible middle is the
sets a reader would actually look up as a set.

### Tone and voice

Register is the author's. What is not optional is that a label labels, an
example demonstrates, and nothing quietly does two jobs.

### Institution order versus pedagogical order

M15 says follow the institution. The exception is a genuine dependency
violation, where the official order presents something that cannot be understood
without a later topic. Then insert a bridge or promote the idea to a concept,
and say in the section blurb why the order differs.