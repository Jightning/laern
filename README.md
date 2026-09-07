# Learn

A site for more optimized learning. A course gets imported and displayed in nice and structured fashion. This functions as a study tool for both long and short term learning.

A course is this specific thing you want to learn/study (like a class, or certain subject). The courses themselves have a specific file structure. You can ask an AI to design the course by giving it the needed content, and then providing it the instructions in `docs/create_course.md` (the AI must be able to create/edit files). The courses and quiz data stays locally in your browser. You can sync it with another device using Tailscale (below).

Each course will be split into sections with quizzes after each section. The section quizzes will be unique, with repetition practice as something separate.

## Writing a course

To start working on a course:

```sh
#               id       name
npm run new -- ma26600 "Ordinary Differential Equations"
```

This will add a course to `courses/ma26600`.

[This document](docs/create_course.md) details how to write out a course.
The changes can be validated with:

```sh
npm run check
```

**Write the course with AI:** `docs/create_course.md` details what the model should do, while
`npm run author` walks through the creation process one piece at a time for better token efficiency.

Lastly import your course to actual site (stored via indexedDB, if you don't use it for a week it'll get deleted so careful).

## Development

Developing:

```sh
npm install
npm run dev
```

Building:

```sh
npm run build  # for dist/
npm run deploy  # builds, publishes to Cloudflare Pages, and keeps 2 newest deployments
```
