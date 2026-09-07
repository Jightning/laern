/* Offline, and the reason the phone keeps its data.
 *
 * WebKit deletes all script-writable storage — IndexedDB included — for any
 * origin with no user interaction in seven days. Spaced repetition schedules
 * intervals well past that, so on iOS Safari the review state would be erased
 * exactly when the schedule said to come back. Home-screen web apps are exempt,
 * and a manifest plus a registered service worker is what makes the install an
 * app rather than a bookmark. Offline reading is the second reason, not the
 * first.
 *
 * No precache manifest: the build's asset names are hashed, and coupling this
 * file to them would mean regenerating it on every build. Everything is cached
 * as it is fetched instead, which costs one cold visit and no build wiring.
 *
 * The one thing this must never do is cache a sign-in page. The site sits
 * behind Cloudflare Access, so an expired session answers *any* request with a
 * redirect to the identity provider. Cached under `courses/ma26600.json`, that
 * HTML would poison the entry until the cache was cleared by hand, and the
 * course would appear corrupt rather than merely locked. `cacheable` is the
 * guard: same-origin, not redirected, and the content type actually expected.
 */
const CACHE = "learn-v2";

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

/* `type: "basic"` means same-origin and not redirected away; `redirected`
   catches the Access bounce even when it lands back on this origin. */
const cacheable = (req, res) => {
  if (!res || !res.ok || res.redirected || res.type !== "basic") return false;
  if (req.destination === "document") return true;
  const ct = res.headers.get("content-type") || "";
  if (req.url.includes("/courses/")) return ct.includes("json");
  return !ct.includes("text/html");   /* a script or font answered with HTML is a login page */
};

const putIfOk = async (req, res) => {
  if (cacheable(req, res)) (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  /* Sync is live data and must never be answered from a cache. */
  if (url.pathname.startsWith("/api/")) return;

  /* Navigation: network first so a deploy is picked up, cache as the fallback
     so a train still opens the app. */
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).then(r => putIfOk(request, r))
        .catch(() => caches.match(request).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  /* Courses and hashed assets are immutable once named: cache first, and
     revalidate quietly so an edited course still lands on the next open.
     A cache hit is also what keeps the app readable while signed out — the
     material is already here, and only sync needs the session. */
  e.respondWith(
    caches.match(request).then(hit => {
      const net = fetch(request)
        .then(r => putIfOk(request, r))
        .catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
