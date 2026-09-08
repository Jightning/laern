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
npm run new -- <id> "Course Title"   # scaffold courses/<id>/ (current; use it)
npm run check                        # build + validate + browser tests
npm run audit                        # sourcing, verification, routing, drill health
```

---

## 0. Operating rules

**0.1 Follow §3's phases in order.** Depth is a function of the reader, so a
section written before the calibration exists is calibrated to nobody.

**0.2 Every rule here has a yes/no test.** If you are weighing a judgement, you
have missed the test. Where a real judgement remains, §1 breaks the tie.

**0.3 Do not guess. Fail loudly.** Unknown topic order, exam format, or truth of
a claim → write `unverified` (a human should look it up) or `generated` (a model
wrote it; a human should check whether it is even true), or leave the field
empty with a note naming where the answer lives. A flagged gap is a task; a gap
filled from memory is a defect nobody will find. [M20, M21, M28, M30]

**0.4 Budgets are numbers.** Where this file gives a count, hit it. Where it
gives a range, land inside it.

**0.5 Run §12 before you emit.** It is two lists. The first is gated by a
script; checking it yourself costs one pass instead of a round trip. The second
cannot be gated by anything, and you are the only check on it.

**0.6 Your default voice is wrong for this.** Left alone you write balanced,
hedged, encyclopedic prose that covers a topic. That is a document. §14 lists
the shapes that produces; §13 is the sentence itself, which is where a reader
decides whether a person wrote this. Read both before your first `p` block, and
read the page of a human writer §13.7 sends you to.

**The two rules everything serves** [M1, M2]: every piece of *explanation*
appears exactly once, and nothing is assumed beyond the written calibration.
They pull against each other, and the reference system is how they coexist —
you can be complete without repeating because the reader can always reach the
definition. Non-redundancy governs explanation, not practice: a second
application is not a second copy, which is why the drill bank exists.

---

## 1. The reader

This section is data, filled in for the person a course is written for.

**The filled-in copy lives in `courses/_reader.yaml`, not here.** A learner
profile is personal, and this file is tracked; `courses/` is not, so the answer
sits gitignored beside the courses it calibrates. `npm run new` writes the file
the first time, `tools/author.mjs` sends it with every prompt, and a model
writing a course by hand reads it from there. This block is the blank form.

**Read it before Phase 1 and derive §1.1 from what it says.** Everything
downstream that mentions "this reader" resolves to that file, and every default
in §1.1 is switched on by a line in it, so a course written against `UNSET` is
calibrated to nobody (0.1) — `author.mjs` refuses to emit a prompt against one
rather than guessing.

```yaml
reader:
  background: UNSET      # what they already hold and how firmly; the
                         # calibration in materials/expectations.md starts here
  failures: UNSET        # which modes below actually go wrong for them
  not_failures: UNSET    # the rest, named rather than left out — §1.1 reads
                         # absence as a switch, so an unlisted mode is a guess
  onboarding: UNSET      # concrete anchor first, or formal statement first
  priorities: UNSET      # ranked; §1.2 resolves ties with this
  session_length: UNSET  # ask before assuming (0.3)
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

### 1.1 What this profile changes

Seven defaults, each switched on by a line in §1 rather than by style. Read the
switch column against the profile you just wrote; where a switch is off, the
entry inverts rather than disappearing, and the inversion is named.

| | Switched on by | Default | Because |
|---|---|---|---|
| **D1** | schema acquisition is **not** a failure | `apply` stays lean: one or two instances per concept, never four | Worked-example support reverses with expertise, so a reader who holds the schema gains more from solving than from a fourth example [material_truth Trade-offs]. Off: schema acquisition among the failures buys more worked instances, not fewer |
| **D2** | discrimination is **not** a failure | Declare `confusable_with` only where the confusion is real | Interleaving pays on confusable pairs and costs on unrelated ones [T16]. Off: declare it on every pair the reader actually mixes up, and interleave them |
| **D3** | `onboarding` asks for a concrete anchor | Open with a concrete anchor, then fade it | Concrete-first-and-stay-concrete is the worst sequence tested [M10]. Off: the formal statement opens and an instance follows it |
| **D4** | transfer is a failure | `attempt` blocks default ON for conceptual subsections | Problem-solving before instruction is favoured for transfer outcomes among older STEM learners, which is the boundary a transfer deficit sits inside [material_truth Trade-offs] |
| **D5** | transfer is a failure | `why_prompt` on every quiz item, no exceptions | Elaborated retrieval is the cheapest lever on transfer [M6, T32] |
| **D6** | execution is a failure | Every procedural subsection carries an execution trap **and** an error-spotting quiz item | Slips in a known procedure are a detection problem, not a comprehension one [material_truth Trade-offs] |
| **D7** | detail retention is a failure | Every specific value gets a drill item | Detail loss is a retention failure at item grain [M33] |

