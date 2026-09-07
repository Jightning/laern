import { configured } from "../lib/cloud.js";

/* The one place the site says what leaves the device.
 *
 * It belongs here, next to the reader's own numbers, rather than beside the
 * backup settings — the question "what happens to my data" is asked while
 * looking at the data, not while configuring anything. It states the truth for
 * *this* device, and for a reader who has set nothing up that truth is the
 * short one: nothing leaves at all, ever, because there is nothing to leave to.
 *
 * The connected case has to be exact rather than reassuring. Something does
 * leave — that is the point of a backup — and what protects it is that it is
 * sealed before it goes, not that it is trusted after it arrives.
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
      This device backs up to your own account once a day. Your answer log and
      your courses are encrypted in this browser first, with a key derived from
      your secret — so they can be stored there but not read there. What the
      backup can see is the shape of it: which device wrote a row, when, and how
      big it was. Schedules are recomputed from the log rather than sent.
    </p>
  );
}
