// Cache-first, with an explicit shell list plus runtime fill for anything else.
//
// Runtime fill alone is not enough for the first visit: the worker only claims
// the page after its HTML, CSS, and modules have already been fetched, so none
// of them pass through the fetch handler and a cold offline launch renders
// nothing. The shell list closes that gap.
//
// The trade-off: an installed app keeps serving the old cache until CACHE is
// bumped, and a new file has to be added below. Both are part of deploying.
const CACHE = 'habit-tracker-v1';

// A home-screen launch requests './' while a browser visit requests
// './index.html'. Different cache keys, so both are seeded.
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './streak.js',
  './store.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Cached one at a time rather than with addAll, which rejects the whole
      // install if a single entry 404s and leaves no worker at all.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
      // Clone before the body is read; a Response body is single-use.
      const copy = response.clone();
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