D4 and D5 share a switch and are not redundant: one decides how a subsection
opens, the other what every question asks after it.

### 1.2 The priority ranking, applied

`priorities` is what breaks a tie no rule settles. The resolutions below are for
a ranking that puts retention first and read speed last; a different ranking
re-derives them.

- `drills/` is **required**. A course with no drill bank has no retention loop.
- `materials/expectations.md` **must** carry `exam.format`, `exam.dates` and
  `review.basis`. The scheduler needs a target; the review set needs a record.
- Genuinely ambiguous `spine` vs `depth` → `depth`. Read speed ranks last, so
  available-but-collapsed beats deleted. This does not license decoration.
- Given a choice of where to spend effort, spend it on the drill bank, not on a
  fourth explanatory paragraph.

---

## 2. What you produce

```
courses/<id>/
  course.yaml              identity, theme, state, audit ceilings, highlighting
  concepts/<key>.yaml      one file per recurring idea (M13; no cap)
  drills/<key>.yaml        one file per *reviewed* concept (M31)
  sections/
    01-<slug>/
      _section.yaml        title, blurb, primer prequestions
      1-<slug>.yaml        one subsection: blocks + quiz
  assets/                  images referenced by image blocks (inlined at build)
  materials/               study artefacts (§11)
```

**Numbering is positional.** Folder `03-…` → section id `s3`; its second file →
`s3-2`. You never write ids. **One subsection per file.**

### 2.1 What you write determines what appears

| What you write | What the reader gets |
|---|---|
| A folder under `sections/` | A section in the sidebar rail and the contents list |
| A file inside it | A subsection with its own heading and quiz |
| `blocks:` entries | The content, one reading row each, filtered by tier |
| `tier: depth` / `tier: apply` | A collapsed stub with a count, expandable in place |
| A `def` block with `term:` | An entry in the **"Before you start"** panel |
| `<a href="#s4-2">§4.2</a>` | A **margin card**, a **return pill**, a **"Builds on" chip**, a **dependency-map edge**, and a **"used later in"** card on §4.2 |
| `<c k="key">phrase</c>` | A **margin card**, a **concept hub** entry, a line in that concept's **"appears in"** list |
| `<a href="#/ece20001/s6-1">…</a>` | A plain link into **another course** |
| A `quiz:` entry | A click-to-reveal question, a **type badge**, a slot in **coverage** |
| A `drills/<key>.yaml` item | A slot in **`#/review`**, criterion tracking, mixed practice |
| `primer:` in `_section.yaml` | A **relation prequestion** with forced correction at `#/<id>/primer/<section>` |
| `why_prompt:` + the reader's confidence | The **calibration report** at `#/<id>/calibration`: the confident-and-wrong list |
| `confusable_with:` | A cluster in **mixed practice** at `#/<id>/practice` |
| Any `<a href="#s…">` or `<c k>` | An edge and a node on the **dependency map** at `#/<id>/map` |
| Every block's text | An entry in the **search index** |
| `t: figure` | A rendered diagram, plot, chart, grid or timing trace |
| *(nothing — automatic)* | The "Before you start" panel, the stepped primer, the note field, `problems.md`, `checklist.md` |

Nothing in the right column is maintained by hand [T20].

---

## 3. The procedure

Execute in order. Do not start a phase until the previous stop condition holds.

**Phase 1 — Calibrate.** Write `materials/expectations.md`, front matter first
(§11.1). State what is assumed known, bridged, taught in full, and deliberately
skipped.
*Stop: every topic appears in exactly one of skip / bridge / teach, and
`review.basis` says on what grounds the review set will be chosen.*

**Phase 2 — Sequence.** Establish the topic order from the institution's own
sources (`materials/syllabus.md` is the natural place to record it), then lay
out `sections/NN-slug/` with `_section.yaml` titles and blurbs only. Follow the institution's topic order — the reader sits that institution's
exams [M15]. The one exception is a genuine dependency violation; then bridge or
promote, and say in the blurb why the order differs. Sections run 2–5
subsections; the blurb answers "why here?".
*Stop: no forward reference exists that is not moved earlier or promoted [M14].*

**Phase 3 — Concepts and the review set.** Write `concepts/<key>.yaml` for every
idea used in three or more places (§5), then mark the subset that must survive
the semester `review: true`.
*Stop: every idea you would re-explain in three sections has a concept file, and
every concept the exam can test is marked.*

