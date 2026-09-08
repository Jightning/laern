import { qid } from "../lib/util.js";
import StateStrip from "./StateStrip.jsx";

const Stat = ({ n, label, warn }) => (
  <span class={"dstat" + (warn ? " warn" : "")}><b>{n}</b>{label}</span>
);

export default function CourseHome({ ctx }) {
  const { C, cid, idx, state, drills } = ctx;
  const H = r => `#/${cid}${r ? "/" + r : ""}`;
  const st = state.on ? state.stats(idx.QALL.map(q => q.id)) : null;

  return (
    <div class="start">
      <h1>{C.title}</h1>
      <p class="lede">{C.tagline}</p>

      <StateStrip ctx={ctx} drills={drills} />

      {/* Two rows, because they are two kinds of thing: what the reader has
          done, and where they can go next. */}
      {st && (
        <div class="dash">
          <Stat n={st.got} label="mastered" />
          <Stat n={st.total - st.seen} label="not yet seen" />
          <Stat n={st.over} label="overconfident" warn={st.over > 0} />
        </div>
      )}
      <div class="dash-go">
        <a class="dbtn" href={H("practice")}>Practice →</a>
        <a class="dbtn" href={H("map")}>Dependency map →</a>
        <a class="dbtn ghost" href={H("calibration")}>Calibration →</a>
      </div>

      <div class="toc">
        {C.sections.map(s => {
          const ids = [];
          s.subs.forEach(u => (u.quiz || []).forEach(q => ids.push(qid(u.id, q.type))));
          const ss = state.on ? state.stats(ids) : null;
          return (
            <a class="tocrow" href={H(s.id)} key={s.id}>
              <span class="tn">{String(s.num).padStart(2, "0")}</span>
              <span class="tt2">{s.title}</span>
              <span class="tc">
                {ss ? `${ss.got}/${ss.total} mastered` : `${s.subs.length} parts · ${ids.length} Q`}
              </span>
              <span class="tsub">
                {s.subs.map((u, i) => `${s.num}.${i + 1} ${u.title}`).join(" · ")}
              </span>
              {/* No progress bar. The row already says "3/11 mastered" in
                  words two columns over, and a 3px track under every row put a
                  second horizontal line above the one that separates them. */}
            </a>
          );
        })}
      </div>
    </div>
  );
}
