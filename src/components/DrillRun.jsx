import { decorate } from "../lib/refs.js";
import Drill from "./Drill.jsx";

/* Stepping through a queue of drills, with the concept one click away.
 *
 * The index is the caller's, so the review route and mixed practice can wrap
 * the same session in their own chrome without either owning the other's. */
export default function DrillRun({ row, at, onNext }) {
  return (
    <>
      <Drill key={row.item.id + at} cid={row.cid} C={row.C} item={row.item}
             cluster={row.cluster} onDone={onNext} />
      <details class="drill-src">
        <summary>Show the concept</summary>
        <div class="body" dangerouslySetInnerHTML={{
          __html: decorate((row.C.concepts[row.key] || {}).body || "", row.cid, {}) }} />
        <a class="mn-go" href={`#/${row.cid}/c/${row.key}`}>Full entry →</a>
      </details>
    </>
  );
}
