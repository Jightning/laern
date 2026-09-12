import { forCourse, toJSON, usage, fromJSON, all } from "../lib/log.js";
import { invalidate } from "../lib/replay.js";
import { useState } from "preact/hooks";
import { confidenceBands, confidentMisses, modelBands, skipRate, helpSought } from "../lib/calibrate.js";
import { counts } from "../lib/retention.js";
import PrivacyNote from "./PrivacyNote.jsx";

const pct = x => `${Math.round(x * 100)}%`;

const Bar = ({ v, label }) => (
  <span class="cal-bar" role="img" aria-label={label}><i style={`width:${Math.round(v * 100)}%`} /></span>
);

const Stat = ({ v, label, warn }) => (
  <span class={"dstat" + (warn ? " warn" : "")}><b>{v}</b>{label}</span>
);

/* Where the site's claims about the reader and the model's claims about the
 * reader can both be checked. Every number here comes from the outcome log,
 * so nothing on this page is an argument from literature. */
export default function Calibration({ ctx, drills }) {
  const { cid, idx, state } = ctx;
  const [note, setNote] = useState("");
  const rows = forCourse(cid);
  const conf = confidenceBands(rows);
  const model = modelBands(rows);
  const skip = skipRate(rows);
  const missed = confidentMisses(rows);
  const a = state.on ? state.stats(idx.QALL.map(q => q.id)) : null;
  const b = drills.has ? counts(cid, drills.keys) : null;

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

      <div class="dash">
        <Stat v={rows.length} label="answered" />
        <Stat v={missed} label="confident and wrong" warn={missed > 0} />
        <Stat v={skip.asked ? pct(skip.rate) : "—"} label="reasons skipped" />
        <Stat v={helpSought(rows)} label="looked up first" />
        {a && <Stat v={`${a.got}/${a.total}`} label="types cleared" />}
        {b && <Stat v={b.criterion} label="at criterion" />}
        {b && <Stat v={`${b.durable}/${b.total}`} label="durable" />}
        {b && <Stat v={b.due} label="due now" />}
      </div>

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

      {note && <p class="cio-msg">{note}</p>}
      <PrivacyNote />
    </div>
  );
}
