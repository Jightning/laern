import { forCourse, toJSON, usage, fromJSON, all } from "../lib/log.js";
import { invalidate } from "../lib/replay.js";
import { useState } from "preact/hooks";
import { confidenceBands, confidentMisses, modelBands } from "../lib/calibrate.js";
import PrivacyNote from "./PrivacyNote.jsx";

const pct = x => `${Math.round(x * 100)}%`;

const Bar = ({ v, label }) => (
  <span class="cal-bar" role="img" aria-label={label}><i style={`width:${Math.round(v * 100)}%`} /></span>
);


/* Where the site's claims about the reader and the model's claims about the
 * reader can both be checked. Every number here comes from the outcome log,
 * so nothing on this page is an argument from literature. */
export default function Calibration({ ctx, onReset }) {
  const { cid } = ctx;
  const [note, setNote] = useState("");
  const rows = forCourse(cid);
  const conf = confidenceBands(rows);
  const model = modelBands(rows);
  const missed = confidentMisses(rows);

  const save = () => {
    const url = URL.createObjectURL(new Blob([toJSON()], { type: "application/json" }));
    const a2 = Object.assign(document.createElement("a"), { href: url, download: `study-log-${cid}.json` });
    a2.click(); URL.revokeObjectURL(url);
  };

  const load = async e => {
    const f = e.currentTarget.files && e.currentTarget.files[0];
    e.currentTarget.value = "";
    if (!f) return;
    try {
      const r = fromJSON(await f.text());
      /* Imported rows can predate any checkpoint, so every course refolds. */
      for (const id of new Set(all().map(x => x.course))) if (id) invalidate(id);
      setNote(r.merged ? `Merged ${r.merged} new answer(s). Reload to see them.`
                       : "Nothing new — those answers are already here.");
    } catch (err) { setNote(err.message); }
  };

  return (
    <div class="chub cal">
      <h1>Calibration</h1>

      {/* What this page knows, said once.
       *
       * It opened on eight stat chips, seven of them reading 0 on a course
       * nobody had answered in yet — a dashboard for an empty database, and the
       * same deficit framing the course home used to lead with. Calibration has
       * exactly one finding and it is the gap between what the reader believed
       * and what happened; everything else here is a fold over the same rows
       * and is already drawn in the two tables below.
       *
       * So the chips are gone and the finding is a sentence. Before there is
       * anything to say, the page says that instead of saying it in zeros. */}
      {rows.length === 0 ? (
        <p class="cal-lede">
          Nothing to calibrate yet. Answer a few questions — predicting before you
          reveal is what this page measures.
        </p>
      ) : (
        <p class="cal-lede">
          {missed > 0
            ? <>You were <b class="cal-miss">sure and wrong {missed} time{missed === 1 ? "" : "s"}</b> out
              of {rows.length} answered. Those are the ones worth going back to — a confident
              miss is the only error you cannot feel.</>
            : <>{rows.length} answered, and nothing you were sure about turned out
              wrong. Your confidence is tracking your accuracy.</>}
        </p>
      )}

      <h2 class="cal-h">Confidence against correctness</h2>
      <table class="cal-t">
        <tbody>
          {conf.map(r => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td class="cal-c">{r.n}</td>
              <td><Bar v={r.rate} label={`${pct(r.rate)} correct`} /></td>
              <td class="cal-v">{r.n ? pct(r.rate) + " correct" : " "}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 class="cal-h">Predicted against observed</h2>
      {model.length ? (
        <table class="cal-t">
          <tbody>
            {model.map(r => (
              <tr key={r.label}>
                <th>{r.label}</th>
                <td class="cal-c">{r.n}</td>
                <td><Bar v={r.observed} label={`${pct(r.observed)} observed`} /></td>
                <td class="cal-v">{pct(r.predicted)} → {pct(r.observed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p class="cal-empty">No scheduled reviews answered yet.</p>}

      <div class="cal-foot">
        <button class="dbtn ghost" id="cal-export" onClick={save}>Export the log →</button>
        <label class="dbtn ghost">
          Import a log →
          <input type="file" accept=".json,application/json" onChange={load} hidden />
        </label>
        <span class="cal-cap">{usage().n} rows kept</span>
      </div>

      {/* The only control on the site that can lose work, and it lives here
          rather than in the toolbar.
       *
       * It used to sit one thumb-width from Search, which is the wrong distance
       * for something unrecoverable. Here it is beside the log it erases, under
       * the row that offers to export that log first — so the way to keep the
       * history is in front of the reader at the moment they are considering
       * discarding it. Every count on this page is a fold over those same rows,
       * which is what makes this the page it belongs on. */}
      {onReset && ctx.state.on && (
        <div class="cal-danger">
          <button class="dbtn danger" onClick={onReset}>Clear this course's history</button>
          <span class="cal-cap">
            Erases every answer and review interval for {ctx.C.code}. Export first — this
            cannot be undone.
          </span>
        </div>
      )}

      {note && <p class="cio-msg">{note}</p>}
      <PrivacyNote />
    </div>
  );
}
