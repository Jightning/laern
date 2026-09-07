---
# Read by the build. `format` drives the drill-format coverage check; `dates`
# turn the scheduler around to aim at the exam, so no interval steps over one.
# Fill the dates in from your syllabus — they vary by term, so they are blank
# rather than guessed.
exam:
  format: [short-answer, multiple-choice]
  dates: []
# Why the review set is what it is. Every concept marked `review: true` owes
# three drill items, so the set is a scope decision and has to be recorded:
# an undeclared one is a guess about what matters in six weeks that nobody can
# check. The defensible middle is what the exam can test, plus what you expect
# to be error-prone.
review:
  basis: >-
    Replace this. Name the grounds on which concepts were marked for review —
    typically everything the exams can test, plus the ideas that are
    error-prone under time pressure.
---

# What this course assumes, bridges, and teaches

Written first, before any section. Depth is a function of the reader, so a
course written before this file is calibrated to nobody.

## Assumed known

What the reader demonstrably already has, and is therefore not taught.

## Bridged

What they know informally but not rigorously: a short subsection each, not a
full treatment.

## Taught in full

Everything else.

## Grading

Weights vary by term and instructor. Copy the real numbers from your syllabus
rather than guessing them — a confidently wrong weight is worse than a blank.
