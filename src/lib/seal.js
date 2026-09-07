/* ============================================================================
 * src/lib/seal.js — the envelope, and nothing about where it is sent
 *
 * Everything that leaves a device goes through here first. It is a separate
 * file from lib/cloud.js because it has no business knowing about storage,
 * endpoints or policy: it takes a secret and a value and returns a string, and
 * that narrowness is what lets it be tested for real rather than mocked.
 *
 * AES-GCM, because it authenticates as well as encrypts: a tampered payload
 * fails to open rather than opening as something else. The key is derived from
 * the reader's secret with PBKDF2 — the secret is typed by a human, so a fast
 * KDF would make offline guessing worthwhile.
 *
 * The salt is fixed. A random one would have to be stored somewhere every other
 * device could read, which on a public origin means storing it with the
 * ciphertext, which is where an attacker already is; against offline guessing
 * the iteration count is what does the work.
 * ==========================================================================*/
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = bytes => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** A key from a human secret. Derive once per secret and keep it; this is slow on purpose. */
export async function deriveKey(secret) {
  if (!secret) throw new Error("no secret");
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2",
    false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("learn-sync-v1"), iterations: 210000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** value -> base64(iv || ciphertext). A fresh iv every call, as GCM requires. */
export async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value))));
  const joined = new Uint8Array(iv.length + out.length);
  joined.set(iv); joined.set(out, iv.length);
  return b64(joined);
}

/** The inverse. Throws on the wrong key or a modified payload. */
export async function open(key, text) {
  const raw = unb64(text);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return JSON.parse(dec.decode(plain));
}

/* A course's identity is its *content*. Hashing the sealed bytes would change
   with every fresh iv, so every upload would look like an edit and the whole
   point of comparing versions — not transferring what has not changed — would
   be lost. */
export async function versionOfFiles(files) {
  const canon = JSON.stringify(Object.keys(files).sort().map(k => [k, files[k]]));
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(canon));
  return [...new Uint8Array(digest)].slice(0, 8)
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