**Phase 4 — Spine.** Write spine blocks only, across every subsection — which
means writing no `tier:` at all, since spine is the default.
*Stop: the spine alone teaches the whole course. If a spine block needs
something you have not written, that thing is spine, not depth.*

**Phase 5 — Quizzes.** One item per distinct question type per subsection (§7).
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
digression while you are in the mood to write digressions.
*Stop: `npm run check` passes the spine-only render.*

**Phase 8 — Verify.** Re-derive every worked answer and every drill solution —
re-reading is not verifying [M22]. Set `verified:` dates. Run §12, then
`npm run check` and `npm run audit`.

---

## 4. `course.yaml`

```yaml
code: ECE 27000                  # short identifier, shown in the sidebar
title: Introduction to Digital System Design
tagline: One sentence: what this covers, in what order.
meta: Your University · Wakerly 5e  # institution · textbook

theme:
  hue: 200                       # optional: accent rotation, degrees (0-359)
state:
  enabled: true                  # false = stateless reference, no review loop
audit:                           # optional: fail ceilings for `npm run audit`
  unsourced: 0.1                 # absent means 1, meaning report only
  unverified: 0
  unprompted: 0
  unrouted: 0
legend:                          # optional chips on the course home page
  - {k: "1", v: logic high, cls: k1}
valueStyles:                     # optional: colour cell values in mono tables
  "1": b1
styles: |                        # optional: CSS for the classes above
  .b1{color:var(--hi-ink);font-weight:700}
syntax:                          # optional: highlighting for `code` blocks
  comment: "//"
  keywords: [module, always, assign]
  strings: true
  patterns:                      # optional: what the three above cannot catch
    - {re: "\\b\\d+'[bhd][0-9a-fA-F_]+", cls: k2}
```

Only the first four fields are required.

`theme.hue` rotates the four legend accents; lightness and chroma stay fixed, so
contrast holds at any angle [T1, T3]. A `trap` block's warning colour never
rotates: a warning is not a course's identity [T27].

**`audit:` is a ratchet.** Each key is the fraction of that population the
course tolerates before `npm run audit` fails it. Lower one as its pass lands,
and the course can never regress past what it reached.

**Do not set `state.enabled: false`** where retention ranks in `priorities` —
it gives up the review loop (§1.2).

---

## 5. Concepts — `concepts/<key>.yaml`

```yaml
term: Two's complement
body: |-
  <p>The signed encoding used by essentially all real hardware…</p>
src: Defined in §10.1
review: true                           # in the review set; owes a drill file
confusable_with: [ones-complement]     # only where readers actually confuse them
```

The filename is the key: `twos-complement.yaml` → `<c k="twos-complement">`.

**Test for a concept:** would a reader who forgot this need it re-explained in
three different sections? Yes → concept. No → `def` [M13].

A mention is a link, not decorated text. Wrap the words the sentence already
uses — `the <c k="impedance">impedance</c> of the branch` — never drop a bare
term in for the sake of the link.

### 5.1 Promotion and review are two decisions

| Decision | Rule | Cost | Cap |
|---|---|---|---|
| Promote to a concept | used in 3+ places [M13] | one file, one link | none |
| Mark `review: true` | declared, not inferred [M31] | three drill items [M26] | your judgement |

Promotion is forced by non-redundancy. Review is a scope choice: nothing says
every recurring idea must be scheduled, only what the *shape* of scheduling is
once you choose it. **Choose the review set as what the exam can test plus what
you expect to be error-prone**, and record that in `review.basis`.

The build enforces both halves: `review: true` with no `drills/<key>.yaml`
fails, a drill file whose concept is not marked warns, and a non-empty review
set with no declared basis fails. `confusable_with` must be declared on both
sides (D2).

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
      Prose. Write HTML directly — inside a literal block nothing is escaped.
quiz:
  - type: Minimise SOP
    …
