/* Content zoom.
 *
 * Browser page zoom scales the chrome along with the prose, so magnifying the
 * text also magnifies the sidebar and the toolbar and the reading column ends
 * up no wider than it started. For a reading tool that is the wrong trade: the
 * navigation is a fixed cost and the material is what the reader wants more of.
 *
 * Ctrl/Cmd +, - and 0 are therefore intercepted and applied to the content
 * column alone. At either end of the scale the key is left to the browser, so
 * page zoom is still reachable rather than swallowed.
 */
import { getItem, setItem } from "./store.js";
const STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];
const KEY = "contentZoom";

export const readZoom = () => {
  try {
    const v = parseFloat(getItem(KEY));
    return STEPS.includes(v) ? v : 1;
  } catch { return 1; }
};

const store = z => setItem(KEY, String(z));

/** the next step in `dir`, or null when there is none left to take */
function stepZoom(current, dir) {
  const i = STEPS.indexOf(current);
  const next = STEPS[(i < 0 ? STEPS.indexOf(1) : i) + dir];
  return next === undefined ? null : next;
}

/** returns the new zoom, or null if the key should fall through to the browser */
export function zoomFromKey(e, current) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.key === "0") return current === 1 ? null : 1;
  const dir = (e.key === "=" || e.key === "+") ? 1 : e.key === "-" ? -1 : 0;
  if (!dir) return null;
  return stepZoom(current, dir);
}

export function applyZoom(z) {
  document.documentElement.style.setProperty("--zoom", String(z));
  store(z);
}
