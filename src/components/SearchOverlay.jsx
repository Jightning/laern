import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import { searchRun } from "../lib/search.js";

/* A run of `{t, hit}` from lib/search.js, marked. The engine returns parts
   rather than a string with tags in it because the material is authored as raw
   HTML: building a highlighted snippet as markup would mean either escaping it
   here and injecting it there, or trusting a string this file assembled. */
const Marked = ({ run }) =>
  run.map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : p.t));

export default function SearchOverlay({ ctx, open, onClose }) {
  const { cid, idx } = ctx;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); input.current?.focus(); }
  }, [open]);

  /* Keyed on the query, so re-rendering for a moved selection does not
     re-run the search. */
  const res = useMemo(
    () => (open && q.trim() ? searchRun(idx.SEARCH, q.trim()) : []),
    [open, q, idx]);

  /* Keep the highlighted row on screen as it moves past the fold. */
  useEffect(() => {
    list.current?.querySelector(".sres.on")?.scrollIntoView({ block: "nearest" });
  }, [sel, q]);

  if (!open) return null;

  /* The results are a listbox, so the keyboard drives them from the input
     rather than requiring a tab through every hit (T6). */
  const onKey = e => {
    if (!res.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(i => (i + 1) % res.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(i => (i - 1 + res.length) % res.length); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const hit = res[Math.min(sel, res.length - 1)];
      if (hit) { location.hash = `#/${cid}/${hit.e.id}`; onClose(); }
    }
  };

  return (
    <div class="search on" role="dialog" aria-label="Search"
         onClick={e => { if (e.target.classList.contains("search")) onClose(); }}>
      <div class="sbox">
        <div class="sbar">
          <input ref={input} id="s-input" type="search" value={q}
                 placeholder="Search this course..." autocomplete="off" spellcheck={false}
                 role="combobox" aria-expanded={res.length > 0} aria-controls="s-res"
                 aria-activedescendant={res.length ? "s-hit-" + Math.min(sel, res.length - 1) : undefined}
                 onKeyDown={onKey}
                 onInput={e => { setQ(e.currentTarget.value); setSel(0); }} />
          {/* The Close button beside it does the same job and says so in a
              word; a key cap for the key that also does it is a second label
              for one action. Escape still closes — the keyboard hints that
              earn their place are the ones with no visible control. */}
          <button class="tbtn" id="s-close" onClick={onClose}>Close</button>
        </div>
        <div id="s-res" ref={list} role="listbox">
          {!q.trim() && <p class="shint">Type to search every definition, example, and question.</p>}
          {q.trim() && res.length === 0 && <p class="shint">No match for “{q.trim()}”.</p>}
          {q.trim() && res.length > 0 &&
            <p class="shint skeys">↑ ↓ to choose · enter to open</p>}
          {res.map((r, i) => (
            <a class={"sres" + (i === Math.min(sel, res.length - 1) ? " on" : "")}
               id={"s-hit-" + i} role="option"
               aria-selected={i === Math.min(sel, res.length - 1)}
               href={`#/${cid}/${r.e.id}`} key={r.e.id}
               /* mousemove, not mouseenter: scrolling the selection into view
                  slides rows under a stationary cursor, and mouseenter would
                  fire there and drag the selection back */
               onMouseMove={() => setSel(i)} onClick={onClose}>
              <span class="sn">{r.e.num ? `${r.e.num}` : "◈"}</span>
              <span class="sb">
                <b><Marked run={r.title} /></b>
                <span class="sc">
                  {r.e.ctx}
                  {/* How often the query occurs in the body, which is what
                      separates a passing reference from where the subject is
                      actually treated. */}
                  {r.mentions > 1 && <span class="smn">{r.mentions} mentions</span>}
                </span>
                <span class="sx"><Marked run={r.parts} /></span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