```

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
| `table` | Any table; `mono: true` centres cells and colours values | `cap`, `head`, `rows`, `split`, `mono` |
| `code` | Source listings, highlighted per `syntax` | `lang`, `src` |
| `math` | A standalone equation | `tex`, `label`, `note` |
| `figure` | Anything describable as data (§10.1) | `kind`, `cap`, `spec` |
| `image` | A photograph, scan or supplied diagram | `src`, `alt`, `cap`, `credit`, `width` |
| `attempt` | A problem the reader cannot yet solve, **first block only** | `h`, `label` |

**A `label:` names the block; it does not explain it.** A word, or a short
phrase where the phrase is the name of the thing — "Common slip", "The cut
property". If it runs to a sentence, that sentence is the block's first line and
belongs in `h`.

**Two fields default, so write them only when they carry information.**
`tier:` defaults to `spine` — an absent tier *is* the declaration of it [M23] —
so write it only for `depth` and `apply`. `label:` defaults to the callout's own
name ("Definition", "Key rule", "Common mistake", "Worked example", "Note"), so
write it only to override one. Repeating a default is a line you pay for on
every write and every re-read, and it buys nothing: today it is on a fifth of
every block in the project. `id:` on a `figure` or `image` makes it citable as
`<f k="id"/>`.

**`source:` belongs on every `def`, `key` and `trap`** — those three carry the
conclusions a reader cannot catch by reading around them, they are the three
that render the badge, and they are the population `npm run audit` measures.
An absent `source:` counts against the fraction exactly as an ungrounded one
does. **It has exactly three legal shapes.**

| Value | Meaning | Counts as |
|---|---|---|
| `"Wakerly ch.4.3"` | A real, checkable origin | verified |
| `unverified` | You could not ground it and you are saying so | unverified |
| `generated` | You wrote it and could not ground it [M30] | unverified |

Use `generated` on any `def`, `key` or `trap` you drafted without a source in
front of you. It renders as a badge and counts against the unsourced fraction,
which is what stops a model-written course passing the audit at zero percent.

**Use `def` for every term you name.** It is the only block that feeds the
pre-training panel, and a term introduced in a `p` block is invisible to it
[M8, T14].

### 6.2 Order inside a subsection

```
<opener>   exactly one, first block only — or none
def        the abstract statement, retiring the opener explicitly
key        the rule that makes it usable
ex         one worked example, fully stepped
figure     the artefact that makes it concrete
trap       what goes wrong, named as a specific slip
```

Definition before example before exception. Never lead with a qualification
[M10].

**One block may precede the `def`, and only one** — a concrete anchor (`p`,
the D3 default) *or* an `attempt` (D4). Never both; an `attempt`
*is* the anchor.

**The `def` must retire the opener.** It generalises the anchor and names it a
special case, or refers back to what the `attempt` tried. This is the mechanism,
not a courtesy: an unretired anchor leaves the reader holding an instance where
they need a schema, which is the transfer failure in §1. **The anchor also names
where it breaks** — one sentence: "this stops being a good picture once X."

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

Budget: one or two `apply` blocks per concept across the whole course (D1).

### 6.4 Traps

**One or two per subsection**, and a procedural subsection needs at least one
*execution* trap (D6). Five traps in a subsection is zero traps — signaling is
a contrast effect and degrades with density [T13].

| Kind | Names | Shape |
|---|---|---|
| Conceptual | A wrong belief | "People think a prime implicant must be maximal in *size*. It must be maximal in *coverage*." |
| Execution | A slip in a procedure they already know | "The carry into the sign bit and the carry out of it are different bits. Reading the wrong one flips your overflow answer and nothing else looks wrong." |

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
  concept: prime-implicant
  q: |-
    <p>A student minimises F = Σm(0,1,4,5) like this. Which step is wrong,
    and what is the correct term?</p>
    <ol><li>Group the four corners: A′C′.</li>
    <li>Group cells 5 and 7: AB′D.</li>
    <li>Sum: F = A′C′ + AB′D.</li></ol>
  a: Step 2. Cells 5 and 7 differ in C, not D, so the term is AB′C.
  why: |-
    <p>The tempting read is that adjacent cell numbers differ in the last
    variable. Adjacency on the map is Gray-coded, not numeric…</p>
  why_prompt: Which variable actually changes between those two cells?
  verified: 2026-09-02
```

```yaml
# 2. an execution trap in the body, naming the slip itself
- t: trap
  label: Common slip
  h: |-
    <p>Cell numbers are not map coordinates. Reading adjacency off the numbers
    instead of the Gray code produces a term with the wrong variable and
    nothing else about the answer looks wrong.</p>
```

The correct procedure appears in an `ex` block earlier in the same subsection.
One error-spotting item per procedural subsection — this is a desirable
difficulty, and those work in small numbers.

---

## 7. Questions

**One question per distinct question type. Never repeat a type** [M5]. The
target is coverage of the question *surface*: a reader who can answer all of
them has met every form the examiner can use. Volume belongs in the drill bank,
which is scheduled rather than read.

To build the set, ask what the examiner can ask about this subsection. For a
procedural topic that is usually: apply forwards, apply backwards, identify
which case applies, compute a quantity, **spot the error** (required for
procedural subsections, D6), explain why the rule holds, judge a boundary case.

