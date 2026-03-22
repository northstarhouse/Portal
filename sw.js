var CACHE = 'nsh-v274';
var STATIC = [
  '/Portal/',
  '/Portal/index.html',
  '/Portal/assets/app.js?v=274',
  '/Portal/assets/logo.png',
  '/Portal/favicon.svg',
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

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // Always go to network for API calls and external resources
  if (url.includes('supabase.co') || url.includes('corsproxy.io') || url.includes('googleapis.com') || url.includes('jsdelivr.net')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        return caches.open(CACHE).then(function(c) {
          c.put(e.request, res.clone());
          return res;
        });
      });
    })
  );
});
