import { useState } from "preact/hooks";
import { config, configure, configured, sync, endpoint } from "../lib/sync.js";
import { deviceId } from "../lib/device.js";

/* Two fields, entered once per device — not once per course.
 *
 * The settings were always global (`sync:url`, `sync:token`), but the panel
 * used to render inside a course's calibration page, which made it look
 * per-course and meant you had to open a course to reach it at all. It belongs
 * on the library, which is the only page that is about the whole install.
 *
 * Sync runs on the reader's own machine (tools/sync-server.mjs), reachable
 * inside their own network — so both the address and the token are theirs, and
 * a visitor who sets up neither simply has no sync. Nothing here is shipped in
 * the build; a public deployment cannot hide a secret.
 *
 * Only the outcome log travels; Loop A and Loop B state are folded back out of
 * it on arrival, which is why a phone and a laptop can both be used all day
 * and neither overwrites the other.
 */
export default function SyncPanel() {
  const [url, setUrl] = useState(() => config().url);
  const [token, setToken] = useState(() => config().token);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const now = async () => {
    configure({ url, token });
    if (!configured()) { setMsg("Both the address and the token are needed."); return; }
    setBusy(true); setMsg("Syncing...");
    const r = await sync();
    setBusy(false);
    if (!r) setMsg("Offline. Answers are saved here and will go up later.");
    else if (r.ok) {
      const parts = [`Sent ${r.sent || 0}, received ${r.merged || 0} answers`];
      if (r.uploaded && r.uploaded.length) parts.push(`handed up ${r.uploaded.length} course(s)`);
      if (r.installed && r.installed.length) parts.push(`installed ${r.installed.length} course(s)`);
      else if (!(r.uploaded || []).length && r.available) parts.push(`${r.available} course(s) up to date`);
      setMsg(parts.join(" · ") + ".");
    }
    else if (r.needsLogin) setMsg("That token was rejected. Check it matches SYNC_TOKEN.");
    else setMsg("Could not reach the server. Answers are saved here and will go up later.");
  };

  return (
    <div class="sync">
      <h2>Sync</h2>
      {/* What is sent is stated once, on the calibration page beside the data
          it describes — see PrivacyNote.jsx. */}
      <div class="sync-row">
        <label>
          <span>Address</span>
          <input type="url" value={url} spellcheck={false}
                 placeholder="https://laptop.your-tailnet.ts.net"
                 onInput={e => setUrl(e.currentTarget.value)} />
        </label>
        <label>
          <span>Token</span>
          <input type="password" value={token} autocomplete="off" spellcheck={false}
                 onInput={e => setToken(e.currentTarget.value)} />
        </label>
      </div>
      <div class="sync-foot">
        <button class="dbtn" onClick={now} disabled={busy}>
          {busy ? "Syncing..." : "Save and sync"}
        </button>
        <span class="cal-cap">this device: {deviceId()}</span>
        {msg && <span class="sync-msg">{msg}</span>}
      </div>
    </div>
  );
}
