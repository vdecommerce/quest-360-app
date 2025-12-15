/* PWA Service Worker (simple + safe defaults) */
const CACHE_NAME = "cinema-glass-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/pwa-icon.svg",
  "./assets/panos.json",
  "./assets/videos.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  return url.protocol === "https:";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;
  // Range requests (e.g. video streaming) return 206 Partial Content, which Cache API can't store.
  if (request.headers.has("range")) return;

  // SPA-style nav fallback to cached index
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cached) => cached || fetch(request).catch(() => cached))
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isHtml = isSameOrigin && (request.destination === "document" || url.pathname.endsWith(".html"));
  const isJsCss =
    isSameOrigin && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css"));
  const isStatic =
    isSameOrigin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".jpeg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".mp3") ||
      url.pathname.endsWith(".mp4") ||
      url.pathname.endsWith(".webmanifest"));

  if (isHtml) {
    // Network-first for HTML to avoid stale index -> missing hashed bundle (blank screen).
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 206) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isStatic && !isJsCss) {
    // Cache-first for local media/assets (except JS/CSS)
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 206) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for everything else (incl. CDN)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.status === 206) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
