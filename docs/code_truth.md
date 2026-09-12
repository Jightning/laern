# Code truth

Invariants for the engine, components and styles. These hold regardless of
framework, palette, or delivery format. If a change breaks one of these, the
change is wrong, not the rule.

For what governs course *content*, see [`material_truth.md`](material_truth.md).
For *how* to write a course, see [`create_course.md`](create_course.md).

Every claim below is either an accessibility standard, a measured property of
this codebase, or a finding with independent meta-analytic support. Anything
contested, or true only under some conditions, is in
[Trade-offs](#trade-offs) instead.

**How effect sizes are quoted here.** Every number names what it was measured
against, because a number without a control condition invites ranking errors.
Where a figure comes from a single research program, that is stated and the
independent replication is given alongside. Numbers are estimates from
aggregate studies, not guarantees for an individual.

**Numbering is historical, not positional.** Truths keep the number they were
given so that references stay valid; they are grouped by subject rather than by
number.

---

## 1. Accessibility is not negotiable

**T1. Every text/background pair meets WCAG AA** — 4.5:1 for body text, 3:1 for
large text (≥24px, or ≥18.66px bold), in **both** themes.

Not a preference. It is the published threshold below which text becomes
unreadable for low-vision users, and it is a legal requirement in most
jurisdictions this will ever be used in.

**T2. Contrast is verified by walking rendered text, never by sampling.**
`tools/audit-color.mjs` computes the real ratio for every distinct
(foreground, effective background) pair across every view of **every** course,
in all three colour modes: light, the in-page dark toggle, and the reader's OS
dark setting.

This rule exists because it was learned the expensive way, three times.
A six-selector spot check once reported "all pass" while **eight** real
failures were live. Sampling does not work, because the failures are in the
selectors you did not think to check.

The scope is part of the rule, not an implementation detail. A sweep of one
course leaves every other palette ungated, and the two dark paths are separate
CSS blocks that have already diverged once: a stale copy of the palette won on
the OS-dark path while the toggle looked correct.

The reading method is part of the rule too. Colours are painted into a 1×1
canvas and read back as pixels, never parsed out of the computed string.
`getComputedStyle` returns whatever colour space the author wrote, so an
rgb-shaped regex reads `oklch(0.7 0.112 26)` as `rgb(0, 7, 0)` and reports a
bright accent as 1.10:1.

Every route a course can produce is in the swept set, including routes added
later. A view outside the sweep is a palette nobody checked.

**T3. Vivid accents are for shapes; text uses the ink variants.**
`--hi` `--lo` `--dc` `--hz` are for borders, fills, strokes and graphics.
`--hi-ink` `--lo-ink` `--dc-ink` `--hz-ink` are for text, and are tuned to clear
AA against the page ground.

An accent that passes on white can fail on the page ground, and a change to the
ground silently invalidates every accent at once.

The ink variants must clear AA at **every** hue the palette can be rotated to,
not at the one it ships with. WCAG measures luminance, which still drifts with
hue at a fixed perceptual lightness, so the ink variants sit dark enough that
the worst hue in the rotation passes rather than only the best one.

**T4. Dark mode uses a softened black, never `#000`, and never saturated
accents.** High-saturation colour on pure black causes halation, a glow that
makes text painful for astigmatic readers.

**T5. Motion respects `prefers-reduced-motion`.** Scroll behaviour and
transitions must degrade to instant. Vestibular disorders make unrequested
motion genuinely harmful, not merely annoying.

**T26. Colour never carries meaning on its own.** Every state encoded by
colour is also encoded by shape, position, pattern or text. WCAG 1.4.1, and it
is the failure mode that survives longest, because the person who built it can
always see the difference.

Found twice here: mastery was a 7px dot distinguished only by fill, with an
identical tooltip on all three states, and dependency-map nodes carried mastery
in their stroke colour alone. Both now differ in shape or stroke pattern and
name the state in text.

This extends to every state the newer machinery introduces. A tier stub carries
a count in text. A concept's review state is named in words. Generated content
says it is generated.

**T27. A colour with a semantic job does not take part in decoration.** The
accents rotate per course to tell courses apart; the warning accent does not,
because a warning is not an identity. Rotating it would make "common mistake"
olive in one course and teal in the next, which forces the reader to learn a
mapping instead of arriving with one.

**T6. Every interactive control is reachable and labelled** — keyboard
focusable, with a visible focus ring and an accessible name.

Reachable includes *reachable first*. A skip link is the opening tab stop, and
a list of results is driven from the field above it rather than by tabbing
through every row. A control that takes forty keystrokes to reach is reachable
only in the sense that a locked door is openable.

---

## 2. Reading

**T7. The reading measure stays within 50–75 characters per line, targeting
66.** Below 50 the eye returns too often; above 75 it loses the line start.
WCAG sets 80 as a hard ceiling.

**T8. The measure is re-measured after any typographic change, never assumed.**
Character width is a property of the face, not the pixel width. Switching this
project's body face from a system sans to a serif moved a 628px column from
66 CPL to 69 without a single CSS value changing.

Reading geometry is expressed in `rem` for the same reason: column, type and
vertical rhythm scale together, so characters per line and the spacing between
blocks both hold at whatever text size the reader has chosen. Spacing pinned in
pixels while the type scales turns a readable page into a cramped one, the
opposite of what raising the text size asked for.

**T9. One reading column. Content does not compete with itself.**

**T41. Uppercase is for labels the reader scans, never for text the reader
reads.** All-caps removes the ascender and descender cues that let a word be
recognised by its shape rather than decoded letter by letter, and it discards
the casing that identifies a proper noun. The cost is negligible at one or two
fixed words, where the reader is matching a shape they already hold, and real
in anything read as a sentence: Tinker's reading studies put continuous
all-caps around a tenth slower, which is why signage and interface guidelines
alike reserve it for short labels.

**The test is the string, not the element: if you would read it aloud as a
sentence, it is not a label.** A figure caption describes, a `why_prompt` asks,
a quiz answer states, and a course's `meta` names an institution — every one of
those was set in caps here, including the prompt that carries the largest
transfer effect on the site and the line that rendered "Edwards, Penney &
Calvis 6e" as "EDWARDS, PENNEY & CALVIS 6E", which is the same string with its
information removed.

A button, an eyebrow and a tier badge stay in caps: those strings are fixed in
the engine at one or two words, and there the caps is doing signalling work
(T13). An *authored* field is the case that settles the rule — a block's
`label:` defaults to "Definition" and is also written as "The cut property —
why greedy is safe here", and no renderer can tell those apart. A constraint the
content routinely exceeds is a wish rather than a rule, so the caps come off and
the signal stays in the face, the spacing and the per-block accent, which is
what T13 asks for in the first place.

**T28. The reader magnifies the material, not the furniture.** Page zoom
enlarges the sidebar and the toolbar along with the prose, so the reading column
ends up no wider than it started: the reader asked for more material and got
more chrome. Ctrl +/-/0 therefore scale the content column alone, and are left
to the browser at the ends of the scale so page zoom stays reachable.

---

## 3a. Layout: well supported, small effects

These shape how material is presented. They are worth holding and they are not
where the leverage is. The figures below come from meta-analyses that include
laboratories outside the originating research program, and they are materially
smaller than the numbers usually quoted for these principles: a meta-analysis of
the source corpus itself (Cavanagh et al. 2025, *Educational Research Review*;
92 articles, 181 studies, 591 effects) found an overall effect of g = 0.37 and a
small decline in effect size per year.

**T10. Segmenting: the learner controls the pace.** Material is delivered in
learner-advanced units, never as one continuous scroll.
(g = 0.19 in the source corpus, g = 0.32–0.36 independently (Rey et al. 2019),
against the same lesson delivered continuously.)

**T11. Coherence: nothing appears in the spine that does not serve the lesson.**
Decoration costs attention and returns nothing. This is the largest of the
layout effects and it is subtractive: the win comes from removing, not adding.
(Removing seductive detail: g = 0.37–0.41, Sundararajan & Adesope 2020.
Sentence-level coherence: g = 0.63.)

**Coherence is enforced per lane, not per course.** What was measured is
nonessential material embedded in a lesson the learner cannot avoid. A tier the
reader chose to expand is not that manipulation. So T11 binds the spine
absolutely, and a `depth` tier is not a coherence violation. Whether opt-in
depth *helps* is untested and sits in Trade-offs.

**T33. The spine tier is complete alone.** Depth and apply may depend on the
spine; the spine may never depend on them. This is an internal-consistency
property, not a finding, and it is enforced as far as it is mechanical: a
spine-only render must resolve every reference, and a spine block may not cite a
figure only a collapsed tier declares.

T33 is what makes T11's per-lane scoping safe. Without it, collapsing a tier
silently removes part of the argument.

**T42. The reader sets the resolution, and no resolution removes anything.**
Depth (`full`, `notes`, `index`) decides how much of each block is open; it
never decides which blocks exist. Every closed block opens in place, so every
depth is the same course at a different resolution rather than a subset of it.

Depth is orthogonal to tier and neither substitutes for the other. Tier asks
*which blocks belong to the argument* and removes the rest; depth asks *how
much of each surviving block is open*. Conflating them was measured and it
fails: across this project's own courses 99% of blocks in one and 80% in
another are `spine`, so the lane has almost nothing to remove and the prose it
cannot touch is four fifths of the text.

**A closed view is a lookup surface, not a reading one.** Instructor-provided
outlining raises memory (g = 0.61) and does not reliably raise comprehension
(g = 0.34, not significant; Ponce, Mayer & Méndez 2023, *Educational Research
Review*); instructor-provided graphic organizers run g = 0.70 on memory and
g = 0.53 on comprehension, with the authors reporting evidence of publication
bias (Ponce, Mayer & Méndez 2025, *Educational Psychology Review*). So `full`
is the default, nothing nudges a reader off it, and the closed views say in
words how much they are holding back.

Why the control belongs to the reader rather than to the author: the value of
provided support reverses with expertise (see Trade-offs, Kalyuga 2007), so the
right amount is a property of who is reading rather than of the material. An
author fixing it once cannot be right for both readings.

**T44. Chrome is subordinate to content, and that is a measurable claim.**
No interface text sits below 12px, and anything with words in it starts at 13px
against a 17px body. This is a rule because it was broken systematically rather
than once: the most-used size in this stylesheet was 10.6px, ~80 declarations sat
under 12px, and on a closed view the sub-12px chrome outnumbered the content
elements by roughly four to one. A repeated micro-label is worse than no label,
because the eye stops to decode it and gets back a word it did not need.

Two corollaries, both of which were violations here. **A default label printed on
every block is not signalling**, it is texture — signalling is a contrast effect
and degrades with density (T13). And **a label the reader reads rather than scans
is not a label** (T41); the renderer counts words, because a stylesheet cannot
see the string.

**T46. A claim may only stand in for what it can encompass.** At a closed depth
a block shows its claim instead of its body only where the claim carries the
content. Where it would carry a count or a topic — a list of four things behind
"four things", a table behind its caption — the block stays whole, because a
title presented as a note is worse than a title presented as a title: the reader
believes they have read it.

This is decided by the kind wherever the kind decides it. A block whose substance
is an enumeration is declared `holds: structure`, and a claim on one of those
opens it rather than replacing it. Where the kind cannot decide — prose with a
list inside it — the gate warns and the author chooses.

**T45. A disclosure that opens can close, from the same control.** Not merely
somewhere — the thing you press to open is the thing you press to close. A
separate close button puts the way out in a different place from the way in, so
the reader has to go looking for the exit to a room they just entered; and it
lands at the foot of a block whose top is where their eye already is. A
page-level "reveal all" likewise returns to the state the reader's current depth
defines, not to the full text. Otherwise closing is a different act from never
having opened, and a reader who opened one block to check something has no route
back to the view they were reading in.

**A press that ends a drag is a selection, not a press.** Where the control is
also text — a title, a term, a caption — it is the text most worth copying, and
closing the block out from under a half-made selection loses the selection and
the reader's place together. A collapsed selection is what separates the two,
and the control stays selectable rather than being made inert to avoid the
question.

"What the depth defines" is the whole of it, which means closing everything also
re-closes a tier stub the reader had opened by hand. The property to hold is
idempotence — one reveal-and-close and two land in the same place — not a return
to whatever happened to be on screen a moment earlier, because that is a
different and unreachable state.

**T43. Grouping by membership is a separate mechanism from grouping by
position, role or mention.** Sections group by position, tiers by role in the
argument, concepts by mention. A category groups by *what kind a thing is*, and
its members may sit anywhere. It carries a boundary and named siblings, because
a comparison against what a thing is *not* is the mechanism (d = 0.50 for case
comparison against sequential or single cases; Alfieri, Nokes-Malach & Schunn
2013, *Educational Psychologist*), and because interleaving pays only where the
neighbours are genuinely confusable (T16).

A category's visual key is text and position, never a hue of its own. The
palette is one angle per course and the contrast sweep covers every view in
three colour modes; a hue per category would multiply that sweep to decorate
what the name already says (T26, T2).

**T12. Spatial contiguity: a reference renders adjacent to the thing that needs
it.** Never collected at the end of a section, never behind navigation that
loses the reader's place. Requiring the reader to mentally bridge a gap is the
split-attention effect. (Small and positive; g ≈ 0.13 in the source corpus.)

**Collapsing a tier is not hiding a reference.** T12 forbids moving a reference
away from its mention. A tier stub expands in place, preserving scroll position
and keeping the reference where it was. The distinction is whether the reader
loses their place, not whether something starts collapsed.

**T29. A margin card is a reminder, not a copy.** Its length is a layout
constraint, not a matter of taste: a reading row is as tall as the taller of
the block and the card beside it, which is what keeps a card level with what it
annotates. Exact alignment and a gapless reading column cannot both hold, so
the card is what gives: previews clip, stacks cap, and the overflow becomes a
compact list that is still adjacent.

**A collapsed tier's cards demote to chips inside its stub.** A stub is one
line, and a card anchored to a one-line row is a hole by construction. This is
the same defect that once measured 966px and was brought down to 308px, and
chips are already the mechanism T29 uses for overflow.

**T13. Signaling: structure encodes meaning.** A definition, a rule, a trap and
an example are visually distinct because they are *different kinds of thing*.
Structural devices must be true about the content, not decorative.
(g = 0.24 in the source corpus, g = 0.38 independently (Alpizar et al. 2020),
against the same material unsignalled.)

Signaling is a contrast effect, so it degrades with density. Five traps in a
subsection is zero traps.

**T14. Pre-training: the parts are named before they are used.** Knowing what
the components are called frees working memory for the reasoning.
(g = 0.28 and **not significant** in the source corpus, against no
pre-training.)

The `def` block is kept because it is structurally load-bearing for the primer,
the concept hub and the "Before you start" panel, not because it is a large
effect on its own. The primer's *prequestioning* behaviour is a separate and
stronger mechanism, and it is covered by T15 and by M29.

---

## 3b. The practice loop: large effects

This is where the leverage is. Two loops run over different pools, with
different units of state, and they never mix.

| | **Loop A, comprehension** | **Loop B, retention** |
|---|---|---|
| Asks | Can I derive this on the spot? | Do I still hold this in six weeks? |
| Pool | The subsection quiz | The drill bank |
| Unit of state | Subsection, keyed by question `type` | Concept, keyed by concept key |
| Schedule | Section-level, deadline-driven | Concept-level, criterion then spaced |
| Governed by | M5, M9 | M26, M27, M31 |

They connect at one seam and it runs one way: a Loop A failure recruits Loop B
(T18). A Loop B success never marks a Loop A type as covered.

**T15. Retrieval precedes reveal.** An answer is never visible before an attempt
is possible. Showing the answer alongside the question converts retrieval into
re-reading and discards the effect. (Practice testing: g = 0.51 against restudy,
g = 0.93 against no activity; Adesope et al. 2017, *RER*, 272 effects.)

This governs every source of an answer, not only the page's own reveal. See
T38.

**T16. Interleaved practice mixes confusable items.** Mixed practice must be
reachable, and what it mixes is items a reader actually confuses, declared as
confusability clusters rather than assembled from arbitrary topics.
(Overall g = 0.42 against blocked practice; Brunmair & Richter 2019,
*Psychological Bulletin*, 59 studies, 238 effects.)

The scope is part of the rule. The effect is moderated by between-category
similarity: g = .67 for high-similarity discriminations, g = .21 and not
significant for expository text, g = −.39 for words. Blocking can beat
interleaving when categories are already easy to tell apart, because then the
work is finding what one category's members share. Mixing unrelated topics is
not a weaker version of interleaving; it is outside the conditions where the
effect was found.

**T17. Spaced review is scheduled by outcome and bounded by the calendar.**
Missed items return sooner, mastered items return later, and the interval the
outcome produces is then clamped by two calendar facts: the criterion in T31
requires distinct dates, and no interval may step over a declared exam date.
(Spaced retrieval: g = 0.74 against massed retrieval; Latimier et al. 2021,
*Educational Psychology Review*.)

Do not hand-build expanding intervals. The same meta-analysis found no
advantage for expanding over uniform spacing (g = 0.034). A model that fits
stability from the review log expands where the data warrants it and nowhere
else.

**T31. Loop B retrieval runs to a criterion, then relearns across days.** Three
correct recalls on three *distinct* items, then at least three relearning
sessions on three distinct dates. Scheduling by outcome is necessary and not
sufficient: without a criterion a concept counts as known after one lucky
answer. (Successive relearning: d = 1.52–4.19 against single-session learning,
Rawson & Dunlosky 2013; recalling once in each of three spaced sessions beat
three correct recalls in one session by more than 2x, Rawson et al. 2018.)

Three is a ceiling to respect, not a floor to beat. Rawson & Dunlosky (2011)
crossed criteria of one to five recalls with one to five relearning sessions and
prescribe exactly this schedule, and Vaughn, Dunlosky & Rawson (2016) found the
benefit of a higher initial criterion washing out once relearning happens.

Note the control condition: those large d values are against single-session
learning, which is a weak comparison. The prescription is what carries, and it
is stable across a dozen studies.

**T32. Retrieval is elaborated: the reader states a reason before the reveal,
and that reason returns at the next encounter.** A correct answer for a wrong
reason and a correct answer for a sound reason are otherwise the same row in
state. (Prompted self-explanation: g = 0.55 against no prompt, Bisra et al.
2018, *EPR*, 69 effects. Elaborated retrieval adds d = 0.23 to *transfer* over
plain retrieval, Pan & Rickard 2018, *Psychological Bulletin*.)

Skipping is one click, and the skip is recorded, because a skipped reason is the
reader opting out of the largest transfer moderator the site has.

**T18. The reader's confidence is captured before the answer is shown, the gap
is surfaced, and a confident miss is re-tested in the same session.** Fluency
while reading is recognition, not recall, and learners systematically
overestimate it. The site must be able to tell the reader where they were
confident *and wrong*: that number is the product's single most useful output.

Surfacing the gap is diagnosis. The treatment is the re-test. High-confidence
errors are corrected more readily than low-confidence ones after feedback (the
hypercorrection effect, Butterfield & Metcalfe 2001), but at a delay they tend
to **return** unless a test follows the corrective feedback immediately. So a
confident miss draws a second item for the same concept from the drill bank
before the session ends, and that concept is scheduled short. Feedback alone
does not hold.

The re-test comes from the drill bank, never from the quiz, because M5 forbids
a second item of the same type in a subsection.

**T35. Every response is logged with the scheduler's predicted retrievability
before the answer.** The reader's confidence (T18) and the model's predicted
retrievability are different quantities and are recorded separately. Storing
both against the same outcome makes the log a calibration dataset twice over:
it measures the reader's metacognition and the scheduler's honesty on this
reader's data, which no published benchmark can do.

Without the log, every claim in §3b is an argument from literature rather than a
measurement, which is the condition T24 exists to prevent.

---

## 4. Architecture

**T19. Adding a subject requires no code.** Every renderable thing is a
registered component driven by data. A new course is a folder of data files.

**T20. Derived data is never hand-maintained.** Cross-references, prerequisite
lists, "used later in", the concept hub's usage lists, the dependency map, the
search index, `materials/problems.md` and `materials/checklist.md` are all
computed from the content or from learner state. A hand-kept index drifts; a
derived one cannot.

**T21. Generated output is never edited.** `index.html` is a build artefact, and
so is anything T20 names. The source is `src/`, `tools/` and `courses/`.

**T22. One responsibility per file.** A stylesheet covers one UI element; a
module covers one job. Findability is the property being protected.

**T23. The page runs with no runtime dependency.** No server, no network, no
install. A study tool that only works online is unavailable exactly when a
student is revising on a train.

Opening from `file://` is the canonical delivery. Anything that requires a
secure context, a server or a model is progressive enhancement and is governed
by T36.

**T24. Every claim the project makes about itself is enforced by a gate.**
`npm run check` builds, validates content invariants, runs browser tests,
sweeps contrast, renders the spine alone, and proves a new course can be created
from data alone. A claim without a gate is an assumption with a good reputation.

This binds the claims in §3b as much as the claims about the artefact. "The
review loop works" is checkable only against T35's log.

**T30. Content that can be rendered at build time is not rendered at read
time.** Equations, figures and highlighting are derived from data that cannot
change between page loads, so deriving them once in the build is strictly
better: the reader downloads no renderer, and anything that will not compile
fails a build instead of appearing as an error on a page someone is revising
from. Read-time work is reserved for what depends on the reader: progress,
notes, theme, search, scheduling.

**Build-time output is still allowed to be compact.** Rendering once does not
oblige the build to emit the same fragment a thousand times, and reassembling a
payload at boot is not read-time rendering — no renderer ships, nothing can
fail on the page, and the result is byte-identical to what would have been
inlined. The test is whether the reader's browser could produce a *different*
answer than the build did; if it cannot, the work is not read-time work.

**T34. A generated claim names its source or renders as unverified.**
`validate.mjs` checks structure and never truth. A confident, well-formatted,
wrong explanation fails no structural gate, and the reader cannot tell, because
everything else on the page has been verified to a high standard. `npm run
audit` measures four fractions per course — claims with no source, answers with
no re-derivation date, questions with no `why_prompt`, questions that resolve to
no concept — and fails a course above the ceiling that course declares. Content
a model drafted counts as unverified until a human sets a real source (M30).

**The ceiling is per course and declared in `course.yaml`, not global.** These
fractions are content debt that lands course by course, so a global ceiling
could only ever be the worst course's, which gates nothing. A declared one is a
ratchet: a course that finishes a pass records the number it reached and can
never regress past it. An undeclared ceiling means 1, meaning reported and
ungated, and a course sitting there is debt rather than a satisfied rule.

**T25. A rule that can be checked mechanically must be.** Human discipline
fails silently; a failing build does not.

The clearest example is the duplicate-selector lint. Four defects came from one
shape: a correction appended below an existing rule in the same stylesheet,
silently winning while the original became dead code. It is invisible on
review, obvious to a twenty-line script, and it recurred three times before
anything checked for it.

`tools/lint-css.mjs` now also gates the mirror shape: a rule that silently
*loses*. A `var()` naming a token nothing declares is invalid at computed-value
time, so the browser discards the whole declaration — and, in a shorthand, the
rest of it too. Five were live at once in the library and sync panels:
`var(--serif)` for `--sans` voided two `font` shorthands, so 14px captions
rendered at 17px; `var(--accent)` for `--focus` voided an `outline`, so a focus
ring disappeared under T6; and `var(--warn, #b91c1c)` painted a hardcoded red
outside the palette that measured 2.87:1 on the dark ground — a T1 failure and
a T3 one at once. The fallback is why the last of these was the only one the
contrast sweep could see: the other four changed geometry, not colour, and T2
walks text.

**A mechanical rule whose gate does not exist yet is a build defect, not a
weaker rule.** T25 obliges the gate; it does not license violating the rule
while the gate is missing, and it does not make the rule untrue. The debt is
tracked in [Unbuilt gates](#unbuilt-gates) so that "we check that" and "we
intend to check that" are never the same sentence. A rule that *cannot* be
checked mechanically is outside T25 entirely and is marked as author judgement
where it appears.

---

## 5. Models and outside help

These hold whether the model is one the site calls, one the browser provides, or
one the reader opens in another tab.

**T36. No AI output is load-bearing.** Every AI-adjacent feature degrades to the
site's non-AI behaviour, and the whole suite passes with no model present. The
site currently ships no model at read time at all, which is the strongest form
of this. If one is ever added, its prompts are gated like stylesheets: a fixture
set with an expected-output threshold, re-run on every browser stable release,
because the model updates underneath a build that has not changed (T25).

**T37. A model is never asked to supply a fact.** Anything handed to a model is
assembled from named course fields; the model compares, classifies or rephrases.
Extended to the browser's own assistant: the context record in `<head>` is
assembled from course data, never from page text.

**T38. AI never precedes an attempt.** No pointer to outside help is reachable
in a quiz or drill before the reader commits, and no unattempted answer is put
anywhere something else could read it, including the context record T37
describes.

This is T15 applied to a second answer source, and it is the one with a measured
cost. In a randomised field experiment with nearly 1,000 students, an
unrestricted assistant available during practice raised assisted practice
performance by 48% and lowered unassisted exam performance by 17% against
control; a safeguarded tutor removed the harm and did not produce a gain
(Bastani et al. 2025, *PNAS*). Students' own reports of the effect were
optimistic while their exams were down.

**T40. The reader owns the grade.** Any model judgement of the reader's work is
advisory, dismissible, and recorded as advisory. It never sets a state the
reader owns and never overrides a self-assessment.

The harm in the results above arrives through offloaded monitoring, not through
offloaded work: learners given an assistant improved task scores while knowledge
gain and transfer did not differ, and their self-regulation traces moved away
from monitoring and evaluation (Fan et al. 2025, *BJET*). A design that hands
the monitoring to a model reproduces the mechanism it was built to avoid, and it
degrades T18, which is the site's most useful output.

**T39. Nothing the reader wrote leaves the device unsealed, and for a reader who
has set nothing up, nothing leaves at all.** Explanations, notes, confidence,
the outcome log and the calibration report are computed in the page and stored
in the browser. Export is reader-initiated and explicit. Where the browser's own
assistant can see them, that is stated once rather than hidden.

The site's own backup is the one thing that crosses the wire, and it is the
owner's alone: it runs only where a secret has been entered, so every other
reader makes no request and has no account. What it sends is AES-GCM ciphertext
sealed in the page under a key derived from that secret — the backend can store
the log and the courses without being able to read either. Metadata is the
honest exception and is named rather than glossed: row ids, device ids,
timestamps and sizes are visible to it, and `PrivacyNote.jsx` says so on the
page where the data itself is shown.

---

## Unbuilt gates

T25 obliges every mechanical rule to have a gate. These rules are correct and
currently unenforced, or enforced only in part. Each is a build task, not an
open question, and each belongs in `npm run check` or `npm run audit`.

| Rule | What is missing | Where |
|---|---|---|
| M34 | The structural half is gated (`core:` and `gist:` are mutually exclusive; a `core:` may not reopen its own `h:`). The *fractions* — claims declaring neither, and claims taking the `gist:` escape — are measured by `npm run audit` against a per-course ceiling that every existing course leaves at the default of 1, so they are debt rather than a satisfied rule. | `courses/*/course.yaml` |
| M36 | A block yielding no name is reported, not failed, because four courses predate the rule and every one of their `p` blocks would trip it. It becomes a gate when a course declares a ceiling. | the row above |
| M25 | The citation graph is checked: a reviewed concept whose every `<c k>` mention sits outside the spine warns. Actual *coverage* is not, because a concept's definition site is prose (`src: Defined in §10.1`) and no field names it. Making the site a real id would turn the warning into a failure. | `validate.mjs`, `concepts/<key>.yaml` schema |
| T34 | The audit ceiling exists and is per course, but only `demo` declares one. Five courses sit at the default of 1 — reported, ungated — so their fractions are debt rather than a satisfied rule. | `courses/*/course.yaml` |
| M6, M22 | `why_prompt`, `verified:` and concept routing are measured, not failed, for the same reason: four courses predate all three. They become gates the moment those courses declare a ceiling. | the row above |

M32 ("a surface unlike the worked example") is author judgement and is not on
this list. No script can tell whether two stems are meaningfully different.

**Gates built since this table was first written**, listed so that "we check
that" and "we intend to check that" stay different sentences: M31 both ways (a
reviewed concept owes a drill file; a drill file whose concept is not marked
warns; a non-empty review set with no `review.basis` fails), M30/T34
(`source: generated` counts against the unsourced fraction and renders as its
own badge), M6 (a `concept:` naming no concept file fails), M33 (a `key` block
stating a value in a reviewed concept with no cued-recall item warns), and the
scaffold (`_template` now carries tiers, `drills/`, a primer, `why_prompt`,
`source:`, `review:` and `verified:`, so `npm run new` no longer contradicts
`create_course.md`).

## Trade-offs

Real decisions with defensible answers on both sides. These are **not** truths,
and changing them is a design choice rather than a regression.

### Tiering itself

That the spine must stand alone is T33 and is not negotiable. Whether a course
should carry `depth` and `apply` tiers at all is a preference, because no
meta-analysis tests opt-in collapsed detail against a single-density
alternative. The coherence evidence covers material the learner cannot avoid,
and extending it to material the learner chose to open is an inference, not a
finding.

A course that ships spine-only is correct. A course that tiers is also correct,
provided T33 and M25 hold.

### Feedback timing, genuinely contested

The evidence does not settle immediate versus delayed feedback. Meta-analyses
disagree: some find delayed superior (it adds a spacing interval and a second
retrieval attempt), others find immediate superior, and one large review found
immediate better in classrooms while delayed won in laboratories. Task
difficulty appears to interact with it.

**Therefore reveal-on-demand is a defensible default, not a truth.** Do not
"fix" it toward either pole and claim evidence.

T18's re-test rule is not an exception to this. It is a rule about what follows
a *confident error* specifically, where the evidence concerns error return
rather than timing preference.

### Scaffolding level, reverses with expertise

Worked examples reduce extraneous load for novices facing high element
interactivity, and this is well established. But the effect **shrinks, vanishes,
and eventually reverses** as expertise grows: for a learner who already has the
schema, problem solving beats studying examples. Kalyuga's review across 26
studies found effect-size differences of d = 0.45 to 2.99 between low and high
prior-knowledge learners given the same instructional support.

**Therefore the right amount of worked-example support depends on the reader**,
and a course written for a specific person may legitimately carry less
scaffolding than a general one. This is why the calibration in
`material_truth.md` M3 is required rather than optional.

### Framework and rendering

Preact is the current choice, justified by ecosystem and familiarity for future
work. Vanilla, Svelte or Solid would all satisfy every truth above. Rendering
content blocks as HTML strings rather than components is likewise a choice: it
keeps the extension point trivial, and it would still be correct to change it.

### Delivery format

One self-contained file preserves offline double-click. Splitting assets would
reduce page weight and require a server. Both satisfy T23 only under different
assumptions about where the file is opened.

### Palette hue and typeface

Any palette and any faces are acceptable **provided T1–T4, T7–T8 and T26–T27
hold**. The logic-level colour semantics in ECE 27000 are a good idea, not a
rule.

Per-course accent rotation (`theme.hue`) is in the same category. Whether six
courses should look different at all is a preference; that a course which does
rotate must still clear T1 is not, and the gate settles it either way. Rotating
only the accents, and leaving ground, ink and rules global, is also a choice:
it keeps the page from moving out from under a reader who switches courses.

### State

Learner state unlocks T17, T18, T31, T32 and T35. A course may still disable it
and remain correct; it simply cannot claim those five properties, and it has no
Loop B.

### Page weight

770KB today. Acceptable from disk, questionable over a network. This is a
constraint to watch, not a threshold anyone has established.

### Sidebar, density, and chrome

Whether navigation is collapsible, how dense the type is, and how much chrome
shows are preference. **What is not preference:** moving the margin references
away from their mention (T12) to achieve it. Collapsing a tier in place is a
different act and is permitted.

How many beats the spacing scale has, and which block gets which, is likewise
preference. That the scale exists at all is closer to T13 than to taste: if
every block has the same margin, spacing encodes nothing, and a distinction
that is technically present but invisible does not satisfy signaling.