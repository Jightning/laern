/* ============================================================================
 * tools/lib/prune.mjs — delete the deployments a deploy leaves behind
 *
 * Cloudflare never expires a deployment, so every one of them keeps serving
 * whatever was public when it was made. Pruning is the only thing standing
 * between an old build and the open internet, which is why it is worth its own
 * file and its own test.
 *
 * Two things about `wrangler pages deployment delete` make the obvious
 * implementation wrong, and both fail *quietly*:
 *
 *   1. It asks for confirmation. With no TTY it answers itself — "Using
 *      fallback value in non-interactive context: no" — and deletes nothing.
 *      `--force` is what skips the prompt (its help text only advertises the
 *      active-alias case).
 *   2. Either way it exits 0. A shell-out that trusts the exit code reports a
 *      successful purge of deployments that are all still online, which is
 *      exactly how this went unnoticed: two deploys in a row announced the
 *      same list.
 *
 * So success is read out of the output, not the exit code.
 * ==========================================================================*/

/* Wrangler prints this, and only this, when a deployment is actually gone. */
const DELETED = /Successfully deleted deployment/i;

/** Delete every deployment past the newest `keep`.
 *
 * `run(args)` runs wrangler and returns its combined output; it may throw.
 * Returns one result per stale deployment, newest first, so the caller does
 * the printing and decides what a failure is worth. */
export function prune(project, deployments, keep, run) {
  const stale = deployments.slice(Math.max(1, keep));
  return stale.map(d => {
    try {
      const out = run(["pages", "deployment", "delete", d.Id,
                       "--project-name", project, "--force"]);
      return DELETED.test(out)
        ? { id: d.Id, status: d.Status, ok: true }
        : { id: d.Id, status: d.Status, ok: false, error: firstLine(out) };
    } catch (e) {
      return { id: d.Id, status: d.Status, ok: false, error: firstLine(e.message) };
    }
  });
}

/* Wrangler's failures are one useful line under a banner of dashes and emoji. */
const firstLine = (text = "") =>
  String(text).split("\n").map(l => l.trim())
    .filter(l => l && !/^[─-]+$/.test(l) && !/^.?.?wrangler \d/.test(l))
    .pop() || "no output";
