import { render } from "preact";
import App from "./app.jsx";
import { init, flush, onError, durable } from "./lib/store.js";
import { auto } from "./lib/cloud.js";
import { refresh } from "./lib/library.js";

/* one stylesheet per UI element; filename order is load order */
import "@fontsource/ibm-plex-serif/latin-400.css";
import "@fontsource/ibm-plex-serif/latin-400-italic.css";
import "@fontsource/ibm-plex-serif/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "katex/dist/katex.min.css";

import "./css/00-tokens.css";
import "./css/02-scrollbars.css";
import "./css/10-shell.css";
import "./css/12-sidebar.css";
import "./css/20-nav.css";
import "./css/30-typography.css";
import "./css/32-pretrain.css";
import "./css/34-primer.css";
import "./css/40-blocks.css";
import "./css/44-image.css";
import "./css/45-figures.css";
import "./css/47-math.css";
import "./css/50-refs.css";
import "./css/55-tiers.css";
import "./css/60-quiz.css";
import "./css/62-notes.css";
import "./css/64-drill.css";
import "./css/66-review.css";
import "./css/68-calibration.css";
import "./css/70-library.css";
import "./css/71-modal.css";
import "./css/75-course.css";
import "./css/80-concepts.css";
import "./css/85-practice.css";
import "./css/90-map.css";
import "./css/95-search.css";
import "./css/99-responsive.css";

/* Storage that fails quietly is worse than storage that fails loudly: a reader
   whose review history stopped saving three weeks ago has no way to know. */
onError(e => {
  console.error("storage", e);
  if (document.getElementById("store-error")) return;
  const bar = document.createElement("div");
  bar.id = "store-error";
  bar.textContent = "Progress is not being saved on this device. Check storage permissions.";
  bar.setAttribute("style", "position:fixed;inset:0 0 auto 0;z-index:99;padding:.6rem 1rem;" +
    "font:600 13px/1.4 system-ui,sans-serif;background:#7f1d1d;color:#fff;text-align:center");
  document.body.appendChild(bar);
});

/* One await before the first paint: everything downstream reads storage
   synchronously, so it has to be in memory before a component asks. */
init().then(() => {
  refresh();                    /* imported courses are readable now */
  durable();                    /* ask the browser not to evict them */
  render(<App />, document.getElementById("app"));
  auto();
  addEventListener("pagehide", flush);
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