```yaml
- type: Detect overflow                    # names a skill, never a number
  concept: twos-complement                 # the retention identity
  q: Add 1001 and 1100 as 4-bit two's complement…
  a: 0101; overflow                        # the bare answer, no reasoning
  why: <p>Both operands negative, result positive → …</p>
  why_prompt: What did the sign bits tell you?
  verified: 2026-09-02
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
  reveal, replacing a generic "why?". Write it for every item (D5) — you already
  wrote the reasoning, and the prompt is what turns retrieval into elaborated
  retrieval.
- **`why`** explains the reasoning **and why the wrong path is tempting** [M7].
  A misconception survives an explanation that never names it.
- **`verified:`** is the date you last **re-derived** this answer [M22].

---

## 8. The drill bank — `drills/<concept-key>.yaml`

One file per concept marked `review: true`. The quiz covers the question surface
once per type; the drill bank runs the same procedure repeatedly until it is
fast, and it is the pool `#/review` draws from. These are the two loops
[code_truth §3b]: Loop A is the quiz, keyed by `type`; Loop B is the bank, keyed
by concept. A confident miss in Loop A recruits Loop B. A Loop B success never
marks a type covered.

```yaml
concept: prime-implicant          # must match a concepts/<key>.yaml
items:
  - format: short-answer          # multiple-choice | short-answer | cued-recall
                                  # | derivation | numeric
    stem: For a 3-variable function, write minterm m5 as a product term.
    answer: A B′ C
    steps:
      - "5 in binary over ABC is 101."
      - "A variable appearing as 1 is uncomplemented; as 0 it is complemented."
    why: |-
      <p>Why this holds, and what the tempting wrong answer gets wrong.</p>
    verified: 2026-09-02
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
    stem: Setup time is measured relative to which clock edge, and in which direction?
    answer: Before the active edge.
    steps: ["Setup precedes the edge; hold follows it."]
```

The test: **could the reader lose a mark by forgetting this exact thing while
understanding everything around it?** Where detail retention is a failure mode
(D7), this is the highest-yield instruction in the file.

---

## 9. The primer's prequestions

`_section.yaml` may end with questions about a **relation** the section is about
to establish, not a term — the primer's own run already covers terms [M29].

```yaml
primer:
  - ask: A four-variable K-map group covers eight cells. How many literals does its term have?
    answer: One
    why: |-
      <p>Each doubling of a group removes one literal.</p>
```

The correction is not optional and the build enforces it: an uncorrected
conceptual pretest error is *more* likely to be repeated later than one never
asked. Ask only about what you want retained — the benefit does not generalise
to the rest of the section. **Write one or two.** A prequestion set that covers
the section is just the section asked backwards.

---

## 10. Figures, maths, images, colour, cross-course links

### 10.1 Figures

| `kind` | For | `spec` |
|---|---|---|
| `graph` | State machines, block diagrams | `nodes`, `edges`, `layout`, `r`, `w` |
| `plot` | Functions or measured series | `series:[{label, fn \| points, from, to}]`, `xlabel`, `ylabel` |
| `flow` | Processes and pipelines | `steps:[{label, note}]`, `dir` |
| `grid` | Labelled 2-D grids with highlighted groups | `rowVars`, `colVars`, `rowLabels`, `colLabels`, `cells`, `index`, `groups` |
| `timing` | Digital waveforms | `signals:[{name, wave:"0101"}]`, `unit` |
| `bar` | Magnitudes across labelled categories | `bars:[{label, value, accent}]`, `ylabel`, `max` |
| `scatter` | How two measured quantities relate | `series:[{label, points}]`, `trend: true` |
| `matrix` | Bracketed matrices | `rows` |
| `svg` | Anything the others cannot express | `body`, `viewBox` |

**A figure must carry information the prose does not** [M17]. A decorative
diagram costs attention and returns nothing; removing it improves learning.

Use `note` on graph nodes only when there are few — past about eight they
collide, so prefer `title` (a hover tooltip). Cite a figure by giving it `id:`
and writing `<f k="that-id"/>`; numbering is automatic and section-scoped, and
the build fails on an unknown or duplicate id.

### 10.2 Maths

Write TeX, not HTML. It renders at build time, so a formula that does not
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
[M19] — describe what the image *shows*. Prefer a `figure` where the content can
be described as data [M18].

### 10.4 Colour

