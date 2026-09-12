# Creating a course

How to fill in `courses/<id>/` so the site renders a complete, research-backed
study course. **You write data only.** There is no code to add.

> **You are a model.** This is a procedure with tests, not advice with
> examples. Read §0, §1 and §2 before writing anything; read a block type's
> section before you write that block type.

Every rule here is the *how* of a rule in [`material_truth.md`](material_truth.md)
(content) or [`code_truth.md`](code_truth.md) (engine). The id in brackets is
where the evidence lives. Do not re-derive it here and do not argue with it;
if a rule seems wrong, read its entry, then follow it.

```sh
npm run new -- <id> "Course Title"   # scaffold courses/<id>/
npm run check                        # build + validate + browser tests
npm run audit                        # sourcing, verification, routing, drill health
npm run shots                        # render every page to .shots/ and look at it
```

---

## 0. Operating rules

**0.1 What a finished course must do.** A reader who holds the prerequisites in
§1 and nothing else, having read the spine and cleared the drill bank, can
(a) state every idea in the course, (b) apply it to a problem they have never
seen, (c) say why each rule holds and where it stops holding, and (d) construct
something the course never showed them: a case the rules do not settle, or a
claim about the material with an argument behind it. (d) is the one that gets
dropped, and it is what separates a course from a reference.

**0.2 The three rules everything serves.**

| | Rule | Source |
|---|---|---|
| **Non-redundancy** | Every piece of *explanation* appears exactly once. | [M1] |
| **Closure** | Nothing is used that is not either a declared prerequisite or defined earlier in this course. | [M2] |
| **Derivability** | Every rule is reached, not asserted. A reader can see where it comes from. | §6.2, §6.3 |

Non-redundancy and closure pull against each other, and the reference system is
how they coexist: you can be complete without repeating, because the reader can
always reach the definition. Non-redundancy governs *explanation*, not
*practice*. A second application is not a second copy, which is why the drill
bank exists.

**0.3 Follow §3's phases in order.** Depth is a function of the reader, so a
section written before the calibration exists is calibrated to nobody.

**0.4 Every rule here has a yes/no test.** If you are weighing a judgement, you
have missed the test. Where a real judgement remains, §1 breaks the tie.

**0.5 Do not guess. Fail loudly.** Unknown topic order, exam format, or truth of
a claim → write `unverified` (a human should look it up) or `generated` (a model
wrote it; a human should check whether it is even true), or leave the field
empty with a note naming where the answer lives. A flagged gap is a task; a gap
filled from memory is a defect nobody will find. [M20, M21, M28, M30]

**0.6 Budgets are numbers.** Where this file gives a count, hit it. Where it
gives a range, land inside it.

**0.7 Run §12 before you emit.** It is two lists. The first is gated by a
script; checking it yourself costs one pass instead of a round trip. The second
cannot be gated by anything, and you are the only check on it.

**0.8 Your default voice is wrong for this.** Left alone you write balanced,
hedged, encyclopedic prose that covers a topic. That is a document. §14 lists
the shapes that produces; §13 is the sentence itself, which is where a reader
decides whether a person wrote this. Read both before your first `p` block.

---

## 1. The reader

This section is data, filled in for the person a course is written for.

**The filled-in copy lives in `courses/_reader.yaml`**, gitignored beside the
courses it calibrates, because a learner profile is personal and this file is
tracked. The block below is the blank form. Read the filled-in one before
Phase 1: every default in §1.1 is switched on by a line in it, so a course
written against `UNSET` is calibrated to nobody (0.3), and `author.mjs` refuses
to emit a prompt against one rather than guessing.

```yaml
reader:
  goal: UNSET            # "mastery" (default), or "exam: <what, when>".
                         # §1.2 flips four rules when an exam is named
  background: UNSET      # THE PREREQUISITE SET, enumerated. Anything not on
                         # this list is taught in full (0.2 closure). Say how
                         # firmly each item is held
  failures: UNSET        # which modes below actually go wrong for them
  not_failures: UNSET    # the rest, named rather than left out — §1.1 reads
                         # absence as a switch, so an unlisted mode is a guess
  onboarding: UNSET      # concrete anchor first, or formal statement first
  priorities: UNSET      # ranked; §1.2 resolves ties with this
  session_length: UNSET  # ask before assuming (0.5)
  audience: UNSET        # "this reader" or "median student in the class"
```

`failures` and `not_failures` partition these five. Every mode goes in one list
or the other.

| Mode | What it looks like |
|---|---|
| transfer | novel problems unlike anything practised |
| execution | careless slips inside a procedure they know |
| detail retention | forgetting a specific value or detail |
| schema acquisition | never understood the concept |
| discrimination | knowing the concepts but picking the wrong one |

**`background` is a boundary, not a description.** "Comfortable with maths" is
not a prerequisite set. "Single-variable derivatives and integrals; no linear
algebra; no complex numbers" is. Everything on the list may be used unexplained.
Everything off it is taught. The usual way a course fails 0.2 is a model
reaching for a convenience the list never granted — a matrix, a limit, a piece
of notation — because it was the natural tool. Experts systematically misjudge
which steps a novice already holds (Nathan & Petrosino 2003, *American
Educational Research Journal* 40:905–928, "expert blind spot"), so check the
list, never your sense of what is obvious.

### 1.1 What this profile changes

Seven defaults, each switched on by a line in §1 rather than by style. Read the
switch column against the profile you just wrote; where a switch is off, the
entry inverts rather than disappearing, and the inversion is named.

| | Switched on by | Default | Because |
|---|---|---|---|
| **D1** | schema acquisition is **not** a failure | `apply` stays lean: one or two instances per concept, never four | Worked-example support reverses with expertise, so a reader who holds the schema gains more from solving than from a fourth example [material_truth Trade-offs]. Off: schema acquisition among the failures buys more worked instances, not fewer |
| **D2** | discrimination is **not** a failure | Declare `confusable_with` only where the confusion is real | Interleaving pays on confusable pairs and costs on unrelated ones [T16]. Off: declare it on every pair the reader actually mixes up, and interleave them |
| **D3** | `onboarding` asks for a concrete anchor | Open with a concrete anchor, then fade it | Concrete-first-and-stay-concrete is the worst sequence tested [M10]. Off: the formal statement opens and an instance follows it |
| **D4** | transfer is a failure | `attempt` blocks default ON for conceptual subsections | Problem solving before instruction beats instruction before problem solving on conceptual understanding and transfer, d = 0.36 over 166 comparisons, and the advantage grows from about sixth grade upward (Sinha & Kapur 2021, *Review of Educational Research* 91:761–798) |
| **D5** | transfer is a failure | `why_prompt` on every quiz item, no exceptions | Prompting a learner to explain returns g = 0.55 across 64 reports (Bisra et al. 2018, *Educational Psychology Review* 30:703–725); it is the cheapest lever on transfer [M6, T32] |
| **D6** | execution is a failure | Every procedural subsection carries an execution trap **and** an error-spotting quiz item | Slips in a known procedure are a detection problem, not a comprehension one [material_truth Trade-offs] |
| **D7** | detail retention is a failure | Every specific value gets a drill item | Detail loss is a retention failure at item grain [M33] |

D4 and D5 share a switch and are not redundant: one decides how a subsection
opens, the other what every question asks after it.

### 1.2 Goal and priorities, applied

**Mastery is the default (0.1).** Four rules change when `goal` names an exam.

| | Default: `goal: mastery` | Overlay: `goal: exam: …` |
|---|---|---|
| Section order | Dependency order: nothing is met before what it rests on | The institution's own order, because the reader sits its exams [M15]. Deviate only on a genuine dependency violation, and say why in the blurb |
| `exam.format` (§11.1) | The response formats a mastered reader must be fluent in. Include `derivation` — a reader who can only recall cannot generate | The formats the exam actually uses |
| `exam.dates` | Empty. The scheduler holds at the retention target with no deadline | The real dates, so the schedule aims at them [T17] |
| `review.basis` (§5.1) | What later sections depend on, plus what is error-prone | The above, plus everything the exam can test |

Everything else is identical. Both goals want the same course; the overlay only
changes what it is aimed at.

`priorities` is what breaks a tie no rule settles. The resolutions below are for
a ranking that puts retention first and read speed last; a different ranking
re-derives them.

- `drills/` is **required**. A course with no drill bank has no retention loop.
- `materials/expectations.md` **must** carry `exam.format` and `review.basis`.
  The drill-format check needs a target; the review set needs a record.
- Genuinely ambiguous `spine` vs `depth` → `depth`. Read speed ranks last, so
  available-but-collapsed beats deleted. This does not license decoration.
- Given a choice of where to spend effort, spend it on the drill bank, not on a
  fourth explanatory paragraph.

---

## 2. What you produce

```
courses/<id>/
  course.yaml              identity, theme, state, retention, audit, highlighting
  concepts/<key>.yaml      one file per recurring idea (M13; no cap)
  categories/<key>.yaml    one file per declared category (M35; optional)
  drills/<key>.yaml        one file per *reviewed* concept (M31)
  sections/
    01-<slug>/
      _section.yaml        title, blurb, primer prequestions
      1-<slug>.yaml        one subsection: blocks + quiz
  assets/                  images referenced by image blocks (inlined at build)
  materials/               study artefacts (§11)
  blocks.js                optional; almost never (§15)
```

