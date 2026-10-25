// Service worker: lets the installed app open and work with no signal (e.g. at a dark site).
// VERSION is stamped with the commit id by the Pages workflow; "dev" means a local checkout,
// where files are fetched from the network first so edits show up on a normal reload.
const VERSION = "dev";
const SHELL = `imm-shell-${VERSION}`;
const THUMBS = "imm-thumbs"; // kept across versions; filled as images are viewed or saved from My list

// Everything index.html loads (scripts, styles, manifest, icons), read from the page itself
// so new files are cached without editing a list here.
async function shellUrls() {
  const html = await (await fetch("index.html", { cache: "reload" })).text();
  const urls = new Set(["./", "index.html"]);
  for (const m of html.matchAll(/\s(?:src|href)="([^"#:?]+)"/g)) urls.add(m[1]);
  return [...urls];
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll((await shellUrls()).map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("imm-shell-") && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function fromNetwork(req, cacheName) {
  const res = await fetch(req);
  if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

// Pages ("index.html?v=2", "./#/my") all resolve to the cached app page.
const lookup = (req) => (req.mode === "navigate"
  ? caches.match("./", { cacheName: SHELL })
  : caches.match(req, { cacheName: SHELL, ignoreSearch: true }));

async function cacheFirst(req) {
  return (await lookup(req)) || fromNetwork(req, SHELL);
}

async function networkFirst(req) {
  try {
    return await fromNetwork(req, SHELL);
  } catch (err) {
    const hit = await lookup(req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/thumbs/")) {
    e.respondWith(caches.match(req, { cacheName: THUMBS }).then((hit) => hit || fromNetwork(req, THUMBS)));
    return;
  }
  e.respondWith(VERSION === "dev" ? networkFirst(req) : cacheFirst(req));
});
