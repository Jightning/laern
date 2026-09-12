import { useState, useEffect, useRef } from "preact/hooks";
import { clip } from "../lib/util.js";
import { stateFor } from "../lib/state.js";
import { counts } from "../lib/retention.js";
import { importedIndex, filesOf, removeCourse } from "../lib/courses.js";
import { refresh, dismissed, setDismissed } from "../lib/library.js";
import { queueDelete } from "../lib/cloud.js";
import { purge } from "../lib/purge.js";
import { evictionRisk } from "../lib/store.js";
import CourseIO from "./CourseIO.jsx";
import Modal from "./Modal.jsx";
import CloudPanel from "./CloudPanel.jsx";

/* `courses` is the index, not the courses: a split build has not fetched any
   of them yet, and every number on a card is a scalar the index carries. */
/* Taps on the heading that open the backup route, and how long they have to
   arrive in. See `knock` below. */
const KNOCKS = 5;
const KNOCK_MS = 2500;

export default function Library({ courses, order, loading, error, onChange }) {
  const [adding, setAdding] = useState(false);
  const [doomed, setDoomed] = useState(null);   /* the course a confirm is open for */
  const [ops, setOps] = useState(null);         /* the card whose management is open */
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

  /* Two different acts behind one button, and the difference is the whole
     reason both exist. An imported course is the only copy on the device, so
     removing it destroys the course *and* what the reader answered in it — see
     lib/purge.js. A bundled one ships with the site and would come back on the
     next load, so it is dismissed from the shelf instead and its answers are
     left alone: hiding is reversible, and a reversible act must not discard
     progress. */
  const drop = cid => {
    const c = courses[cid] || {};
    const name = c.title || cid;
    const own = !!mine[cid];
    if (own) {
      /* Tell the account, if this device is connected to one: a course removed
         here is meant to be gone everywhere, and the queue is carried on the
         next sync rather than costing a request of its own. */
      queueDelete(cid);
      purge(cid, c.code);
      removeCourse(cid); refresh();
    }
    else setDismissed(cid, true);
    onChange && onChange();
    setDoomed(null);
    /* Only the destructive one reports. Hiding is reversible, the shelf in
       front of the reader already shows it gone, and the empty-shelf text says
       where it went — a third statement of the same fact is noise. */
    setMsg(own ? `Removed ${name}.` : null);
  };

  /* The way in to `#/sync` when there is no address bar to type it into.
   *
   * Installed to the Home Screen, an iPhone gives the app no URL bar at all,
   * so a route nothing links to is a route nobody can reach — including the
   * one person it is for, on the one device where the backup matters most.
   *
   * Five taps on the heading inside two and a half seconds. The count is the
   * point: it cannot happen by accident, it shows nothing and says nothing to
   * a reader who does not already know it is there, and it needs no control on
   * a public page. Same reasoning as the route being unlinked in the first
   * place — see lib/cloud.js. */
  const taps = useRef({ n: 0, at: 0 });
  const knock = () => {
    const t = taps.current;
    const now = Date.now();
    t.n = now - t.at > KNOCK_MS ? 1 : t.n + 1;
    t.at = now;
    if (t.n >= KNOCKS) { t.n = 0; location.hash = "#/sync"; }
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
        <h1 onClick={knock}>Courses</h1>
        <button class="lplus" id="lib-add" onClick={() => setAdding(true)}
                aria-label="Add a course">
          <span class="lplus-x" aria-hidden="true">+</span>
          <span class="lplus-w">Add a course</span>
        </button>
      </div>

      {order.length === 0 ? (
        <p class="lempty">
          <>No courses yet. <button class="linkish" onClick={() => setAdding(true)}>Add one</button></>
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
                {/* State where there is state, inventory where there is not.
                 *
                 * The card used to print "8 sections · 16 parts · 91 questions"
                 * whatever the reader had done — an inventory of the box rather
                 * than a report on the reading. That is the right line for a
                 * course nobody has opened, because "how big is this" is the
                 * only question a stranger has; it is the wrong line the moment
                 * there is a real answer. Same rule the Desk runs on: never a
                 * row of counts the reader cannot act on. */}
                <div class="lstat">
                  {s && s.seen > 0
                    /* "N due" already has the corner badge; repeating it here
                       would be the same fact twice on one card. */
                    ? <span>{s.got} of {s.total} mastered</span>
                    : <>
                        <span>{c.sections} sections</span>
                        <span>{c.subs} parts</span>
                        <span>{c.questions} questions</span>
                      </>}
                </div>
                {s && s.total > 0 && s.seen > 0 && (
                  <div class="lbar"><i style={`width:${Math.round((s.got / s.total) * 100)}%`} /></div>
                )}
                {/* Managing a course is not opening one.
                 *
                 * Export and Remove sat on the card face at the same weight as
                 * the title, so two admin controls — one of them destructive —
                 * competed with the only thing a reader comes to this page to
                 * do. They are behind one control now. It is a press rather than
                 * a hover, because a touch device has no hover and both of these
                 * have to stay reachable there. */}
                <div class="lops">
                  <button class="lop lmore" aria-expanded={ops === id}
                          aria-label={`Manage ${c.title || id}`}
                          onClick={() => setOps(v => (v === id ? null : id))}>···</button>
                  {ops === id && (
                    <>
                      {ownIt && (
                        <button class="lop" onClick={() => save(id)}
                                aria-label={`Export ${c.title || id}`}>Export</button>
                      )}
                      <button class="lop warn" onClick={() => setDoomed(id)}
                              aria-label={`${ownIt ? "Remove" : "Hide"} ${c.title || id}`}>
                        {ownIt ? "Remove" : "Hide"}
                      </button>
                    </>
                  )}
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
            <>
              <p>This action cannot be undone.</p>
              <p>
                <b>Your answers will also be deleted.</b>
              </p>
            </>
          ) : (
            <>
              <p>You can add this back through "Add a course".</p>
              <p><b>Your answers are kept</b>, and come back with it.</p>
            </>
          )}
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
