/* Inline SVG icons. The previous build used ◈ ↻ ⌗ as text, which fell back to
 * tofu in the monospace stack — these always render. */
const P = { width: 13, height: 13, viewBox: "0 0 16 16", fill: "none",
            stroke: "currentColor", "stroke-width": 1.6,
            "stroke-linecap": "round", "stroke-linejoin": "round" };

export function IconStart()    { return <svg {...P}><path d="M2 4h12M2 8h12M2 12h7"/></svg>; }
export function IconConcept()  { return <svg {...P}><path d="M8 2l5 6-5 6-5-6 5-6z"/></svg>; }
export function IconPractice() { return <svg {...P}><path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13 2v3h-3"/></svg>; }
export function IconMap()      { return <svg {...P}><circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="8" cy="12" r="1.8"/><path d="M5.4 5.2 7 10.4M10.6 5.2 9 10.4M5.8 4h4.4"/></svg>; }
export function IconHome()     { return <svg {...P}><path d="M2.5 7 8 2.5 13.5 7"/><path d="M4 7.5V13h8V7.5"/></svg>; }
export function IconSearch()   { return <svg {...P}><circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2 14 14"/></svg>; }
/* Categories: things sorted into bins, which is what a category does and a
   section does not. */
export function IconCat()      { return <svg {...P}><rect x="2" y="2.5" width="5" height="5" rx="1"/><rect x="9" y="2.5" width="5" height="5" rx="1"/><rect x="2" y="9.5" width="5" height="4"/><path d="M9 13.5h5M9 11h5"/></svg>; }
/* Explore: the search lens with a filter under it. */
export function IconExplore()  { return <svg {...P}><circle cx="6.6" cy="6.6" r="4.1"/><path d="M9.6 9.6 14 14"/><path d="M3.4 13.6h4"/></svg>; }

export function IconTuck({ open }) {
  return (
    <svg {...P} width="15" height="15">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d={open ? "M6 2.5v11" : "M4.5 2.5v11"} />
      <path d={open ? "M9.6 6.2 11.8 8l-2.2 1.8" : "M12 6.2 9.8 8l2.2 1.8"} />
    </svg>
  );
}
