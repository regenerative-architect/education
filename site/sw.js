/* =========================================================================
   Service worker: AI Co-Evolution in Education
   -------------------------------------------------------------------------
   What it does, in plain words:
   - On install, it saves the app itself (the PRECACHE list below) on this
     device, so the toolkit opens without internet.
   - Library documents are saved the first time you open them, or all at
     once if you choose "Save the whole library".
   - When a new version is published, the new worker waits until you choose
     "Update now" in the page. Nothing is ever forced.
   - It only ever handles this app's own files. It never contacts any other
     site, never tracks anything, and never sends anything anywhere.

   - A few big, optional helpers (the EXTRAS list, like the AI Lab's token
     counter) are saved the first time you use them, not at install, so
     installing stays quick and light.

   How versions work: tools/stamp-sw.mjs writes a fingerprint of every
   precached file into BUILD, and of the EXTRAS into EXTRAS_BUILD. Change any
   of them, run the stamp (the deploy workflow does it for you), and installed
   apps see an update. Saved extras are only fetched again when they change.

   To add a file to the offline app: add its path to PRECACHE (or EXTRAS for
   something large that only one tool needs), then stamp.
   ========================================================================= */
const BUILD = "603976430a24";
const EXTRAS_BUILD = "858b83dc471a";

/* Cache names include this app's folder, so two copies of the toolkit on the
   same website (say, a fork) never mix their saved files. */
const SCOPE = new URL(self.registration.scope).pathname;
const SHELL = `aice-shell-${BUILD}@${SCOPE}`;
const LIBRARY = `aice-library@${SCOPE}`;
const EXTRA = `aice-extras-${EXTRAS_BUILD}@${SCOPE}`;

/* PRECACHE:start (the app shell: everything needed to open the toolkit offline) */
const PRECACHE = [
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/boot.js",
  "assets/app.css",
  "assets/app.js",
  "assets/fonts/atkinson-hyperlegible-next.woff2",
  "assets/fonts/literata-italic.woff2",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "vendor/minisearch.js",
  "vendor/marked.umd.js",
  "vendor/purify.min.js",
  "vendor/qrcode.js",
  "vendor/turndown.js",
  "library/index.json"
];
/* PRECACHE:end */

/* EXTRAS:start (saved the first time a tool needs them; see the note at the top) */
const EXTRAS = [
  "vendor/gpt-tokenizer.js"
];
/* EXTRAS:end */

/* ---------- Install: save the app shell ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // "reload" skips the browser's ordinary cache, so the files saved match this version exactly
      cache.addAll(PRECACHE.map((path) => new Request(path, { cache: "reload" })))
    )
  );
});

/* ---------- Activate: tidy up older versions, then take charge of open pages ---------- */
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => (name.startsWith("aice-shell-") || name.startsWith("aice-extras-")) && name.endsWith("@" + SCOPE) && name !== SHELL && name !== EXTRA)
      .map((name) => caches.delete(name)));
    await pruneLibrary();
    await self.clients.claim();
  })());
});

/* Keep only library files that belong to the current library (each one's
   address carries a fingerprint of its text, e.g. docs/starter-pack.html?v=1a2b3c). */
async function pruneLibrary() {
  try {
    const shell = await caches.open(SHELL);
    const res = await shell.match("library/index.json");
    if (!res) return;
    const index = await res.json();
    const keep = new Set(index.documents.map((d) => new URL(`library/docs/${d.id}.html?v=${d.hash}`, self.registration.scope).href));
    keep.add(new URL(`library/search.json?v=${index.searchHash}`, self.registration.scope).href);
    if (!(await caches.has(LIBRARY))) return;
    const library = await caches.open(LIBRARY);
    for (const request of await library.keys()) {
      if (!keep.has(request.url)) await library.delete(request);
    }
  } catch (err) {
    // Tidying up is best-effort; nothing breaks if it's skipped.
  }
}

/* ---------- Fetch: answer from this device first ---------- */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this app's own files. Everything else (links you open) goes straight to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  const path = url.pathname.slice(SCOPE.length);

  if (path.startsWith("download/")) return;                        // the single-file download: always fresh from the site
  if (request.mode === "navigate") { event.respondWith(page(request, path)); return; }
  if (path.startsWith("library/") && path !== "library/index.json") { event.respondWith(libraryFile(request)); return; }
  if (EXTRAS.includes(path)) { event.respondWith(extraFile(request)); return; }
  event.respondWith(shellFile(request));
});

/* Pages: the toolkit is one page, so its address opens the saved copy instantly. */
async function page(request, path) {
  const shell = await caches.open(SHELL);
  if (path === "" || path === "index.html") {
    const saved = await shell.match("index.html");
    if (saved) return saved;
  }
  try {
    return await fetch(request);
  } catch (err) {
    const saved = await shell.match(path, { ignoreSearch: true });
    if (saved) return saved;
    const offline = await shell.match("offline.html");
    if (!offline) return Response.error();
    // Point the page's "Go to the toolkit" link at the app's own folder, wherever this page was asked for
    const text = (await offline.text()).replace('href="./"', `href="${SCOPE}"`);
    return new Response(text, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/* App files: the saved copy, or the network if something isn't saved. */
async function shellFile(request) {
  const shell = await caches.open(SHELL);
  const saved = await shell.match(request, { ignoreSearch: true });
  if (saved) return saved;
  try {
    return await fetch(request);
  } catch (err) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

/* Library files: saved copy first; otherwise fetch it and keep a copy for next time. */
async function libraryFile(request) {
  const library = await caches.open(LIBRARY);
  const saved = await library.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    if (response.ok) await library.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response("This document isn't saved on this device yet.", {
      status: 504, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

/* Extras: saved copy first; otherwise fetch it once and keep it. */
async function extraFile(request) {
  const extras = await caches.open(EXTRA);
  const saved = await extras.match(request, { ignoreSearch: true });
  if (saved) return saved;
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok) await extras.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

/* ---------- Messages from the page ---------- */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();                 // you chose "Update now"
  if (data.type === "VERSION" && event.ports && event.ports[0]) event.ports[0].postMessage({ build: BUILD, scope: SCOPE });
});
