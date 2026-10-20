
// Cache the shell, never the data. The payload is one fetch away and lives in
// localStorage; caching API responses here would mean two stale copies to
// reason about instead of one.
const SHELL = 'trips-shell-26';
const FILES = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './review.js', './review.css', './plan.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))
              .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL)
                                  .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;   // the GitHub API

  // reset.html is the escape hatch from a bad cache. Touching it here -
  // serving it, or worse, storing it under './index.html' as the navigation
  // branch below would - is how an escape hatch stops being one.
  if (url.pathname.endsWith('reset.html')) return;
  // version.txt is how a stale copy learns it is stale. Serving it from the
  // stale copy's own cache would answer the question with the wrong answer,
  // for ever.
  if (url.pathname.endsWith('version.txt')) return;

  // The page itself: network first, cache as the fallback. Cache-first left
  // an installed app running an old shell until the service worker happened
  // to update itself - so a fix shipped here did not reach the phone that
  // needed it. Everything else is small and static, and cache-first is right
  // for it.
  const isPage = e.request.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html'))));
});
