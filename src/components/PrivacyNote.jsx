import { configured } from "../lib/sync.js";

/* The one place the site says what leaves the device.
 *
 * It belongs here, next to the reader's own numbers, rather than beside the
 * sync settings — the question "what happens to my data" is asked while looking
 * at the data, not while configuring a server. It states the truth for *this*
 * device: with no sync set up, nothing leaves at all.
 */
export default function PrivacyNote() {
  if (!configured()) return (
    <p class="lede cal-priv">
      Everything on this device stays on this device. Your answers, notes and
      courses are stored in this browser and are not uploaded anywhere.
    </p>
  );
  return (
    <p class="lede cal-priv">
      Sent to your sync server: which item you answered, when, how confident you
      were, whether you were right, and how long you took. Your written notes,
      the reasons you type, and your course files stay on this device.
      Schedules are recomputed from the log rather than sent.
    </p>
  );
}
