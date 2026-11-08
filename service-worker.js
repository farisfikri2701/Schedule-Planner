const CACHE_NAME = 'schedule-planner-v18';
const APP_FILES = ['./', './index.html', './manifest.json', './app-icon.svg'];
const EXTERNAL_APP_FILES = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    await Promise.all(EXTERNAL_APP_FILES.map(async url => {
      const request = new Request(url, { mode: 'no-cors' });
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response);
        } else {
          console.warn(`Offline app dependency returned ${response.status}: ${url}`);
        }
      } catch (error) {
        console.warn(`Could not pre-cache offline app dependency: ${url}`, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    if (!['script', 'style', 'font'].includes(event.request.destination)) return;
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        try {
          const response = await fetch(event.request);
          if (response.ok || response.type === 'opaque') {
            await cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        }))
      .catch(() => caches.match('./index.html'))
  );
});
