import { useState, useEffect } from "preact/hooks";
import { configured, configure, sync, restore, lastSync, bin as savedBin } from "../lib/cloud.js";
import { deviceId } from "../lib/device.js";
import { refresh } from "../lib/library.js";

/* Backup, for the one person who has the secret.
 *
 * The site is public, so this control cannot be. A reader who does not hold the
 * secret should not see a panel about an account they have no part in, be told
 * there is a backend at all, or be given a button that would spend its quota —
 * so nothing here renders until a secret is set, and the place to set one is a
 * route nothing links to (`#/sync`). Holding the secret *is* being the owner;
 * there is no other identity in the system to check.
 *
 * Everything it offers is deliberately manual except the once-a-day attempt in
 * lib/cloud.js: this is a backup, not a live connection, and each button here
 * is a request on a metered account.
 */
const ago = ms => {
  if (!ms) return "never";
  const mins = Math.round((Date.now() - ms) / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
};

export default function CloudPanel({ setup = false, onChange }) {
  const [secret, setSecret] = useState("");
  const [on, setOn] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bin, setBin] = useState(savedBin);
  const [last, setLast] = useState(lastSync);

  useEffect(() => { setOn(configured()); }, [setup]);

  const report = r => {
    setBusy(false);
    setLast(lastSync());
    if (!r) { setMsg("Nothing to do — already up to date today."); return; }
    if (!r.ok) {
      setMsg(r.unauthorized
        ? "That secret was refused. Check it matches SYNC_SECRET on the deployment."
        : `Could not reach the backup — ${r.error}.`);
      return;
    }
    setBin(r.bin || []);
    const parts = [`Sent ${r.sent || 0}, received ${r.merged || 0} answers`];
    if (r.uploaded.length) parts.push(`backed up ${r.uploaded.length} course(s)`);
    if (r.installed.length) parts.push(`installed ${r.installed.length}`);
    if (r.removed.length) parts.push(`removed ${r.removed.length}`);
    setMsg(parts.join(" · ") + ".");
    refresh();
    onChange && onChange();
  };

  const now = async () => {
    if (secret.trim()) { await configure(secret.trim()); setSecret(""); setOn(true); }
    if (!configured()) { setMsg("A secret is needed."); return; }
    setBusy(true); setMsg("Backing up...");
    report(await sync({ manual: true }));
  };

  const bringBack = async cid => {
    setBusy(true); setMsg(`Restoring ${cid}...`);
    const r = await restore(cid);
    setBusy(false);
    if (r && r.ok) {
      setBin(b => b.filter(c => c.id !== cid));
      setMsg(`Restored ${cid}.`);
      refresh(); onChange && onChange();
    } else setMsg("Could not restore that course.");
  };

  const forget = async () => {
    await configure("");
    setOn(false); setBin([]); setMsg("This device no longer holds the secret.");
  };

  /* The library mounts this only for the owner; the setup route mounts it for
     anyone who knows the route, which is how a new device is enrolled. */
  if (!on && !setup) return null;

  return (
    <div class="cloud">
      <h2>{setup && !on ? "Connect this device" : "Backup"}</h2>

      {!on && (
        <p class="cal-cap">
          Paste the secret for this deployment.
        </p>
      )}

      <div class="sync-row">
        <label>
          <span>{on ? "Replace secret" : "Secret"}</span>
          {/* A text input masked by CSS, not type="password": Chrome offers to
              save any password field it sees and files the key away as a login. */}
          <input type="text" class="secret" value={secret} id="cloud-secret"
                 autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck={false}
                 placeholder={on ? "leave blank to keep the current one" : ""}
                 onInput={e => setSecret(e.currentTarget.value)} />
        </label>
      </div>

      <div class="sync-foot">
        <button class="dbtn" id="cloud-sync" onClick={now} disabled={busy}>
          {busy ? "Working..." : on ? "Back up now" : "Connect and back up"}
        </button>
        {on && <button class="dbtn ghost" id="cloud-forget" onClick={forget} disabled={busy}>Forget secret</button>}
        <span class="cal-cap">last backup {ago(last)} · this device: {deviceId()}</span>
        {msg && <span class="sync-msg">{msg}</span>}
      </div>

      {on && (
        <p class="cal-cap cloud-note">
          Backup once a day.
        </p>
      )}

      {bin.length > 0 && (
        <div class="cloud-bin">
          <p class="cal-cap">
            Recently deleted:
          </p>
          {bin.map(c => (
            <button class="dbtn ghost" key={c.id} data-restore={c.id}
                    disabled={busy} onClick={() => bringBack(c.id)}>
              Restore {c.id} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
