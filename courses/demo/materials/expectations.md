---
exam:
  format: [short-answer, multiple-choice]
  dates: []
review:
  basis: >-
    Four ideas are scheduled, and they are the four a reader has to hold to use
    the site at all: completeness and non-redundancy, because they explain why
    material is where it is; the tier split, because it decides how much of a
    page you read; and confidence, because it is what turns an answer into a
    diagnosis. The two-loop design and retrieval practice are explained but not
    scheduled — knowing they exist is enough, and drilling them would spend
    three items each on something no reader acts on directly.
---

# What this course is for

`demo` ships with the site. It has two jobs, in this order: teach a new reader
how the site works, and exercise every feature the engine offers so that nothing
ships unrendered.

§1 is the first job and stands alone — a reader who stops after it can use every
part of the site. §2 and §3 are why it behaves that way, for someone deciding
whether to trust it or to write a course of their own. §4 and §5 are the
catalogue: every figure kind, every block type, every source badge, rendered
once, using the system's own philosophy as material.

## The reader

Two readers, and the order of the sections is the split between them.

- **Someone about to study from a course here.** §1 only. Assumed known:
  nothing about this site; how to open a web page.
- **Someone deciding whether to author a course.** All five. Assumed known: how
  to edit a YAML file, and the idea of spaced repetition in outline.

- **Taught in full:** how to read, answer, review, and navigate a course, and
  what each block type and figure kind looks like on the page.
- **Not taught here:** how to *write* one. `docs/create_course.md` and the two
  truth files are the procedure; this course is what the procedure produces.

## `exam.dates` is deliberately empty

A course may declare no exam dates and stay valid; the scheduler simply runs
without a deadline to aim at. This one leaves the array empty to show that path.

## Skip / bridge / teach

Not meaningful in the usual sense — there is no prior course to bridge from.
The sections are ordered by who needs them: §1 using the site, §2 the two rules
it is built on, §3 the research behind the two loops and the tiers, §4 the nine
figure kinds, §5 the remaining blocks and the edge-case displays.
