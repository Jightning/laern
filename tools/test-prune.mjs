#!/usr/bin/env node
/* The deploy prune, against a wrangler that behaves like the real one.
 *
 *   node tools/test-prune.mjs
 *
 * This exists because the bug it guards against is invisible from the outside:
 * `wrangler pages deployment delete` answers its own confirmation prompt with
 * "no" when there is no TTY, prints that it did, and exits 0. A prune that read
 * the exit code announced a successful purge for weeks while every deployment
 * it named stayed online — the only tell was the list getting longer each time.
 *
 * So the fake below is written to be wrong in exactly that way: it deletes only
 * when `--force` is present, and exits 0 regardless. A prune that passes these
 * checks cannot report a deletion that did not happen.
 */
const fail = [];
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name} ${extra}`); fail.push(name); }
};

const { prune } = await import("./lib/prune.mjs");

const deployments = ["aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd"]
  .map((Id, i) => ({ Id, Status: i ? "2 days ago" : "Active" }));

/* wrangler 4.x, reduced to the two branches that matter. Records what it was
   asked to do so the calls themselves can be asserted. */
const wrangler = (log = []) => {
  const run = args => {
    log.push(args);
    const id = args[3];
    return args.includes("--force")
      ? `\n ⛅️ wrangler 4.131.0\n────────────────────\nDeleting deployment ${id}...\nSuccessfully deleted deployment ${id}\n`
      : `\n ⛅️ wrangler 4.131.0\n────────────────────\n? Are you sure you want to delete deployment "${id}" in project "learn"? This action cannot be undone.\n🤖 Using fallback value in non-interactive context: no\n`;
  };
  run.log = log;
  return run;
};

/* --- what gets deleted -------------------------------------------------- */
const run = wrangler();
const res = prune("learn", deployments, 2, run);

check("everything past the newest KEEP is attempted", res.length === 2, String(res.length));
check("the newest KEEP are not touched",
      run.log.every(a => a[3] !== "aaaaaaaa" && a[3] !== "bbbbbbbb"),
      JSON.stringify(run.log.map(a => a[3])));
check("the deletes are reported in list order",
      res.map(r => r.id).join() === "cccccccc,dddddddd", res.map(r => r.id).join());
check("each delete names the project", run.log.every(a => a.includes("--project-name") && a.includes("learn")));
check("each delete passes --force", run.log.every(a => a.includes("--force")),
      JSON.stringify(run.log[0]));
check("a successful delete is reported ok", res.every(r => r.ok === true));
check("the status is carried through for printing", res[0].status === "2 days ago", res[0].status);

/* --- the silent failure ------------------------------------------------- */
/* The regression itself: wrangler declines, says so, and exits 0. */
const declining = args => wrangler()(args.filter(a => a !== "--force"));
const declined = prune("learn", deployments, 2, declining);
check("a prompt answered 'no' is not reported as a deletion",
      declined.every(r => r.ok === false), JSON.stringify(declined));
check("the refusal line is what gets shown",
      /fallback value in non-interactive context: no/.test(declined[0].error), declined[0].error);

/* An API error arrives as a throw; a prune that let it escape would abandon the
   remaining deployments halfway through. */
const throwing = args => {
  if (args[3] === "cccccccc") throw new Error("Command failed\nA request to the Cloudflare API failed [code: 8000000]");
  return wrangler()(args);
};
const mixed = prune("learn", deployments, 2, throwing);
check("a throwing delete is a failed result, not a crash",
      mixed[0].ok === false && /Cloudflare API failed/.test(mixed[0].error), JSON.stringify(mixed[0]));
check("a throw does not stop the ones after it", mixed[1].ok === true, JSON.stringify(mixed[1]));

/* --- the edges ---------------------------------------------------------- */
check("nothing to prune runs no commands", prune("learn", deployments.slice(0, 2), 2, wrangler()).length === 0);
check("an empty list is a no-op", prune("learn", [], 2, wrangler()).length === 0);
/* KEEP=0 would delete the deployment the alias points at, taking the site down. */
const zero = prune("learn", deployments, 0, wrangler());
check("KEEP below 1 still keeps the newest", zero.length === 3, String(zero.length));

console.log(fail.length ? `\n${fail.length} failed` : "\nall passed");
process.exit(fail.length ? 1 : 0);