**Numbering is positional.** Folder `03-…` → section id `s3`; its second file →
`s3-2`. You never write ids. **One subsection per file.** `.yaml`, `.yml` and
`.json` are all accepted.

### 2.1 What you write determines what appears

Nothing in the right column is maintained by hand [T20]. This table is the
whole feature surface: if you want a reader-facing behaviour, it is here.

| What you write | What the reader gets |
|---|---|
| A folder under `sections/` | A section in the sidebar rail and the contents list |
| A file inside it | A subsection with its own heading and quiz |
| `blocks:` entries | The content, one reading row each, filtered by tier |
| `tier: depth` / `tier: apply` | A collapsed stub with a count, expandable in place |
| `core:` on a block | Its **claim**, shown at Notes depth with the rest closed — and the opening line of the block at Full depth |
| `gist:` on a block | Its claim at Notes depth only; the prose stays whole and untouched at Full depth |
| `cat:` on a block or concept | A **chip** at Notes depth, a row on that **category's page**, and a facet in **Explore** |
| `tags:` on a block or concept | A facet in **Explore** and a chip that links to everything sharing the tag |
| `categories/<key>.yaml` | A page at **`#/<id>/cat/<key>`** listing every member wherever it sits, with the boundary and its siblings |
| `siblings:` in a category | A "not to be confused with" comparison strip on both pages |
| `id:` on a `table` | An auto-numbered, citable **"Table 3.1"**, reachable by `<f k="…"/>` exactly as a figure is |
| A `def` block with `term:` | An entry in the **"Before you start"** panel |
| `<a href="#s4-2">§4.2</a>` | A **margin card**, a **return pill**, a **"Builds on" chip**, a **dependency-map edge**, and a **"used later in"** card on §4.2 |
| `<c k="key">phrase</c>` | A **margin card**, a **concept hub** entry, a line in that concept's **"appears in"** list |
| `<a href="#/other-course/s6-1">…</a>` | A plain link into **another course** |
| `<f k="fig-id"/>` | An auto-numbered, section-scoped **figure citation** |
| `<m>…</m>` | Inline maths, rendered at read time |
| A `quiz:` entry | A click-to-reveal question, a **type badge**, a slot in **coverage** |
| A `drills/<key>.yaml` item | A slot in **`#/review`**, criterion tracking, mixed practice |
| `primer:` in `_section.yaml` | A **relation prequestion** with forced correction at `#/<id>/primer/<section>` |
| `why_prompt:` + the reader's confidence | The **calibration report** at `#/<id>/calibration`: the confident-and-wrong list |
| `confusable_with:` | A cluster in **mixed practice** at `#/<id>/practice` |
| `review: true` | The concept enters **Loop B**: criterion tracking, spaced relearning, the review queue |
| Any `<a href="#s…">` or `<c k>` | An edge and a node on the **dependency map** at `#/<id>/map` |
| Every block's text | An entry in the **search index** |
| `t: figure` | A rendered diagram, plot, chart, grid or timing trace (§10.1) |
| `retention.target` in `course.yaml` | How hard the schedule holds the course (§4) |
| `state.enabled: false` | A stateless reference: no quiz history, no review loop |
| *(nothing — automatic)* | The "Before you start" panel, the stepped primer, the reader's note field, cross-course review at `#/review`, `problems.md`, `checklist.md`, import/export, sync |

---

## 3. The procedure

Execute in order. Do not start a phase until the previous stop condition holds.

**Phase 1 — Calibrate.** Write `materials/expectations.md`, front matter first
(§11.1). State what is assumed known (the §1 `background` list, verbatim),
bridged, taught in full, and deliberately skipped.
*Stop: every topic appears in exactly one of skip / bridge / teach, and
`review.basis` says on what grounds the review set will be chosen.*

**Phase 2 — Sequence.** Lay out `sections/NN-slug/` with `_section.yaml` titles
and blurbs only. Order is dependency order by default; the institution's order
where `goal` names its exam (§1.2). Sections run 2–5 subsections; the blurb
answers "why here?".
*Stop: no forward reference exists that is not moved earlier or promoted [M14].
Reading the section titles in order, every section rests only on sections above
it and on the `background` list.*

**Phase 3 — Concepts and the review set.** Write `concepts/<key>.yaml` for every
idea used in three or more places (§5), then mark the subset that must survive
the semester `review: true`.
*Stop: every idea you would re-explain in three sections has a concept file, and
the review set matches its declared basis.*

**Phase 3a — Taxonomy.** Write `categories/<key>.yaml` for the kinds of thing
this course will sort its material into (§5a). It comes before the spine, not
after, because a block can only tag into a taxonomy that already exists — and a
taxonomy derived after the fact fragments, with `invoke-labels` invented beside
an existing `invocation-labels`. A textbook's own structure is usually most of
the answer.
*Stop: every category has a boundary naming what falls outside it, siblings name
each other, and you can say for each one which blocks will join it. Skip the
phase entirely if the material has no such kinds — an empty taxonomy is a
correct answer and an invented one is not.*

**Phase 4 — Spine.** Write spine blocks only, across every subsection. That
means writing no `tier:` at all, since spine is the default. Every `def`, `key`
and `trap` declares its claim as `core:` (or, where the prose must withhold it,
`gist:` — §6.6), and joins a category where it belongs to one.
*Stop: the spine alone teaches the whole course. If a spine block needs
something you have not written, that thing is spine, not depth. Reading only the
`core:` lines of a section, in order, gives a correct — if terse — account of
it.*

**Phase 5 — Quizzes.** One item per distinct question type per subsection (§7),
plus the section's synthesis item where §7.1 requires one.
*Stop: full type coverage everywhere, an error-spotting item in every procedural
subsection, and every item carries `why_prompt`, a resolvable `concept:` and a
`verified:` date.*

**Phase 6 — Drills.** `drills/<key>.yaml` for every concept marked
`review: true`: three items, two formats, one exam-format match (§8). Concepts
outside the review set carry no drill file and no obligation.
*Stop: every specific value in a reviewed concept's `key` blocks has a matching
item (D7, M33).*

**Phase 7 — Depth and apply.** Now add `tier: depth` and `tier: apply`. Last,
deliberately: written earlier, spine content leaks into collapsed tiers because
material that belongs in the argument gets absorbed into an interesting
digression while you are in the mood to write digressions. Every `key` rule
whose derivation did not fit in the spine gets its derivation here (§6.3).
*Stop: `npm run check` passes the spine-only render.*

**Phase 8 — Verify.** Re-derive every worked answer and every drill solution.
Re-reading is not verifying [M22]. Set `verified:` dates. Run §12, then
`npm run check` and `npm run audit`.

---

## 4. `course.yaml`

```yaml
code: PHYS 201                   # short identifier, shown in the sidebar
title: Oscillations and Waves
tagline: One sentence: what this covers, in what order.
meta: Source or textbook          # provenance line under the title

theme:
  hue: 200                       # optional: accent rotation, degrees (0-359)
state:
  enabled: true                  # false = stateless reference, no review loop
retention:
  target: 0.9                    # optional: recall probability the schedule holds
audit:                           # optional: fail ceilings for `npm run audit`
  unsourced: 0.1                 # absent means 1, meaning report only
  unverified: 0
  unprompted: 0
  unrouted: 0
valueStyles:                     # optional: colour cell values in mono tables
                                 # and in `grid` figures
  "1": b1
styles: |                        # optional: CSS for the classes above
  .b1{color:var(--hi-ink);font-weight:700}
syntax:                          # optional: highlighting for `code` blocks
  comment: "//"
  keywords: [def, class, return]
  strings: true
  patterns:                      # optional: what the three above cannot catch
    - {re: "\\b0x[0-9a-fA-F]+", cls: tok-n}
```

Only the first four fields are required.

`theme.hue` rotates the four palette accents; lightness and chroma stay fixed, so
contrast holds at any angle [T1, T3]. It must be unique across courses, or two
courses are indistinguishable in the library; `npm run new` picks the free angle
furthest from every taken one. A `trap` block's warning colour never rotates: a
warning is not a course's identity [T27].

`code` must also be unique. Learner state is keyed on it, so two courses sharing
one share a reader's quiz history and review schedule, silently.

`retention.target` is the recall probability the scheduler holds a concept at;
it defaults to 0.9. Lower it for a course whose material is background rather
than load-bearing. `retention.deadlines` is filled from `exam.dates` and is not
written here.

**`audit:` is a ratchet.** Each key is the fraction of that population the
course tolerates before `npm run audit` fails it. Lower one as its pass lands,
and the course can never regress past what it reached.

**Do not set `state.enabled: false`** where retention ranks in `priorities`.
It gives up the review loop (§1.2).

---

## 5. Concepts — `concepts/<key>.yaml`

```yaml
term: Two's complement
body: |-
  <p>The signed encoding used by essentially all real hardware…</p>
src: Defined in §10.1
review: true                           # in the review set; owes a drill file
confusable_with: [sign-magnitude]      # only where readers actually confuse them
```

The filename is the key: `twos-complement.yaml` → `<c k="twos-complement">`.
(A `key:` field inside the file overrides that; use it only to rename a concept
without breaking links, then rename the file and remove it.)

