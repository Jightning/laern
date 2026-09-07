/* Hash routing and the return stack, as hooks. */
import { useState, useEffect, useCallback, useRef } from "preact/hooks";

/** parse "#/course/rest" */
function parseHash(h) {
  const parts = (h || "#/").slice(1).split("/").filter(Boolean);
  return { cid: parts[0] || null, rest: parts.slice(1).join("/") };
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return { hash, ...parseHash(hash) };
}

/** navigation with a return stack, so following a prerequisite is reversible */
export function useNav(labelFor) {
  const [stack, setStack] = useState([]);
  const here = useRef("#/");
  /* Set only for the two moves that belong to the trail: following a
     cross-reference, and returning along one. */
  const onTrail = useRef(false);

  useEffect(() => {
    const on = () => {
      here.current = location.hash || "#/";
      /* Any other hash change is the reader leaving deliberately — the
         sidebar, the course nav, the dependency map, the browser's own back
         button. The stack is the trail followed out of the text, so it ends
         when the reader steps off it; otherwise the pill sits there offering
         to return to a page they left three sections ago. */
      if (!onTrail.current) setStack([]);
      onTrail.current = false;
    };
    on();
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const go = useCallback((hash, viaXref, originId) => {
    if (viaXref && hash !== here.current) {
      onTrail.current = true;
      /* Where to return to is derived from the ORIGIN, never by chopping the
         target: a two-segment target like #/c/gray-code lost its "c/" to the
         replace and produced #/<course>/c/<subsection>, a route that resolves
         to nothing. Rebuild it from the course id instead. */
      const cid = (here.current.split("/")[1] || hash.split("/")[1] || "");
      setStack(s => [...s, {
        hash: originId && cid ? `#/${cid}/${originId}` : here.current,
        label: labelFor(originId)
      }].slice(-12));
    }
    if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = hash;
  }, [labelFor]);

  const back = useCallback(() => {
    setStack(s => {
      const top = s[s.length - 1];
      if (top) { onTrail.current = true; location.hash = top.hash; }
      return s.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => setStack([]), []);
  return { stack, go, back, clear };
}