If you add CSS through `course.yaml`: **ink** variants (`--hi-ink` `--lo-ink`
`--dc-ink` `--hz-ink`) for text, vivid accents (`--hi` `--lo` `--dc` `--hz`) for
borders, fills and graphics [T3]. `npm run contrast` walks every rendered text
node in three colour modes and fails below AA, so this is checked rather than
trusted. **Colour never carries meaning alone** [T26].

### 10.5 Linking to another course

```yaml
h: |-
  The theory is <a href="#/ece20001/s6-1">first-order transients</a> in the
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
| `expectations.md` | Calibration, grading, exam format and dates, review basis | **required** (M3) |
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
  dates: []      # fill from the syllabus; they vary by term
review:
  basis: >-
    Everything the two midterms can test, plus Boolean algebra identities,
    which are error-prone under time pressure.
---
```

`format` drives the drill-format coverage check. `dates` turn the scheduler
around to aim at the exam: no interval steps over one, so course home can report
predicted recall *on the day* [T17]. Leave `dates` blank rather than guessing.
`review.basis` records why the review set is what it is [M31] and the build
fails without it once anything is marked for review.

### 11.2 Calibrating depth

Recorded in `expectations.md` in Phase 1:

- **Skip** what the reader demonstrably knows, and say that you skipped it.
- **Bridge** what they know informally but not rigorously: a short subsection.
- **Teach fully** everything else.

The most common failure is teaching to the median student instead of the actual
reader. Over-explaining known material costs attention the hard parts need.

---

## 12. Self-check before you emit

### 12a. Gated — a build failure catches these

**Per subsection**

- [ ] Every `<c k="…">` names a concept file that exists
- [ ] Every `#s…` points at a real section or subsection
- [ ] At least one quiz item, no repeated `type`, every item has `type`, `q`,
      `a`, `why`, and any `concept:` resolves
- [ ] `attempt` blocks appear only as the first block (M10)
- [ ] Every `def` names a term; every subsection names at least one
- [ ] Every block declares a tier the lane selector knows
- [ ] Every `<m>` and `math` block compiles; no `<m>` in a `mono`/`map` table

**Per reviewed concept** (`review: true`)

- [ ] `drills/<key>.yaml` exists with ≥3 items, ≥2 formats, ≥1 exam-format
- [ ] No two items share an answer; no stem contains its answer
- [ ] Every item has `steps`
- [ ] `confusable_with` is declared on both sides

**Per course**

- [ ] `expectations.md` has `exam.format`, `exam.dates` and `review.basis`
- [ ] Spine-only reading resolves every reference (M23, T33)
- [ ] `npm run audit` is inside every ceiling `course.yaml` declares

### 12b. Author judgement — ungated

No script decides any of these. Skip this list and nothing else catches it.

- [ ] **The opener is retired**, and **the anchor names where it breaks** (§6.2)
- [ ] **The traps are traps**, one or two, and a procedural subsection has an
      execution trap and an error-spotting item (§6.4, §6.5). No script detects
      "procedural".
- [ ] **The quiz types are actually distinct.** Could a reader answer one and
      fail another? If not, they are one type in two labels (§14.3).
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
      (§13.3), "you" ≥ 6 per 1000 words (§13.1 — the finding is transfer at
      d = 0.54, not friendliness), and no `key` or `def` block of four sentences
      without one under ten words. Read one block aloud. If three sentences in a
      row land at the same length, that is the defect.

```sh
npm run check      # must be clean
npm run audit      # read the four fractions and the M33 warnings
npm run shots      # look at it: did figures draw, is the primer right,
                   # is any section a wall of undifferentiated p blocks
```

### Quality bar

A finished subsection lets a reader (1) say what the thing is, from `def`;
(2) use it, from `key` + `ex`; (3) recognise where it goes wrong, from `trap` +
the error-spotting item; (4) answer every distinct question type, from `quiz`;
and (5) still do it in six weeks, from `drills/`. The fifth is the one that gets
skipped.

---

## 13. The sentence

§14 catalogues defects in *what* a subsection contains. This section is about
the sentence that carries it. That is where a reader decides whether a person
wrote this for them or a machine produced it at them, and they decide it inside
the first paragraph, before any of the structure above has had a chance to work.

The cost is not aesthetic. Prose that reads as generated is prose the reader
discounts, and a reader who is discounting is not encoding.

### 13.1 Three findings, and what each one licenses

**Address the reader.** Rewrite instructional text from formal to conversational
style, mainly by moving to second person and speaking to the learner directly,
and retention improves at d = 0.30 and **transfer at d = 0.54**, against the
same content in formal style (Ginns, Martin & Marsh 2013, *Educational
Psychology Review*, meta-analysis). Transfer is the larger of the two. Where
transfer is among the reader's failure modes it is already what D4 and D5 spend
budget on (§1.1). Second person is a lever on the same outcome, and it is free.