**Test for a concept:** would a reader who forgot this need it re-explained in
three different sections? Yes → concept. No → `def` [M13].

A mention is a link, not decorated text. Wrap the words the sentence already
uses — `the <c k="impedance">impedance</c> of the branch` — never drop a bare
term in for the sake of the link.

**Never write "recall from §3 that…" followed by a restatement.** That is
non-redundancy violated in the one place it is most tempting. The link renders a
margin card, feeds the prerequisite list and draws a dependency edge: one
action, three benefits, no duplication [M16].

### 5.1 Promotion and review are two decisions

| Decision | Rule | Cost | Cap |
|---|---|---|---|
| Promote to a concept | used in 3+ places [M13] | one file, one link | none |
| Mark `review: true` | declared, not inferred [M31] | three drill items [M26] | your judgement |

Promotion is forced by non-redundancy. Review is a scope choice: nothing says
every recurring idea must be scheduled, only what the *shape* of scheduling is
once you choose it. Choose the review set from `review.basis` (§1.2) and record
that basis in `expectations.md`.

The build enforces both halves: `review: true` with no `drills/<key>.yaml`
fails, a drill file whose concept is not marked warns, and a non-empty review
set with no declared basis fails. `confusable_with` must be declared on both
sides (D2).

---

## 5a. Categories — `categories/<key>.yaml`

A category is the answer to *what kind of thing is this, and what is it not*.
It is the only grouping in the system that is neither positional (a section),
argumentative (a tier) nor referential (a concept mention), and it is the one a
reader still has after they have forgotten where they read something.

```yaml
name: Invoke labels
short: IL                    # 2-3 chars, the recognisable key. Optional.
boundary: |-
  The labels a dispatcher attaches to an inbound call. Not response labels,
  which are attached on the way out, and not lifecycle labels, which describe
  the request rather than its routing.
siblings: [response-labels]  # must name each other
note: |-                     # optional; HTML, rendered above the members
  <p>All eleven are assigned by the router, never by the caller.</p>
```

Membership is declared on the thing, not in the category file:

```yaml
- t: table
  id: dispatch-paths
  cap: The four dispatch paths
  cat: invoke-labels          # the principal tag: one, and it must be declared
  tags: [routing, dispatch]   # secondary, plural, slugs
```

**A label is not a category, and neither replaces the other.** A `label:` names
*one block* — cardinality one to one, local, and it answers "what is this?". A
`cat:` names *a set* — cardinality one to many, course-wide, and it answers
"what are all the X, and which are not?". If a category would only ever have
one member, it is a label and should stay one.

**`cat:` versus `tags:`.** The category is the principal tag: the single kind a
thing most is. Tags are every other shelf it could sit on. The category gets a
page, a boundary and siblings; tags get a facet in Explore and nothing else,
because discovery wants many routes in and categorisation wants one answer.

**`boundary:` is required and is the point.** Without it a category file is a
label that has been given a page. Say what is in, and name what is nearby and
out — that sentence is what a reader is actually learning when they learn a
category.

**Rules.**
- Every `cat:` must name a `categories/` file. The build fails otherwise; a
  category is declared, never inferred (M35).
- Every category needs at least one member. An empty one renders an empty page.
- `siblings:` must name each other. A contrast drawn one way is half a contrast.
- Tags are slugs — lowercase, digits, single hyphens — so one tag cannot index
  twice under two spellings.
- Categories go on **blocks and concepts only**. A drill item inherits its
  concept's category; a quiz item has none, because `type` is already its
  identity (M9).
- Do not categorise everything. A chip on every block is a chip that signals
  nothing (T13).

---

## 6. Sections and subsections

`_section.yaml`:

```yaml
title: Function Minimisation with Karnaugh Maps
blurb: >-
  Two or three sentences: what this section is for, and why it comes here
  rather than earlier.
primer:                          # §9
  - ask: …
    answer: …
    why: |-
      <p>…</p>
```

`N-<slug>.yaml`:

```yaml
title: Grouping, implicants, and minimum SOP
blocks:
  - t: p
    h: |-
      Prose. Write HTML directly; inside a literal block nothing is escaped.
quiz:
  - type: Minimise SOP
    …
```

Both files accept `id:` and `num:` overrides. Do not write them; positional
numbering is what keeps ids stable and unique.

### 6.1 Block types

| `t:` | Use for | Key fields |
|---|---|---|
| `p` | Ordinary prose | `h` |
| `def` | A term being defined | `term`, `h` |
| `key` | A rule to remember | `h` |
| `trap` | The mistake people actually make | `h` |
| `ex` | A worked example, usually `<ol>` steps | `title`, `h` |
| `note` | An aside that is not examinable (always `depth`) | `h` |
| `list` | A bare list | `items`, `ordered` |
| `table` | Any table | `cap`, `head`, `rows`, `split`, `mono`, `map` |
| `code` | Source listings, highlighted per `syntax` | `lang`, `src` |
| `math` | A standalone equation | `tex`, `label`, `note` |
| `figure` | Anything describable as data (§10.1) | `kind`, `cap`, `spec`, `id` |
| `image` | A photograph, scan or supplied diagram | `src`, `alt`, `cap`, `credit`, `width`, `id` |
| `attempt` | A problem the reader cannot yet solve, **first block only** | `h`, `label` |

Every block also takes `tier:`, `label:`, `cat:`, `tags:` and `notes:` (§6.6);
`def`, `key` and `trap` take `source:` and one of `core:`/`gist:` (§6.6). `table` and `image`
take `id:`, which makes them citable and numbered exactly as a `figure` is.

On `table`: `mono: true` gives fixed-width centred cells and applies the
course's `valueStyles`, so a truth table needs no special block type. `map:`
does the same with an inline `{value: css-class}` map instead. `split: N` draws
a rule after column N, separating inputs from outputs.

**A `label:` names the block; it does not explain it.** A word, or a short
phrase where the phrase is the name of the thing — "Common slip", "The cut
property". If it runs to a sentence, that sentence is the block's first line and
belongs in `h` — or, now, in `core:`.

The engine counts: past four words a label is set in the reading face at reading
size rather than as a small mono chip, because T41's test ("if you would read it
aloud as a sentence, it is not a label") is mechanical once you are willing to
count words. That is a fallback, not a licence — a five-word label still reads
better as a name.

**An `ex` block's `title:` names what is worked, not how you worked it.** A noun
phrase for the thing itself: "Overflow in a 4-bit sum", "The screening numbers
through the rule". A title describing your treatment of the material — "counted
out", "step by step", "revisited", "in detail" — is a caption on steps the
reader is already looking at, and it reads as a fragment because it is one.

**Two fields default, so write them only when they carry information.**
`tier:` defaults to `spine` — an absent tier *is* the declaration of it [M23] —
so write it only for `depth` and `apply`. `label:` defaults to the callout's own
name ("Definition", "Key rule", "Common mistake", "Worked example", "Note"), so
write it only to override one. Repeating a default is a line you pay for on
every write and every re-read, and it buys nothing.

**Never write the interface's own words.** Every block renders a frame you did
not author: a callout prints its label, a figure prints its number, a collapsed
tier prints its count, an `attempt` prints a text box, a submit button, and a
line telling the reader the section teaches this next. Text repeating any of it
is redundant against the engine rather than against other prose, which is the
one kind of repetition M1 cannot see and no gate will catch. So an `attempt`
poses the problem and stops. It does not ask for an answer, tell the reader to
record one, or promise what comes after. Before writing a sentence that tells
the reader what to do on the page, check §2.1 for whether the page already
does it.

**`source:` belongs on every `def`, `key` and `trap`** — those three carry the
conclusions a reader cannot catch by reading around them, they are the three
that render the badge, and they are the population `npm run audit` measures.
An absent `source:` counts against the fraction exactly as an ungrounded one
does. **It has exactly three legal shapes.**

| Value | Meaning | Counts as |
|---|---|---|
| `"Griffiths §2.3"` | A real, checkable origin | verified |
| `unverified` | You could not ground it and you are saying so | unverified |
| `generated` | You wrote it and could not ground it [M30] | unverified |

Use `generated` on any `def`, `key` or `trap` you drafted without a source in
front of you. It renders as a badge and counts against the unsourced fraction,
which is what stops a model-written course passing the audit at zero percent.

**Use `def` for every term you name.** It is the only block that feeds the
pre-training panel, and a term introduced in a `p` block is invisible to it
[M8, T14]. It is also how closure (0.2) is checked: a term with no `def` and no
line in `background` is assumed knowledge.

### 6.2 Order inside a subsection

```
<opener>   exactly one, first block only — or none
def        the abstract statement, retiring the opener explicitly
key        the rule that makes it usable, and where it comes from
ex         one worked example, fully stepped
figure     the artefact that makes it concrete
trap       what goes wrong, named as a specific slip
```

Definition before example before exception. Never lead with a qualification
[M10].

**One block may precede the `def`, and only one** — a concrete anchor (`p`,
the D3 default) *or* an `attempt` (D4). Never both; an `attempt` *is* the
anchor. This is what a concrete anchor looks like, from a textbook that does it
on its first page:

