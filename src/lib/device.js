/* This device's identity, and nothing more.
 *
 * Sync works because no device ever writes another device's rows: the id is
 * the first segment of every log row's key, so two devices cannot collide and
 * a merge is a union rather than a conflict resolution. It is random and
 * meaningless on purpose — it identifies a browser profile, not a person.
 */
import { getItem, setItem } from "./store.js";

const KEY = "device:id";

export function deviceId() {
  let id = getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 8);
    setItem(KEY, id);
  }
  return id;
}