**Cut the clause that adds nothing.** Sentence-level coherence measures
g = 0.63, the largest of the layout effects, and it is subtractive [T11]. A
clause carrying nothing the reader will be asked for is not neutral. It is a
cost.

**The machine tell is a habit, not a vocabulary.** Of the 379 excess style words
that appeared in biomedical abstracts in 2024, 66% were verbs and 14% were
adjectives. Excess vocabulary from a genuine change of subject matter runs 79.2%
nouns (Kobak et al. 2025, *Science Advances*, 15M abstracts). What marks
generated prose is therefore a preference for certain verbs and modifiers, which
is to say a preference for one sentence shape. You cannot fix that by avoiding
"delve". You fix it by changing the shape.

### 13.2 What this repo's own courses measure

Counted over the prose fields of every course here, code and maths excluded:

| | measured | target |
|---|---|---|
| em dashes per 1000 words | 6–15 | **≤ 3** |
| sentences ending in a hung tail | 15–24% | **≤ 5%** |
| "you" per 1000 words | 1.8–20.6 | **≥ 6** |
| sentences under 10 words | 19% | keep it there |

The two longest courses are the two most impersonal, at 1.8 and 2.6 "you" per
1000 words. They are also where a reader spends the most hours.

These targets are for course prose, not for code comments. A comment is read
once, by someone who chose to open the file. A `key` block is read by someone
under load who is about to be tested on it. The engine's own source is written
to a different brief and is not the model here.

**This section meets its own numbers.** Count them if you like. That is the only
reason to believe they are reachable.

### 13.3 The hung tail

One defect dominates, and it is why the prose reads as generated. A sentence
states its point, then hangs a second clause off the end that glosses,
editorialises or draws a moral. Three real examples, from courses in this repo:

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

The end of a sentence is the **stress position**. "In the stress position the
reader needs and expects closure and fulfilment" (Gopen & Swan 1990, *American
Scientist* 78:550–558). It is where the reader puts what they will remember.
Spend it on a gloss and you have spent the only slot that sentence had.

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
it up. The shape `the <X>ion/ment/ance of` occurs 41 times in this repo's
courses. Not all are defects, since `the impedance of` is the name of a
quantity, but it is the reliable place to look.

| instead of | write |
|---|---|
| the definition of a full tree is | a full tree is |
| performs a comparison of | compares |
| is responsible for handling | handles |
| there is a requirement that | must |
| serves as / acts as / functions as | is |

"Readers interpret any information between the grammatical subject of a sentence
and its verb as an unimportant interruption" (Gopen & Swan). Put the thing the
sentence is about first. Put its verb next. Put the new information last.

### 13.6 Words to distrust

This is not a blacklist, and §13.1 says why a blacklist is the wrong instrument.
These are the markers that showed up in this corpus, or that top the
excess-vocabulary list. Each one is a prompt to check the shape of the sentence
rather than to reach for a synonym.

`crucial` · `essential` · `vital` · `pivotal` · `paramount` · `robust` ·
`seamless` · `leverage` · `utilise` · `delve` · `realm` · `landscape` ·
`tapestry` · `testament` · `showcase` · `underscore` · `intricate` ·
`meticulous` · `it is important to note` · `it is worth noting` ·
`serves as` · `the fact that` · `in order to`

`crucial`, `essential` and `vital` are the common case, and they are one error
committed three ways. The sentence is asserting importance instead of
demonstrating it. If a thing matters, the reason it matters is the sentence you
should have written. If you cannot state that reason, it does not matter here.

A hedge is a defect in the *claim* rather than in the sentence. Hedges are
caught at §14.6.

### 13.7 Read a human first

Before your first `p` block of a course, read one page of one of these. Not for
the subject. For the cadence.

