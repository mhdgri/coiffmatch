/* Coiff'Match – service worker 2.0 */
var CACHE = 'cm-2.0', OFFLINE = '/offline.html';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(new Request(OFFLINE, { cache: 'reload' })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('cm-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function isStatic(u) { return u.origin === location.origin && /^\/(cm|assets)\/[^?]+\.(css|js|woff2|png|jpg|jpeg|svg|webp)$/.test(u.pathname); }
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin || /^\/(api|__cm)\//.test(u.pathname)) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(function () { return caches.match(OFFLINE); })); return; }
  if (isStatic(u)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(r).then(function (hit) {
        var net = fetch(r).then(function (res) { if (res.ok) c.put(r, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
