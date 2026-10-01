const CACHE_NAME = "aeonis-shell-v2"; // bumped: clears any cached 404/error pages from v1
const SHELL_FILES = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: this is a live chat/calling app, we never want stale JS
// served after a fresh deploy.
//  - API calls are never touched or cached (private data: messages, friends).
//  - Only successful (2xx) same-origin responses are cached, so an error page
//    can never be saved and replayed later.
//  - Offline page loads (/chat, /friends, ...) fall back to the cached app
//    shell instead of an error, and React Router then renders the right page.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // API / other hosts: bypass
  if (url.pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await caches.match("/index.html");
          if (shell) return shell;
        }
        return new Response("Offline — this hasn't been cached yet.", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});