**Richard Feynman**, *The Feynman Lectures on Physics* I.1, "Atoms in Motion",
at [feynmanlectures.caltech.edu/I_01.html](https://www.feynmanlectures.caltech.edu/I_01.html).
His answer to what one sentence he would pass on carries the whole atomic
hypothesis: "all things are made of atoms—little particles that move around in
perpetual motion, attracting each other when they are a little distance apart,
but repelling upon being squeezed into one another." The next sentence is short,
and it tells you what to do with the long one: "In that one sentence, you will
see, there is an enormous amount of information about the world, if just a
little imagination and thinking are applied." **Steal:** one long sentence that
is all content, then a short one that is all instruction. The long sentence
earns its length. Nothing in it is a gloss.

**Paul Halmos**, "How to Write Mathematics", *L'Enseignement Mathématique* 16
(1970). Eighteen principles, and the headings alone are most of the lesson.
Eleven of them: *Say something. Speak to someone. Organize first. Write in
spirals. Write good English. Honesty is the best policy. Down with the
irrelevant and trivial. Do and do not repeat. Use words correctly. Resist
symbols. Stop.* **Steal:** "Speak to someone" is §1 of this file, and it is
13.1's d = 0.54. "Stop." is 13.3.

**Julia Evans**, "Patterns in confusing explanations", at
[jvns.ca/blog/confusing-explanations](https://jvns.ca/blog/confusing-explanations/).
Thirteen named patterns, several of them truths in this repo arrived at
independently. *Starting out abstract* is M10 and D3. *Unsupported statements*
is M20 and M28. *"What" without "why"* is M6 and M7. **Steal:** the register. Short declaratives, second person, and a
willingness to say that a thing is confusing. Her note on audience is the whole
of §1 in one line: "writing that's easy to understand for 1 person (other than
you!) has a good chance of being easy to understand for many other people as
well."

**Mechanism, if you want it.** Gopen & Swan, "The Science of Scientific
Writing", *American Scientist* 78 (1990): 550–558, at
[crowl.org/lawrence/writing/GopenSwan90.html](http://www.crowl.org/lawrence/writing/GopenSwan90.html).
Six sections and no numbered rules. It explains why the tests in 13.3 and 13.5
work, instead of asserting them.

---

## 14. Failure modes

The shapes a capable model produces by default. Each is a real defect.

**14.1 Encyclopedic drift.** You will write balanced survey prose covering a
topic from all sides. A course teaches one reader one thing in an order. If a
paragraph would sit unchanged in a Wikipedia article, it is wrong here.

**14.2 The example that re-explains.** You will open a worked example by
restating the definition. Most common non-redundancy violation there is. The
example starts at the first step of the work.

**14.3 Fake variety in the quiz.** Asked for distinct types you will write the
same question three times with different numbers and different `type` labels.

**14.4 Trap inflation.** You will mark every caution as a `trap` because traps
look valuable. One or two.

**14.5 Depth as a dumping ground.** You will push anything long into `depth`.
The rule is examinability, not length.

**14.6 Hedged claims.** "Generally", "typically", "in most cases". In a study
course a hedge is a claim the reader cannot use. Name the condition, or write
`unverified`.

**14.7 Confident fabrication of institutional fact.** A plausible grading split,
a plausible exam date, a plausible textbook edition. Do not (0.3).

**14.8 Manufactured confusability.** Any two concepts in a course are relatable.
Only pairs readers actually mix up (D2).

**14.9 The four-example subsection.** You will add worked examples when a topic
feels hard. Where schema acquisition is not the failure mode that is the wrong
lever (D1). Write one example and three drill items.

**14.10 Skipping Phase 6.** Drills are the least interesting thing here and the
most important one for the stated priorities. A course that stops after Phase 5
is a well-made document with no retention loop.

**14.11 Marking everything for review.** The inverse failure. `review: true` on
every concept turns twenty concepts into sixty drill items, most about things
the exam never asks. The cap is judgement, which is exactly why you overshoot it.

**14.12 Density drift.** The sections you write first set a prose density; by the
fortieth you are writing `key` blocks half again as long, the same point carried
by a second example, a restated setup and a "which is exactly why" tail. It
reads as a looser course bolted onto a tight one. Checks: a `key` block is two
to four sentences; a subsection runs three or four blocks of a kind, not five.
Five `key` blocks means two are one rule split in half — merge them. Calibrate
against the sections already shipped. The cut is the improvement, as long as no
fact, number, mechanism, failure mode or trap leaves with it.

---

## 15. When data is not enough — `blocks.js`

Almost never. First check that a `figure` kind, a `table` with `map:`, or a
`def`/`key`/`ex` block genuinely cannot express what you want. The built-ins
have covered every course but one without a line of JavaScript.

The exception is a renderer about *shape* rather than about data. ECE 20001
draws circuit schematics, which are topology and symbols; no table
configuration produces those.

```js
export default function (Blocks, U) {
  Blocks.register("schematic", {
    render: b => `<div class="figure">…svg…</div>`
  });
}
```

Style it from `styles:` in that course's own `course.yaml`, so the engine keeps
no opinion about circuit symbols. `validate.mjs` reads the registered names out
of your `blocks.js`, so a typo in a block type is still caught.