> "You type an expression, and the interpreter responds by displaying the result
> of its evaluating that expression. One kind of primitive expression you might
> type is a number."
> — Abelson & Sussman, *Structure and Interpretation of Computer Programs* §1.1,
> [sarabander.github.io/sicp](https://sarabander.github.io/sicp/html/1_002e1.xhtml)

Second person, one concrete act, and the general term ("primitive expression")
arrives only after the reader has seen an instance of it.

**The `def` states the term and nothing else.** A definition is what the reader
returns to in week six, and what the margin card shows on a page far from this
one (§5), so it has to read cold. No numbers borrowed from the anchor, no "as we
saw above", no reference to what the `attempt` asked. A definition that needs
the example beside it is a definition that has not been written yet.

**The block after it retires the opener.** One or two sentences, in the `p` or
the `key` that follows: generalise the anchor and name it a special case, or say
what the `attempt` was reaching for. That block may lean on the example freely,
because nothing returns to it. The retirement is the mechanism rather than a
courtesy. An unretired anchor leaves the reader holding an instance where they
need a schema, which is the transfer failure in §1. **The anchor also names
where it breaks**, in one sentence: "this stops being a good picture once X."

**Every `key` rule is derived, not announced** (0.2). The reader must be able to
see where the rule comes from, using only what they have already read. Three
legal shapes, in order of preference:

1. The derivation is one or two sentences and lives in the `key` block itself.
2. It is longer, and the `ex` block that follows walks the general case before
   the numeric one.
3. It is longer still, and it lives in a `depth` block in the same subsection
   which the `key` block links to (§6.3).

The exception is a rule that is *given* rather than derived: an axiom, a
convention, a defined unit, a measured constant, an institutional fact. Say so
in the block — "this is a convention, not a consequence" — because a reader who
tries to derive a convention concludes they have missed something. A rule that
is neither derived nor declared given is a rule the reader can only memorise,
and a memorised rule does not transfer.

### 6.3 Tiers

| `tier:` | Holds | Test |
|---|---|---|
| `spine` | Definition, rule, mechanism, one canonical instance | Removing it breaks the argument |
| `depth` | Derivations, proofs, edge cases, caveats, rationale | It answers "why" or "what if", not "what" |
| `apply` | Instance two, three | It teaches nothing new; it builds fluency |

- **The spine alone is the whole course** [M23, T33]. Depth and apply may point
  at the spine; the spine may never need them. The build fails if a spine block
  cites a figure only a collapsed tier declares.
- **Nothing examinable is `depth`** [M25]. Length is not the test;
  examinability is.
- **An `apply` block never re-explains** [M24]. If it restates a definition,
  the fix is a link.
- **A long derivation belongs in `depth`, and the `key` block links to it**
  (§6.2). "Derivable" does not mean "on the spine": it means reachable. The
  spine states the rule and points; depth carries the argument.

Budget: one or two `apply` blocks per concept across the whole course (D1).

### 6.4 Traps

**One or two per subsection**, and a procedural subsection needs at least one
*execution* trap (D6). Five traps in a subsection is zero traps. Signaling is
a contrast effect, and it degrades with density [T13].

| Kind | Names | Shape |
|---|---|---|
| Conceptual | A wrong belief | "People read the leading 1 of `1010` as a minus sign and the rest as a magnitude, giving −2. The leading bit is a *weight*, −8, so `1010` is −8 + 2 = −6." |
| Execution | A slip in a procedure they already know | "The carry *into* the sign bit and the carry *out of* it are different bits. Reading the wrong one flips your overflow answer and nothing else looks wrong." |

An execution trap names the specific keystroke-level error: which sign, which
index, which unit, which order. "Be careful with signs" is not a trap. It is a
mood.

### 6.5 The deliberate mistake goes in the quiz, not in a block

**There is no `err` block and there should not be one.** An erroneous example
only works if the reader is asked to detect, explain and correct rather than
read, and the quiz is already a retrieval surface with a reveal gate, a `why`, a
`why_prompt` and a type badge. Route it through two things that exist:

```yaml
# 1. an error-spotting quiz item, in the subsection that taught the procedure
- type: Spot the error
  concept: twos-complement
  q: |-
    <p>A student writes −6 as a 4-bit two's complement value like this. Which
    step is wrong, and what is the correct result?</p>
    <ol><li>6 is 0110.</li>
    <li>Invert every bit: 1001.</li>
    <li>So −6 is 1001.</li></ol>
  a: Step 3. Inversion is only half of it; adding one gives 1010.
  why: |-
    <p>Inverting alone produces ones' complement, a real encoding in its own
    right. That is what makes the intermediate value look legal. Check it by
    weight: 1001 is −8 + 1 = −7, not −6.</p>
  why_prompt: What does 1001 evaluate to if you read the top bit as −8?
  verified: 2026-09-08
```

```yaml
# 2. an execution trap in the body, naming the slip itself
- t: trap
  label: Common slip
  h: |-
    <p>Inverting the bits is half the negation. Stopping there gives you the
    ones' complement, which is off by one and looks like a legal answer.</p>
```

The correct procedure appears in an `ex` block earlier in the same subsection.
One error-spotting item per procedural subsection. It is a desirable
difficulty, and those work in small numbers.

---

### 6.6 The claim: `core:` and `gist:`

Every `def`, `key` and `trap` declares one of these, never both. They decide
what the reader sees when the block is closed, and the field name *is* the
declaration — there is no mode flag.

**`core:` — the block's own opening claim, in its own field.**

```yaml
- t: key
  label: The split trap
  core: |-
    Random frame-level splits leak near-duplicate frames across train and
    validation.
  h: |-
    <p>The camera captures frames continuously, so consecutive frames from one
    feeding event are near-identical. The model then partly succeeds on
    validation by having memorised that scene. Split at a coarser grain: hold
    out a whole pen or a contiguous time block.</p>
```

`h:` holds **only what develops the claim** — never the claim again. The two
render as one paragraph at Full depth and the `core:` alone at Notes depth, so
the sentence exists exactly once and there is nothing that can drift. The build
fails a `core:` whose text reopens its own `h:`.

**A `core:` may be a list.** A claim that is several parallel facts is several
lines, because that is what it is — flattening three tests into one sentence to
fit a field is the field deforming the content.

```yaml
- t: key
  label: Three tests that decide every block
  core:
    - Removing it breaks the argument → <b>spine</b>.
    - It answers "why" or "what if", and nothing examinable rides on it → <b>depth</b>.
    - It teaches nothing new and only builds fluency → <b>apply</b>.
  h: |-
    <p>Ambiguous between spine and depth → choose depth.</p>
```

This is still the claim stated once, not a summary in another form. Notes depth
renders the points as points; full depth renders the same list above the
development.

**Write the `core:` so it stands alone.** A reader meeting it cold in week six
gets that line and nothing else. No "the following", no "as above", no forward
reference to the example underneath it.

This is prose discipline, not extra writing: the claim goes first and the
development follows. Real expository writing already does it much of the time.
From SICP §1.1.1, [sarabander.github.io](https://sarabander.github.io/sicp/html/1_002e1.xhtml):

> "The leftmost element in the list is called the operator, and the other
> elements are called operands."

That is a `core:` as written — claim first, complete, standing alone. Two
paragraphs earlier the same page does the opposite:

> "Expressions such as these, formed by delimiting a list of expressions within
> parentheses in order to denote procedure application, are called
> combinations."

The term arrives last, after a clause the reader has to hold. Hoisted, its
`core:` is *"A combination is a list of expressions inside parentheses,
denoting procedure application."* and the original sentence's machinery moves
into `h:`.

**`gist:` — a summary about the block, when the prose must not lead with its
claim.**

```yaml
- t: trap
  label: The leading bit is a weight
  gist: In two's complement the leading bit is worth −8, not a sign flag.
  h: |-
    <p>People read the leading 1 of <code>1010</code> as a minus sign and the
    rest as a magnitude, giving −2. The leading bit is a <i>weight</i>, −8, so
    <code>1010</code> is −8 + 2 = −6.</p>
```

`h:` is untouched and the `gist:` renders only when the block is closed. Use it
where stating the claim first would spoil the first read — which is nearly
always a `trap`, whose whole mechanism is letting the reader believe the wrong
thing for a sentence. Showing the claim in a closed view costs nothing, because
order matters on a first read and a first read is the full text.

**`gist:` is a second copy and is counted.** It is the easier of the two to
write, so left alone it becomes the default and the duplication comes back.
`npm run audit` reports the fraction; a course declares its ceiling in
`course.yaml` under `audit.repeat`. Reach for `core:` unless the order is doing
pedagogical work.

**What the other kinds do when closed**, so you do not have to write anything
for them:

| Kind | Closed view | From |
|---|---|---|
| `def` `key` `trap` | the claim | `core:` / `gist:` |
| `figure` `math` | rendered in full — already the compact form | — |
| `table` `image` | its caption line | `cap:` |
| `ex` | its title | `title:` |
| `note` `code` `list` | a one-line stub | `label:` |
| `p` | **not shown at all** | — |

That last row is a rule, not an omission. **A `p` block carries no claim**: it
sets up, bridges, or fades a concrete anchor. A `p` that asserts something is
the wrong block type and wants to be a `key` (M36).

**`notes:` overrides any of it, per block.** The table above is what a kind does
*by default*; the author knows the cases where it is wrong.

```yaml
- t: table
  notes: open        # open | lead | caption | closed | hidden
  cap: The two controls, and what each one does to a block
```

Use `notes: open` on a table that is a genuine compare-and-contrast matrix. A
matrix is already the compact form — it puts the things being compared side by
side, which a list of claims cannot do, and displays that position related items
close together beat both the running text and the outline on relational learning
(Robinson & Kiewra 1995; Kiewra et al. 1999). Collapsing one to its caption
throws away the only thing it was for.

Use `notes: closed` on a block whose claim is real but not worth a line when you
are scanning. Use `hidden` almost never: it is the one value that takes a block
off the page at that depth, and the reader has no way to know it was there.

### 6.7 Writing for Notes depth

**The rule: a reader at Notes depth must never have to open a block to find out
what it says.** Opening is for *more* detail, not for the *first* detail. A row
that shows only its own label — "Where your courses live", "A concept's first
week" — is a row that has told the reader nothing and is asking them to click to
find out whether it matters. `npm run audit` counts those as the `nameonly`
fraction, and a course declares its ceiling like any other.

**A claim may only stand in for what it can encompass.** This is the rule the
whole section turns on, and the test is one question:

> Does the claim give the reader the *content*, or only a *count* or a *topic*
> of it?

*"Criterion met in four sessions across three days"* is the content of a worked
example. *"Four places a course can take you"* is a count of a list — it tells
you how many and not which, so closing the list behind it hands the reader a
title and calls it a note. If your claim is a count or a topic, then either the
claim is wrong or the block is, and §6.7's last paragraph says which.

**The engine settles the kinds where this is never a judgement.** A block whose
substance is an enumeration — `list`, `table`, `code`, `math`, `figure`,
`image` — is marked `holds: structure` in the registry. A claim on one of those
can only ever be a caption, so writing a `core:` on it does not close it: it
renders the claim **and** the structure. You cannot accidentally hide a table
behind a sentence about the table.

Three ways to satisfy the rule, in order of preference:

1. **Write a `core:`.** Works on *any* block, not only `def`/`key`/`trap`. On a
   prose block it buys `lead`: the claim shows and the argument closes. On a
   structure block it buys `open`: the claim shows and the structure stays.
2. **Set `notes: open`.** For the judgement calls the engine cannot make — a
   `key` whose body is really three parallel rules, an `ex` whose steps you want
   in front of you while revising.
3. **Accept the label** only where the label genuinely is the whole content —
   which is rarer than it looks.

**The one case the engine warns about rather than decides.** A prose block with
a list buried inside its own `h` looks like prose to the engine and reads like a
list to a reader, and its claim closes every item behind one sentence.
`npm run check` warns and names both fixes: `notes: open`, or move the
enumeration into a `list` block of its own, which is usually what it wanted to
be. A worked example is exempt, because M11 requires it fully stepped — its
`<ol>` is the *working*, which is what you open an example for, not the
substance, which its claim already carries.

**Write claims telegraphically.** The Cornell note-taking system's first
instruction is exactly this:

> "Record: During the lecture, use the note-taking column to record the lecture
> using **telegraphic sentences**."
> — Cornell Learning Strategies Center, adapted from Walter Pauk,
> *How to Study in College* 7/e (2001),
> [lsc.cornell.edu](https://lsc.cornell.edu/how-to-study/taking-notes/cornell-note-taking-system/)

A telegraphic sentence drops what the reader can supply — articles, hedges,
throat-clearing — and keeps the assertion. Target one line. Two is a paragraph
wearing a bullet.

| Instead of | Write |
|---|---|
| "It is worth noting that a course you install exists only in this browser and nowhere else." | "Nothing is uploaded: a course lives in this browser and nowhere else." |
| "This example walks through what happens when you answer one question confidently and get it wrong." | "One confident miss records a failed type, enrols the concept, and drills it." |
| "Some notes about the other layouts a graph block will accept." | "A graph also takes `row` and `manual`; layered is the default past five nodes." |

The left column names the block. The right column *is* the note.

**A `label:` still shows, as a run-in.** Where a block has both a label and a
claim, Notes depth sets the label in the mono face and runs the claim on after
it — the classic notes form, and the reason it runs in rather than sitting above
is that a heading per row rebuilds the stack of header-and-paragraph this view
exists to replace.

```
▌ The split trap. Random frame-level splits leak near-duplicate
  frames across train and validation.
```

So write the label as the *takeaway* and the `core:` as the *rule*, and they
carry different information. If the two would say the same thing, write only the
claim.

---

## 7. Questions

**One question per distinct question type. Never repeat a type** [M5]. The
target is coverage of the question *surface*: a reader who can answer all of
them has met every form the material can be asked about. Volume belongs in the
drill bank, which is scheduled rather than read.

To build the set, ask what can be asked about this subsection. For a procedural
topic that is usually: apply forwards, apply backwards, identify which case
applies, compute a quantity, **spot the error** (required for procedural
subsections, D6), explain why the rule holds, judge a boundary case.

```yaml
- type: Detect overflow                    # names a skill, never a number
  concept: twos-complement                 # the retention identity
  q: Add 0110 and 0101 as 4-bit two's complement values. Give the result and say
     whether it overflowed.
  a: 1011; overflow                        # the bare answer, no reasoning
  why: |-
    <p>Both operands are positive and the result's sign bit is 1, which cannot
    happen without overflow…</p>
  why_prompt: What did the sign bits tell you?
  verified: 2026-09-08
```

Every field is required [M6]:

- **`type`** is the identity used for *coverage* [M9]. A skill name, not a
  number.
- **`concept:`** is the identity used for *retention*. It is what lets a
  confident miss pull that concept into review and drill it on the spot [T18].
  Where the subsection cites exactly one concept with a drill file the build
  infers it; declare it wherever there is a choice. A `concept:` naming no
  concept file fails the build; an item resolving to nothing is counted by
  `npm run audit` as `unrouted`.
- **`why_prompt:`** is the specific question the reader answers before the
  reveal, replacing a generic "why?". Write it for every item (D5). You already
  wrote the reasoning, and the prompt is what turns retrieval into elaborated
  retrieval.
- **`why`** explains the reasoning **and why the wrong path is tempting** [M7].
  A misconception survives an explanation that never names it.
- **`verified:`** is the date you last **re-derived** this answer [M22].

### 7.1 The synthesis item

Goal 0.1(d) is the one nothing else in this file buys. Coverage proves the
reader can answer; it does not prove they can *construct*. Generating an answer
rather than reading one is worth d = 0.40 on retention alone (Bertsch et al.
2007, *Memory & Cognition* 35:201–210), and the constructing is the point
independently of that.

**Where it applies.** A section earns a synthesis item when its material
**composes**: two or more of its rules can bear on one situation, or a rule has
a domain of validity a reader could probe. Write **one**, in the section's last
subsection.

**Where it does not.** A section that teaches one procedure with one correct
output has nothing to compose. An open item there is a writing exercise, not a
transfer one. Exempting a section is a judgement, not a default. Name the
exemption in the section blurb so the next pass can disagree with it.

```yaml
- type: Synthesis
  concept: twos-complement
  q: |-
    <p>Two's complement has exactly one zero, and one negative value with no
    positive counterpart. Both follow from the same asymmetry. Describe a
    fixed-width signed encoding that removes the second anomaly, and say what
    it costs.</p>
  a: |-
    <p>A good answer names the asymmetry (2ⁿ patterns cannot split evenly around
    a single zero), proposes one coherent alternative, and prices it.
    Sign-magnitude and ones' complement both buy a symmetric range, and both
    pay for it with a second zero and a more expensive adder.</p>
  why: |-
    <p>There is no single right answer. What is being tested is whether the
    reader can see the encoding as a set of trade-offs rather than as a rule…</p>
  why_prompt: How many patterns does n bits give, and how many values must a
    symmetric signed range contain?
  verified: 2026-09-08
```

`a` states **the criteria a good answer meets**, not an answer. `type` is still
unique within its subsection, so the build treats it like any other item.

---

## 8. The drill bank — `drills/<concept-key>.yaml`

One file per concept marked `review: true`. The quiz covers the question surface
once per type; the drill bank runs the same procedure repeatedly until it is
fast, and it is the pool `#/review` draws from. These are the two loops
[code_truth §3b]: Loop A is the quiz, keyed by `type`; Loop B is the bank, keyed
by concept. A confident miss in Loop A recruits Loop B. A Loop B success never
marks a type covered.

```yaml
concept: twos-complement          # must match a concepts/<key>.yaml
items:
  - format: short-answer          # multiple-choice | short-answer | cued-recall
                                  # | derivation | numeric
    stem: Write −6 as a 4-bit two's complement value.
    answer: "1010"
    steps:
      - "6 is 0110."
      - "Invert: 1001. Add one: 1010."
      - "Check by weight: −8 + 2 = −6."
    why: |-
      <p>Stopping after the inversion gives 1001, which is −7. That is the
      tempting wrong answer, and it looks legal.</p>
    verified: 2026-09-08
```

Item ids are positional. The build checks: **three** items minimum (the
criterion count — three *different* items is what stops the reader memorising
one question), **two** formats minimum with **one** matching
`exam.format`, no two items sharing an answer, no stem containing its answer,
and `steps` on every item [M11, M26].

A higher criterion is not better [T31]. Do not write eight items where three
will do; spend the rest on §8.2.

### 8.1 Surface variation, fixed answer

At least one item per reviewed concept has a surface **unlike** the section's
worked example — different framing, domain or given [M32]. The rule that makes
this safe: **vary the surface, hold the response.**

Wrong: the worked example computes a delay in nanoseconds; the drill asks for a
qualitative comparison. That is a different response.
Right: the worked example computes a delay through a 3-gate chain; the drill
computes one through a mixed chain given a datasheet table.

### 8.2 Every specific value gets an item

Scan every `key` block. If it states a constant, threshold, sign convention,
ordering, boundary or named condition belonging to a reviewed concept, that
value needs a `cued-recall` item [M33, D7].

```yaml
  - format: cued-recall
    stem: In n-bit two's complement, what is the most negative representable value?
    answer: −2^(n−1)
    steps: ["The range is asymmetric: one more negative value than positive."]
```

The test: **could the reader lose a mark by forgetting this exact thing while
understanding everything around it?** Where detail retention is a failure mode
(D7), this is the highest-yield instruction in the file.

---

## 9. The primer's prequestions

`_section.yaml` may end with questions about a **relation** the section is about
to establish, not a term. The primer's own run already covers terms [M29].

```yaml
primer:
  - ask: A four-variable K-map group covers eight cells. How many literals does its term have?
    answer: One
    why: |-
      <p>Each doubling of a group removes one literal.</p>
```

The correction is not optional and the build enforces it: an uncorrected
conceptual pretest error is *more* likely to be repeated later than one never
asked. Ask only about what you want retained. The benefit does not generalise
to the rest of the section. **Write one or two.** A prequestion set that covers
the section is just the section asked backwards.

---

## 10. Figures, maths, images, colour, cross-course links

### 10.1 Figures

`{t: figure, kind, cap, id, spec}`. Nine kinds; `spec` fields in full, so you
never have to guess what a kind can do.

| `kind` | For | `spec` |
|---|---|---|
| `graph` | State machines, block diagrams | `nodes:[{id, label, x, y, note, title, accent, state, here}]`, `edges:[{from, to, label, curve, self}]`, `layout: circle \| row \| layered \| manual`, `r`, `w`, `h` |
| `plot` | Functions or measured series | `series:[{label, fn \| points, from, to, dash, samples}]`, `xlabel`, `ylabel`, `xrange`, `yrange`, `ticks`, `legend`, `xfmt`, `yfmt`, `w`, `h` |
| `flow` | Processes and pipelines | `steps:[{label, note}]`, `dir: row \| col` |
| `grid` | Labelled 2-D grids with highlighted groups | `rowVars`, `colVars`, `rowLabels`, `colLabels`, `cells`, `index: binary`, `groups:[{label, cells:[[r,c],…]}]` |
| `timing` | Digital waveforms | `signals:[{name, wave:"0101"}]`, `unit` |
| `bar` | Magnitudes across labelled categories | `bars:[{label, value, accent}]`, `xlabel`, `ylabel`, `max`, `baseline`, `ticks`, `valueFmt`, `w`, `h` |
| `scatter` | How two measured quantities relate | `series:[{label, points}]`, `trend: true`, `xlabel`, `ylabel`, `xrange`, `yrange`, `ticks`, `xfmt`, `yfmt`, `w`, `h` |
| `matrix` | Bracketed matrices | `rows`, `label` |
| `svg` | Anything the others cannot express | `body`, `viewBox` |

`grid` cells are styled by the course's `valueStyles`, and `groups` are drawn in
three rotating colours. A `plot` series' `fn` is JavaScript in `x`; it is
compiled and sampled by `validate.mjs`, so a function that will not parse or has
no finite value on its range fails the build rather than rendering an empty
chart.

**A `spec` may only contain keys the engine reads.** `src/figures/schema.js`
declares them per kind and `validate.mjs` fails the build on anything else,
because a renderer ignores a key it does not know — the figure draws without it
and nothing says so. Two ways in, both of which have shipped:

1. **Quote any value containing a comma.** Inside a YAML flow mapping a comma
   ends the *pair*, not the value. `{label: resolve, note: path, credential,
   query}` is four keys — two of them null — and the note renders as `path`.
   Write `{label: resolve, note: "path, credential, query"}`, or use a block
   mapping. This is the single most common figure defect.
2. **`dir` and `layout` take the values in the table and nothing else.**
   `dir: down` is not `col`, so `flow` falls back to a row.

**A `valueFmt`, `xfmt` or `yfmt` is a template string**, not a function — a
course is data. `{}` stands for the value, already formatted:

```yaml
- t: figure
  kind: bar
  cap: Recall after a week
  spec:
    valueFmt: "{}%"          # 40 → "40%";  "{} ms" → "40 ms"
    bars:
      - {label: restudy, value: 40}
```

A format with no `{}` fails the build: every label would otherwise read the
same, which looks deliberate.

**A figure must carry information the prose does not** [M17]. A decorative
diagram costs attention and returns nothing; removing it improves learning.

Use `note` on graph nodes only when there are few. Past about eight they
collide, so prefer `title` (a hover tooltip). Cite a figure by giving it `id:`
and writing `<f k="that-id"/>`; numbering is automatic and section-scoped, and
the build fails on an unknown or duplicate id.

### 10.2 Maths

Write TeX, not HTML. It is checked at build time, so a formula that does not
compile fails the build with the file and formula named [T30].

```yaml
h: |-
  <p>For <m>ay'' + by' + cy = 0</m>, try <m>y = e^{rt}</m>.</p>
```

```yaml
- t: math
  label: The characteristic equation
  tex: ar^2 + br + c = 0
  note: The solution form depends only on the discriminant.
```

Three rules that will bite you otherwise:

1. **Never put TeX in a double-quoted YAML scalar.** `"\alpha"` is a YAML
   escape, not a backslash. Use `|-` or single quotes (`'\alpha \pm \beta'`; a
   literal `'` inside is written `''`).
2. **No `<m>` in a table with `mono:` or `map:`.** Those cells are HTML-escaped;
   the validator fails this rather than letting you find it on the page.
3. **Words inside maths go in `\text{...}`**, or stay outside the `<m>`.

Use `math` when the equation *is* the point of the paragraph; inline `<m>` when
it is mentioned in passing.

### 10.3 Images

```yaml
- t: image
  src: assets/scope-trace.png
  alt: Oscilloscope trace showing a 40 ns propagation delay
  cap: Measured delay on the lab board
  credit: Lab 4 handout, fig. 2
  width: 460
```

Embedded at build, so the page stays self-contained. PNG, JPEG, GIF, WebP, SVG;
the build fails on a missing path or a total over 8MB. **`alt` is required**
[M19]. Describe what the image *shows*, and prefer a `figure` where the content
can be described as data [M18].

### 10.4 Colour

If you add CSS through `course.yaml`: **ink** variants (`--hi-ink` `--lo-ink`
`--dc-ink` `--hz-ink`) for text, vivid accents (`--hi` `--lo` `--dc` `--hz`) for
borders, fills and graphics [T3]. `npm run contrast` walks every rendered text
node in three colour modes and fails below AA, so this is checked rather than
trusted. **Colour never carries meaning alone** [T26].

### 10.5 Linking to another course

```yaml
h: |-
  The theory is <a href="#/other-course/s6-1">first-order transients</a> in the
  lecture course.
```

Non-redundancy applies across courses, not only within one. The target is a full
route, resolved against every course on disk. It renders as a plain link rather
than a margin card, because the other course's index is not built until you open
it.

---

## 11. `materials/`

The site holds all *explanatory* content. `materials/` holds artefacts different
in **kind**, each linking in by anchor rather than restating.

| File | Holds | Status |
|---|---|---|
| `expectations.md` | Calibration, prerequisites, exam format and dates, review basis | **required** (M3) |
| `syllabus.md` | Official topic sequence, textbook, prerequisites | optional; high value per effort |
| `schedule.md` | Week-by-week, deep-linked to section anchors | optional |
| `reference.md` | Formula card: symbols only, no prose | optional; high value per effort |
| `problems.md` | Drill problems | **generated** from `drills/` |
| `checklist.md` | "Can I do this?" self-audit | **generated** from state |

`npm run materials` writes the generated two; editing them by hand fails the
build, as editing `index.html` does [T20, T21]. A file that would restate what
the site already says should not be written.

### 11.1 `expectations.md` front matter

```yaml
---
exam:
  format: [short-answer, derivation]
  dates: []      # empty under goal: mastery; real dates under an exam overlay
review:
  basis: >-
    Everything later sections depend on, plus the sign conventions, which are
    error-prone under time pressure.
---
```

`format` drives the drill-format coverage check and is required under either
goal. Under `goal: mastery` it names the response formats a mastered reader must
be fluent in, and it should include `derivation` (§1.2). `dates` turn the
scheduler around to aim at a deadline: no interval steps over one, so course
home can report predicted recall *on the day* [T17]. Leave `dates` blank rather
than guessing. `review.basis` records why the review set is what it is [M31] and
the build fails without it once anything is marked for review.

### 11.2 Calibrating depth

Recorded in `expectations.md` in Phase 1, as a partition of every topic:

- **Skip** what the reader demonstrably knows, and say that you skipped it.
- **Bridge** what they know informally but not rigorously: a short subsection.
- **Teach fully** everything else.

**Copy `background` from §1 into this file verbatim.** It is the closure
boundary (0.2), and it has to be readable in the course folder rather than
inferred from a gitignored profile. Everything on it may be used unexplained;
everything off it is *teach fully*, with no third option.

The most common failure is teaching to the median student instead of the actual
reader. Over-explaining known material costs attention the hard parts need. The
opposite failure is quieter and worse: using something off the list because it
was the natural tool, which strands the reader with no signal that anything was
skipped.

---

## 12. Self-check before you emit

### 12a. Gated — a build failure catches these

**Per subsection**

- [ ] Every `<c k="…">` names a concept file that exists
- [ ] Every `#s…` points at a real section or subsection; every `<f k>` at a
      real figure id
- [ ] At least one quiz item, no repeated `type`, every item has `type`, `q`,
      `a`, `why`, and any `concept:` resolves
- [ ] `attempt` blocks appear only as the first block (M10)
- [ ] Every `def` names a term; every subsection names at least one
- [ ] Every block declares a tier the lane selector knows
- [ ] Every `<m>` and `math` block compiles; no `<m>` in a `mono`/`map` table
- [ ] Every authored HTML field escapes a bare `<` or `&`
- [ ] Every `image` carries `alt`; every `plot` `fn` parses and is finite

**Per reviewed concept** (`review: true`)

- [ ] `drills/<key>.yaml` exists with ≥3 items, ≥2 formats, ≥1 exam-format
- [ ] No two items share an answer; no stem contains its answer
- [ ] Every item has `steps`
- [ ] `confusable_with` is declared on both sides

**Per course**

- [ ] `expectations.md` has `exam.format` and `review.basis`
- [ ] `code` and `theme.hue` are not shared with another course
- [ ] Spine-only reading resolves every reference (M23, T33)
- [ ] `npm run audit` is inside every ceiling `course.yaml` declares

**The claim and the taxonomy (§5a, §6.6).**

- [ ] No block declares both `core:` and `gist:`.
- [ ] No `core:` reopens its own `h:` — `h:` develops the claim, never restates it.
- [ ] Every `cat:` names a `categories/` file, every category has a `boundary:`
      and at least one member, and `siblings:` name each other.
- [ ] Every tag is a slug: lowercase, digits, single hyphens.

### 12b. Author judgement — ungated

No script decides any of these. Skip this list and nothing else catches it.

- [ ] **Closure holds** (0.2). Walk the course in order with the `background`
      list beside you. Every term, symbol, unit and technique is either on that
      list or `def`-ed earlier. This is the check most likely to fail and the
      one no build will ever run.
- [ ] **Every `key` rule is derived or declared given** (§6.2). No rule arrives
      by assertion.
- [ ] **The opener is retired**, and **the anchor names where it breaks** (§6.2)
- [ ] **The traps are traps**, one or two, and a procedural subsection has an
      execution trap and an error-spotting item (§6.4, §6.5). No script detects
      "procedural".
- [ ] **The quiz types are actually distinct.** Could a reader answer one and
      fail another? If not, they are one type in two labels (14.6).
- [ ] **Every composing section has a synthesis item**, and every exempt section
      says in its blurb why it is exempt (§7.1)
- [ ] **Recurring ideas are concepts** (M13). No script sees an un-promoted idea.
- [ ] **Sections run 2–5 subsections.** A band, not a rule.
- [ ] **One drill item has a surface unlike the worked example, asking the same
      kind of response** (M32, §8.1).
- [ ] **Every specific value in a reviewed concept's `key` blocks has a
      cued-recall item** (M33, §8.2). The audit warns on numerals; a sign
      convention or an ordering, no script will catch.
- [ ] **`confusable_with` pairs are real confusions**, not related ideas (D2).
- [ ] **No `apply` block re-explains** its concept (M24).
- [ ] **Nothing marked `source:` with an origin was written from memory.** The
      field is a claim, and `generated` exists so you never have to lie in it.
- [ ] **Every `verified:` date is a re-derivation**, not a re-reading (M22).
- [ ] **The prose does not read as generated** (§13). Four counts, over the
      whole course: em dashes ≤ 3 per 1000 words, hung tails ≤ 5% of sentences
      (§13.3), "you" ≥ 6 per 1000 words (§13.1), and no `key` or `def` block of
      four sentences without one under ten words. Read one block aloud. If three
      sentences in a row land at the same length, that is the defect.

```sh
npm run check      # must be clean
npm run audit      # read the four fractions and the M33 warnings
npm run shots      # look at it: did figures draw, is the primer right,
                   # is any section a wall of undifferentiated p blocks
```

**Read the section at Notes depth before you call it done.** Every `core:` line
in order, and nothing else. Three things show up there and nowhere else: a claim
that turns out to be a topic rather than an assertion, two blocks whose claims
are the same claim, and a `def` that announces what the blocks below it will
cover instead of defining its term. All three are invisible in the full text,
because the prose around them fills the gap.

### Quality bar

A finished subsection lets a reader (1) say what the thing is, from `def`;
(2) use it, from `key` + `ex`; (3) see why it holds, from the derivation;
(4) recognise where it goes wrong, from `trap` + the error-spotting item;
(5) answer every distinct question type, from `quiz`; and (6) still do it in six
weeks, from `drills/`. A finished *section* also lets them build something the
course never showed them (§7.1). The last two are the ones that get skipped.

---

## 13. The sentence

§14 catalogues defects in *what* a subsection contains. This section is about
the sentence that carries it. That is where a reader decides whether a person
wrote this for them or a machine produced it at them, and they decide it inside
the first paragraph, before any of the structure above has had a chance to work.

The cost is not aesthetic. Prose that reads as generated is prose the reader
discounts, and a reader who is discounting is not encoding.

### 13.1 Three findings, and what each one licenses

**Address the reader.** Rewriting instructional text from formal to
conversational style — mainly by moving to second person and speaking to the
learner directly — improves retention at d = 0.30 and **transfer at d = 0.54**
(Ginns, Martin & Marsh 2013, *Educational Psychology Review* 25:445–472,
meta-analysis). Transfer is the larger of the two, and it is what §1's D4 and D5
already spend budget on. Second person is a lever on the same outcome, and it is
free.

**Address is not instruction.** Second person names the reader's situation,
their reasoning, and what they already hold: "the group you are standing in",
"you were given the other direction". It does not turn a statement of fact into
an order. "It is written P(A | B)" is a fact about notation; "Write it P(A | B)"
commands an action the reader is not performing and has no reason to. The
difference costs nothing and is invisible while you write, because both forms
contain "you" and both feel direct. A course that drifts into the imperative
reads as a worksheet, and the reader starts skipping the instructions, which are
where the content went. §13.2's count is a floor on address. It is not a quota
imperatives can fill.

**Cut the clause that adds nothing.** Sentence-level coherence measures
g = 0.63, the largest of the layout effects, and it is subtractive [T11]. A
clause carrying nothing the reader will be asked for is not neutral. It is a
cost. Strunk put the same rule as Rule 13: "Vigorous writing is concise. A
sentence should contain no unnecessary words, a paragraph no unnecessary
sentences, for the same reason that a drawing should have no unnecessary lines
and a machine no unnecessary parts."

**The machine tell is a habit, not a vocabulary.** Of the 379 excess style words
that appeared in biomedical abstracts in 2024, 66% were verbs and 14% were
adjectives; excess vocabulary from a genuine change of subject matter runs 79.2%
nouns (Kobak et al. 2025, *Science Advances*, 15M abstracts). What marks
generated prose is a preference for certain verbs and modifiers. That is a
preference for one sentence shape. You cannot fix it by avoiding
"delve". You fix it by changing the shape.

### 13.2 The four numbers

Counted over the prose fields of a course, code and maths excluded.

| | typical model output | target |
|---|---|---|
| em dashes per 1000 words | 6–15 | **≤ 3** |
| sentences ending in a hung tail | 15–24% | **≤ 5%** |
| "you" per 1000 words | 1.8–20.6 | **≥ 6** |
| sentences under 10 words | — | **≥ 19%** |

These are targets for course prose, not for code comments. A comment is read
once, by someone who chose to open the file. A `key` block is read by someone
under load who is about to be tested on it.

### 13.3 The hung tail

One defect dominates, and it is why the prose reads as generated. A sentence
states its point, then hangs a second clause off the end that glosses,
editorialises or draws a moral:

> …never to physical wire order **— a bus can be routed in any order.**
>
> …removes most of the null checks **— which is why published implementations
> use one and student implementations that segfault usually do not.**
>
> A weaker invariant than a BST **— only parent against child — which is exactly
> why a heap can be built in linear time.**

Any one of those is a good sentence. One in five being that sentence is a
cadence, and a cadence is what a reader hears as a machine. Every sentence lands
the same way, so none of them lands.

The end of a sentence is the **stress position**: "Stress positions are at
points of syntactic closure, e.g. the ends of clauses, sentences, and sections"
(Gopen & Swan 1990, *American Scientist* 78:550–558). It is where the reader
puts what they will remember. Strunk's Rule 18 is the same instruction from the
other side: "The proper place in the sentence for the word, or group of words,
which the writer desires to make most prominent is usually the end." Spend it on
a gloss and you have spent the only slot that sentence had.

**The test.** Delete everything after the dash or the comma.

- The sentence still teaches. The tail was commentary. It is gone, and you do
  not reattach it.
- The sentence lost something the reader will be asked for. The tail was a claim
  wearing an appositive's clothes. Give it its own sentence, with its own
  subject and its own verb.

**The budget.** One hung tail per subsection. Not one per block.

`which is why`, `that is why`, `which is exactly why`, and the participial tails
`, ensuring …`, `, allowing …`, `, making it …`, `, enabling …` are all the same
construction. They share the one budget.

### 13.4 Rhythm

Generated prose is metrically flat. Every sentence arrives at about the same
length, so nothing is emphasised. Human explanatory prose varies, and the
variation is itself the emphasis. A four-word sentence after two long ones is
how a writer points.

Gopen & Swan again: "Readers expect each unit of discourse (sentence, paragraph,
section) to serve a single function." A sentence doing two jobs is usually a
long one. Split it and you have the short sentence you were missing.

**The test.** Read the block aloud. If three sentences in a row land within three
words of each other, then one of them is two sentences or two of them are one.
Every `key` or `def` block of four sentences or more carries at least one
sentence under ten words.

### 13.5 Verbs, and who is doing what

A nominalisation buries the verb inside a noun, then needs a weak verb to prop
it up. `the <X>ion/ment/ance of` is the reliable place to look. Not all are
defects: "the impedance of" is the name of a quantity.

| instead of | write |
|---|---|
| the definition of a full tree is | a full tree is |
| performs a comparison of | compares |
| is responsible for handling | handles |
| there is a requirement that | must |
| serves as / acts as / functions as | is |

"Readers interpret any information between the grammatical subject of a sentence
and its verb as an unimportant interruption" (Gopen & Swan). Put the thing the
sentence is about first. Put its verb next. Put the new information last. Strunk
Rule 12 covers the nouns: "Prefer the specific to the general, the definite to
the vague, the concrete to the abstract."

### 13.6 Words to distrust

Not a blacklist — §13.1 says why a blacklist is the wrong instrument. Each is a
prompt to check the *shape* of the sentence, not to reach for a synonym.

`crucial` · `essential` · `vital` · `pivotal` · `paramount` · `robust` ·
`seamless` · `leverage` · `utilise` · `delve` · `realm` · `landscape` ·
`tapestry` · `testament` · `showcase` · `underscore` · `intricate` ·
`meticulous` · `it is important to note` · `it is worth noting` ·
`serves as` · `the fact that` · `in order to`

`crucial`, `essential` and `vital` are one error committed three ways: the
sentence asserts importance instead of demonstrating it. If a thing matters, the
reason it matters is the sentence you should have written.

**The error is wider than importance.** Any adjective handing the reader a
judgement they were about to reach from the evidence in the same sentence does
it: "the test is good", "a surprising result", "a simple rule", "the obvious
choice". "The mammogram is good: it flags 80 of those 100" spends a clause
telling the reader what to think about a number they have not read yet, and it
arrives before anything has earned it. Give the number first and let the reader
conclude. If you cannot say what makes it good, surprising or simple, it is
not.

A hedge is a defect in the *claim* rather than in the sentence, and is caught at
14.9.

### 13.7 Read a human first

Before your first `p` block of a course, read one page of one of these. Not for
the subject. For the cadence.

**Richard Feynman**, *The Feynman Lectures on Physics* I.1, "Atoms in Motion",
at [feynmanlectures.caltech.edu/I_01.html](https://www.feynmanlectures.caltech.edu/I_01.html).
His answer to what one sentence he would pass on carries the whole atomic
hypothesis: "all things are made of atoms—little particles that move around in
perpetual motion, attracting each other when they are a little distance apart,
but repelling upon being squeezed into one another." The next sentence is short,
and it tells you what to do with the long one. **Steal:** one long sentence that
is all content, then a short one that is all instruction. Nothing in the long
one is a gloss.

**Julia Evans**, "Patterns in confusing explanations", at
[jvns.ca/blog/confusing-explanations](https://jvns.ca/blog/confusing-explanations/).
Thirteen named patterns, several of them truths in this repo arrived at
independently: *starting out abstract* is M10 and D3, *unsupported statements* is
M20 and M28, *"what" without "why"* is M6 and M7, and *making outdated
assumptions about the audience's knowledge* is 0.2. Her note on audience is §1
in one line: "writing that's easy to understand for 1 person (other than you!)
has a good chance of being easy to understand for many other people as well."
**Steal:** the register. Short declaratives, second person, and a willingness to
say that a thing is confusing.

**Paul Halmos**, "How to Write Mathematics", *L'Enseignement Mathématique* 16
(1970). The headings alone are most of the lesson: *Say something. Speak to
someone. Organize first. Write in spirals. Down with the irrelevant and trivial.
Resist symbols. Stop.* **Steal:** "Speak to someone" is §1 and 13.1's d = 0.54.
"Stop." is 13.3.

**Mechanism, if you want it.** Gopen & Swan, "The Science of Scientific
Writing", *American Scientist* 78 (1990): 550–558, at
[crowl.org/lawrence/writing/GopenSwan90.html](http://www.crowl.org/lawrence/writing/GopenSwan90.html),
explains why the tests in 13.3 and 13.5 work instead of asserting them.

---

## 14. Failure modes

The shapes a capable model produces by default. Each is a real defect, and each
has a fix in one line.

| | Failure | Fix |
|---|---|---|
| **14.1** | **Assumed knowledge.** You reach for the convenient tool — a matrix, a limit, a piece of notation — that `background` never granted. | Check the list, not your instinct (0.2, §12b). |
| **14.2** | **The asserted rule.** A `key` block states a rule and moves on, because the derivation felt like a digression. | Derive it, or declare it given (§6.2). |
| **14.3** | **The imperative drift.** Told to address the reader, you convert statements into orders and re-narrate the interface: "write this down", "note that", "click to reveal", "write it as X". | Second person names the reader's situation, not their next action (13.1). Check §2.1 before telling the reader what to do on the page. |
| **14.4** | **Encyclopedic drift.** Balanced survey prose covering a topic from all sides. | If a paragraph would sit unchanged in a Wikipedia article, it is wrong here. A course teaches one reader one thing in an order. |
| **14.5** | **The example that re-explains.** A worked example opening by restating the definition. The most common non-redundancy violation there is. | The example starts at the first step of the work. |
| **14.6** | **Fake variety in the quiz.** The same question three times with different numbers and different `type` labels. | Could a reader answer one and fail another? If not, merge them. |
| **14.7** | **Trap inflation.** Every caution marked as a `trap`, because traps look valuable. | One or two per subsection (§6.4). |
| **14.8** | **Depth as a dumping ground.** Anything long pushed into `depth`. | The rule is examinability, not length (§6.3). |
| **14.9** | **Hedged claims.** "Generally", "typically", "in most cases". A hedge is a claim the reader cannot use. | Name the condition, or write `unverified`. |
| **14.10** | **Confident fabrication of institutional fact.** A plausible grading split, exam date, or textbook edition. | Do not (0.5). |
| **14.11** | **Manufactured confusability.** Any two concepts in a course are relatable. | Only pairs readers actually mix up (D2). |
| **14.12** | **The four-example subsection.** Worked examples added because a topic feels hard. | Where schema acquisition is not the failure mode that is the wrong lever (D1). One example, three drill items. |
| **14.13** | **Skipping Phase 6.** Drills are the least interesting thing here and the most important one for the stated priorities. | A course that stops after Phase 5 is a well-made document with no retention loop. |
| **14.14** | **Marking everything for review.** Twenty concepts become sixty drill items, most about things nothing will ask. | The cap is judgement, which is exactly why you overshoot it (§5.1). |
| **14.15** | **Coverage mistaken for mastery.** Every type answered, and the reader has still never constructed anything. | The synthesis item (§7.1). |
| **14.16** | **Density drift.** By the fortieth subsection the `key` blocks are half again as long, carrying the same point through a second example, a restated setup and a "which is exactly why" tail. | A `key` block is two to four sentences; a subsection runs three or four blocks of a kind, not five. Five `key` blocks means two are one rule split in half. Calibrate against the sections already shipped. |

---

## 15. When data is not enough — `blocks.js`

Almost never. First check that a `figure` kind, a `table` with `map:`, or a
`def`/`key`/`ex` block genuinely cannot express what you want.

The exception is a renderer about *shape* rather than about data. Circuit
schematics are topology and symbols, and no table configuration produces those.

```js
export default function (Blocks, U) {
  Blocks.register("schematic", {
    apart: true,                                  // set apart from the prose
    render: b => `<div class="figure">…svg…</div>`
  });
}
```

Style it from `styles:` in that course's own `course.yaml`, so the engine keeps
no opinion about circuit symbols. `validate.mjs` reads the registered names out
of your `blocks.js`, so a typo in a block type is still caught. `U` gives you
`esc`, `strip`, `clip`, `box(cls, label, inner)`, `cell(v, map)`,
`src(b)` (the source badge) and `caption(num, text)`.
