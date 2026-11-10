/* Coiff'Match – service worker 2.1
   CSS et JS : réseau d'abord (un fichier versionné ?v= est gardé tel quel), le cache ne sert que hors connexion.
   Images et polices : cache d'abord. */
var CACHE = 'cm-2.1', OFFLINE = '/offline.html';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(new Request(OFFLINE, { cache: 'reload' })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('cm-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function kind(u) {
  if (u.origin !== location.origin) return '';
  var m = u.pathname.match(/^\/(cm|assets)\/[^?]+\.(css|js|woff2|png|jpg|jpeg|svg|webp)$/);
  return m ? (m[2] === 'css' || m[2] === 'js' ? 'code' : 'media') : '';
}
/* Garde une seule version de chaque fichier dans le cache. */
function store(c, r, res) {
  var path = new URL(r.url).pathname;
  return c.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { var u = new URL(k.url); return u.pathname === path && k.url !== r.url; }).map(function (k) { return c.delete(k); }));
  }).then(function () { return c.put(r, res); });
}
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin || /^\/(api|__cm)\//.test(u.pathname)) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(function () { return caches.match(OFFLINE); })); return; }
  var k = kind(u);
  if (!k) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(r).then(function (hit) {
      if (hit && (k === 'media' || u.searchParams.has('v') || u.pathname.indexOf('/assets/') === 0)) return hit;
      return fetch(r).then(function (res) { if (res.ok) store(c, r, res.clone()); return res; }).catch(function () { return hit || Response.error(); });
    });
  }));
});
