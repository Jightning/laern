import { useState, useEffect } from "preact/hooks";
import { clip } from "../lib/util.js";
import { stateFor } from "../lib/state.js";
import { counts } from "../lib/retention.js";
import { importedIndex, filesOf, removeCourse } from "../lib/courses.js";
import { refresh, dismissed, setDismissed } from "../lib/library.js";
import { queueDelete } from "../lib/cloud.js";
import { evictionRisk } from "../lib/store.js";
import CourseIO from "./CourseIO.jsx";
import Modal from "./Modal.jsx";
import CloudPanel from "./CloudPanel.jsx";

/* `courses` is the index, not the courses: a split build has not fetched any
   of them yet, and every number on a card is a scalar the index carries. */
export default function Library({ courses, order, loading, error, onChange }) {
  const [adding, setAdding] = useState(false);
  const [doomed, setDoomed] = useState(null);   /* the course a confirm is open for */
  const [msg, setMsg] = useState(null);
  const [atRisk, setAtRisk] = useState(false);
  const mine = importedIndex();

  /* A course installed here is the only copy on this device, so a browser that
     will delete it is worth saying out loud — but only where that is a rule
     rather than a heuristic, and only where the reader can do something about
     it. See store.evictionRisk. */
  useEffect(() => { evictionRisk().then(setAtRisk); }, []);

  const save = cid => {
    const files = filesOf(cid);
    if (!files) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(files)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `${cid}.course.json` }).click();
    URL.revokeObjectURL(url);
  };

  /* Two different acts behind one button. An imported course is the only copy
     on the device, so removing it deletes it; a bundled one ships with the site
     and would come back on the next load, so it is dismissed from the shelf and
     can be brought back from the Add dialog. */
  const drop = cid => {
    const name = (courses[cid] || {}).title || cid;
    if (mine[cid]) {
      /* Tell the account, if this device is connected to one: a course removed
         here is meant to be gone everywhere, and the queue is carried on the
         next sync rather than costing a request of its own. */
      queueDelete(cid);
      removeCourse(cid); refresh();
    }
    else setDismissed(cid, true);
    onChange && onChange();
    setDoomed(null);
    setMsg(mine[cid]
      ? `Removed ${name}. Your answer history for it is kept.`
      : `${name} is hidden. Bring it back from Add a course.`);
  };

  const restore = cid => {
    setDismissed(cid, false);
    onChange && onChange();
    setMsg(null);
  };

  if (error) return (
    <div class="lib">
      <h1>Could not load that course</h1>
      <p class="lede">{String(error.message || error)}</p>
      <p class="lempty"><a href="#/">Back to the library</a></p>
    </div>
  );
  if (loading) return <div class="lib"><h1>Loading...</h1></div>;

  return (
    <div class="lib">
      {/* The plus sits with the heading rather than under the shelf: adding is
          a thing done to this list, and a control at the end of a grid is a
          control below the fold as soon as the grid has two rows. */}
      <div class="lhead">
        <h1>Courses</h1>
        <button class="lplus" id="lib-add" onClick={() => setAdding(true)}
                aria-label="Add a course">
          <span class="lplus-x" aria-hidden="true">+</span>
          <span class="lplus-w">Add a course</span>
        </button>
      </div>

      {order.length === 0 ? (
        <p class="lempty">
          {dismissed().length > 0
            ? <>Nothing on the shelf. The guide that ships with the site is hidden
                on this device — <button class="linkish" onClick={() => setAdding(true)}>
                Add a course</button> restores it, or installs one of your own.</>
            : <>No courses yet. <button class="linkish" onClick={() => setAdding(true)}>Add one</button> —
                a course is a folder of YAML, and it stays on this device.</>}
        </p>
      ) : (
        <div class="lgrid">
          {order.map(id => {
            const c = courses[id];
            const st = stateFor(id, c);
            const s = st.on ? st.summary(c.questions) : null;
            const keys = c.drillKeys || [];
            const due = keys.length ? counts(id, keys).due : 0;
            /* Removal means "delete" for a course this device installed and
               "hide" for one bundled with the site — the demo is a guide, and a
               guide you have finished should not be permanent furniture. */
            const ownIt = !!mine[id];
            return (
              /* the card wears the course's accent rotation, so the courses are
                 already distinguishable before you open one */
              <div class="lcard" key={id} data-hue
                   style={`--hue:${Number((c.theme || {}).hue) || 0}`}>
                {/* The whole card is the target, but the ops below must stay
                    clickable — so the link is a layer under them rather than a
                    wrapper around them, which is also what keeps a button out
                    of an anchor. */}
                <a class="lhit" href={`#/${id}`} aria-label={c.title || id} />
                <span class="lc">{c.code || id}</span>
                {due > 0 && <span class="ldue">{due} due</span>}
                <h3>{c.title || id}</h3>
                <p>{clip(c.tagline || "", 120)}</p>
                <div class="lstat">
                  <span>{c.sections} sections</span>
                  <span>{c.subs} parts</span>
                  <span>{c.questions} questions</span>
                </div>
                {s && s.total > 0 && (
                  <div class="lbar"><i style={`width:${Math.round((s.got / s.total) * 100)}%`} /></div>
                )}
                <div class="lops">
                  {ownIt && (
                    <button class="lop" onClick={() => save(id)}
                            aria-label={`Export ${c.title || id}`}>Export</button>
                  )}
                  <button class="lop warn" onClick={() => setDoomed(id)}
                          aria-label={`${ownIt ? "Remove" : "Hide"} ${c.title || id}`}>
                    {ownIt ? "Remove" : "Hide"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p class="cio-msg">{msg}</p>}

      {Object.keys(mine).length > 0 && atRisk && (
        <p class="cio-warn">
          On iPhone and iPad, a site's stored data is deleted after seven days
          without a visit. <b>Add this site to your Home Screen</b> to fix it.
        </p>
      )}

      <CloudPanel onChange={onChange} />

      {adding && (
        <Modal title="Add a course" onClose={() => setAdding(false)}>
          <CourseIO onChange={onChange} />
          {/* Where a hidden guide comes back. It belongs here rather than on a
              settings page: this dialog is already the answer to "how do I get
              a course onto this device". */}
          {dismissed().length > 0 && (
            <div class="cio-back">
              <p class="cal-cap">Bundled with the site, hidden on this device:</p>
              {dismissed().map(id => (
                <button class="dbtn ghost" key={id} data-restore={id}
                        onClick={() => restore(id)}>
                  Restore {(courses[id] || {}).title || id} →
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {doomed && (
        <Modal danger onClose={() => setDoomed(null)}
               title={`${mine[doomed] ? "Remove" : "Hide"} ${(courses[doomed] || {}).title || doomed}?`}>
          {mine[doomed] ? (
            <p>
              This deletes the course from this device. It is the only copy here —
              nothing is stored anywhere else — so you will need the folder or the
              <code>.course.json</code> again to bring it back.
            </p>
          ) : (
            <p>
              This one is bundled with the site as an introductory guide, so it
              is hidden rather than deleted — <b>Add a course</b> brings it back
              whenever you want it. Hiding is per device.
            </p>
          )}
          <p>
            <b>Your answer history is kept.</b> Learner state is keyed on the
            course code, so bringing it back restores your progress and review
            schedule.
          </p>
          <div class="modal-ops">
            <button class="dbtn ghost" onClick={() => setDoomed(null)}>Cancel</button>
            <button class="dbtn warn" id="lib-drop" onClick={() => drop(doomed)}>
              {mine[doomed] ? "Remove course" : "Hide course"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
