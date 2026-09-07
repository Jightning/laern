/* ============================================================================
 * functions/api/_shared.js — what both endpoints need before they do anything
 *
 * The deployment is a public website. These two routes are the only part of it
 * that is not, and everything private about the account sits behind them, so
 * the order of operations here is the whole security property: authenticate
 * first, touch a binding second. A request without the secret must cost one
 * string comparison and nothing else — no D1 statement, no read, no write.
 *
 * The secret is the account owner's, set once as a Cloudflare secret:
 *
 *   npx wrangler pages secret put SYNC_SECRET
 *
 * A reader who never has it gets 401 on every route and a site that works
 * exactly as before — the whole app runs on IndexedDB, and sync is the only
 * thing they are missing. That is deliberate: the backend is one person's
 * backup, not a service the site offers.
 * ==========================================================================*/

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

/* Constant time, and length-safe: a bare `===` on secrets leaks their length
   through timing, and comparing different lengths byte-by-byte would throw. */
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The gate. Returns null when the caller is the owner, or a Response to send.
 * Callers must return that Response before doing anything else.
 */
export function guard(request, env) {
  /* No secret configured means the backend is not in use. Answering 404 rather
     than 401 keeps a bare deployment from advertising that sync exists. */
  if (!env || !env.SYNC_SECRET) return json({ error: "not found" }, 404);

  const sent = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!sameSecret(sent, env.SYNC_SECRET)) return json({ error: "unauthorized" }, 401);

  /* A window the owner opens, so the endpoint is inert the rest of the time.
     Absent means always open — the check costs nothing when unused. */
  const until = Number(env.SYNC_OPEN_UNTIL || 0);
  if (until && Date.now() > until) return json({ error: "sync window closed" }, 503);

  return null;
}

/** Bounded read of a JSON body: a malformed or oversized payload is refused. */
export async function body(request, maxBytes = 4 * 1024 * 1024) {
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("payload too large");
  try { return JSON.parse(raw); } catch { throw new Error("bad json"); }
}

/* A tombstone is a restore window, not a promise: after this it is gone for
   good. Purging runs inside an authenticated request rather than on a
   schedule, because a scheduled trigger is a request too and this costs
   nothing on a call that was happening anyway. */
export const BIN_DAYS = 30;

export async function purgeBin(db, now = Date.now()) {
  const cutoff = now - BIN_DAYS * 864e5;
  const dead = await db.prepare(
    "SELECT id FROM courses WHERE deleted_at IS NOT NULL AND deleted_at < ?").bind(cutoff).all();
  const ids = (dead.results || []).map(r => r.id);
  if (!ids.length) return 0;
  const marks = ids.map(() => "?").join(",");
  await db.batch([
    db.prepare(`DELETE FROM course_chunks WHERE id IN (${marks})`).bind(...ids),
    db.prepare(`DELETE FROM courses WHERE id IN (${marks})`).bind(...ids)
  ]);
  return ids.length;
}

/** Course ids come from the network and are used in keys: keep them boring. */
export const okId = id => typeof id === "string" && /^[\w-]{1,64}$/.test(id);
