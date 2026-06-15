const CACHE_NAME = 'absen-assalam-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=5',
  './app.js',
  './supabase-client.js',
  './logo.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
