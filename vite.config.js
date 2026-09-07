import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCourse } from "./tools/lib/load.mjs";
import { courseFiles, PUBLIC } from "./tools/lib/files.mjs";

/* ---------------------------------------------------------------- courses --
 * A course ships as the files it is written in — one JSON per course holding
 * a map of path to text — and is parsed in the browser by src/lib/parse.js.
 *
 * Nothing is compiled here any more. Rendering TeX at build time cost 16x in
 * size (ma26600: 458KB of YAML became 7.3MB) to save 54-87ms of phone CPU per
 * subsection, which is the wrong trade the moment a course is something a user
 * imports, edits and syncs rather than something the operator bakes in.
 *
 * The courses are still read here, but only to derive `INDEX`: the scalars the
 * library card and the cross-course due count need before any course is opened.
 */
/** The scalars every view needs before a course is fetched. */
function indexOf(course, id) {
  const subs = (course.sections || []).reduce((n, s) => n + s.subs.length, 0);
  const questions = (course.sections || []).reduce((n, s) =>
    n + s.subs.reduce((m, u) => m + (u.quiz || []).length, 0), 0);
  return {
    code: course.code || id,
    title: course.title || id,
    tagline: course.tagline || "",
    theme: { hue: Number((course.theme || {}).hue) || 0 },
    meta: course.meta || "",
    state: course.state || {},
    retention: course.retention || {},
    sections: (course.sections || []).length,
    subs, questions,
    drillKeys: Object.keys(course.drills || {})
      .filter(k => ((course.drills[k] || {}).items || []).length)
  };
}

function coursesPlugin() {
  const VID = "virtual:courses";
  const RESOLVED = "\0" + VID;
  const dir = join(process.cwd(), "courses");
  let serving = false;

  return {
    name: "courses",
    configResolved(cfg) { serving = cfg.command === "serve"; },
    resolveId: id => (id === VID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      const ids = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith("_"))
        .map(d => d.name);

      const index = {}, order = [];
      for (const c of ids) {
        const { course, errors } = loadCourse(join(dir, c));
        if (errors.length) this.error(`${c}: ${errors.join("; ")}`);

        /* Absence is privacy. The deployment holds only the courses named in
           PUBLIC; everything else stays on the author's machine and reaches
           their devices by import. A course cannot opt itself in — there is no
           setting for it — so no edit to course.yaml can expose material. */
        if (!PUBLIC.has(c)) continue;

        index[c] = indexOf(course, c);
        order.push(c);
        /* emitFile is build-only; the dev server answers the same URLs from
           disk in configureServer below. */
        if (!serving) this.emitFile({
          type: "asset",
          fileName: `courses/${c}.json`,
          source: JSON.stringify(courseFiles(join(dir, c), m => this.error(`${c}: ${m}`)))
        });
      }
      return `export const INDEX = ${JSON.stringify(index)};\n` +
             `export const ORDER = ${JSON.stringify(order)};\n`;
    },
    configureServer(server) {
      /* Without this, `vite dev` falls through to the SPA handler and answers
         a course request with index.html — a 200 that is not JSON, which fails
         far from its cause. */
      server.middlewares.use((req, res, next) => {
        const m = /^\/courses\/([\w-]+)\.json$/.exec((req.url || "").split("?")[0]);
        if (!m || !existsSync(join(dir, m[1]))) return next();
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(courseFiles(join(dir, m[1]), console.error)));
      });

      server.watcher.add(dir);
      server.watcher.on("all", (_e, file) => {
        if (!file.startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    }
  };
}

/* Font stylesheets list woff2, woff and sometimes truetype for every face, and
   the bundler inlines whatever it finds. Shipping all three put roughly a
   megabyte of duplicate fonts in a page that only ever runs in a browser new
   enough for woff2 — the same browser the oklch palette already requires. */
function woff2Only() {
  return {
    name: "woff2-only",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes(".css") || !code.includes("@font-face")) return null;
      /* minified CSS ends the last declaration of a block with `}`, not `;`,
         and `src` is the last one in every @font-face KaTeX ships */
      return code.replace(/src:([^;}]*)([;}])/g, (whole, list, end) => {
        const w2 = /url\(([^)]*\.woff2)\)/.exec(list);
        return w2 ? `src:url(${w2[1]}) format("woff2")${end}` : whole;
      });
    }
  };
}

export default defineConfig({
  root: "src",
  plugins: [woff2Only(), preact(), coursesPlugin()],
  build: { outDir: "../dist", emptyOutDir: true, cssCodeSplit: false }
});
