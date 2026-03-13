const CACHE_NAME = 'luxe-cache-v1';
const STATIC_ASSETS = [
  'index.html',
  'mesero.html',
  'login.html',
  'cocina.html',
  'firebase-config.js',
  'auth.js',
  'app.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// El evento fetch es obligatorio para que Chrome considere la PWA instalable.
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (event.request.url.indexOf('firebase') !== -1 || event.request.url.indexOf('googleapis') !== -1 || event.request.url.indexOf('gstatic') !== -1) {
    return;
  }
  var path = url.pathname.replace(/^\//, '') || 'index.html';
  var isStatic = STATIC_ASSETS.some(function (a) { return path === a || path.endsWith('/' + a); });
  if (!isStatic) return;

  event.respondWith(
    fetch(event.request).then(function (response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(event.request, clone);
      });
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        return cached || caches.match('index.html');
      });
    })
  );
});
