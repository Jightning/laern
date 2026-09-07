import { useEffect } from "preact/hooks";
import { pageContext } from "../lib/context.js";

const ID = "page-context";

/* Writes the current view's context record into <head>, and nothing else.
 *
 * Renders no element and changes no layout: the whole point is that the reader
 * sees exactly what they saw before, and the assistant they invoke from the
 * right-click menu sees the course's own words rather than its own memory of
 * the subject. */
export default function PageContext({ C, cid, idx, rest, section }) {
  useEffect(() => {
    if (!C) {
      document.title = "Courses";
      set("description", "");
      script(null);
      return;
    }
    const ctx = pageContext(C, cid, idx, rest, section);
    if (!ctx) return;
    document.title = ctx.title;
    set("description", ctx.description);
    script(ctx.jsonld);
  }, [C, cid, rest, section]);

  return null;
}

function set(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

function script(data) {
  let el = document.getElementById(ID);
  if (!data) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = ID;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
