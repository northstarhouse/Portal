var CACHE = 'nsh-v1784868559596';
var STATIC = [
  '/Portal/',
  '/Portal/index.html',
  '/Portal/assets/app.js?v=1784868559596',
  '/Portal/assets/logo.png',
  '/Portal/favicon.svg',
  'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(STATIC); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version first, so a new deploy shows up on
// the very next load with no cache-version bump needed. Cache is only a fallback for when the
// network request fails (offline / connectivity issue), not the primary source of truth.
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (url.includes('supabase.co') || url.includes('corsproxy.io') || url.includes('googleapis.com') || url.includes('google.com')) {
    return;
  }
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then(function(res) {
      var resClone = res.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, resClone); });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
