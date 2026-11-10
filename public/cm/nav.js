/* Menu mobile : ouvre / ferme la navigation. */
(function () {
  var btn = document.querySelector('.site-header__toggle');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
})();

/* En-tête de l'accueil : transparent sur le bandeau, puis plein dès qu'on fait défiler. */
(function () {
  var h = document.querySelector('.home .site-header');
  if (!h) return;
  var on = false;
  function tick() {
    var y = window.scrollY > 60;
    if (y !== on) { on = y; h.classList.toggle('is-solid', y); }
  }
  window.addEventListener('scroll', tick, { passive: true });
  tick();
})();

/* « Reprendre où vous en étiez » : les profils vus récemment (stockés dans ce navigateur seulement). */
(function () {
  var box = document.getElementById('recent-home');
  if (!box) return;
  var list = [];
  try { list = JSON.parse(localStorage.getItem('cm_recent') || '[]'); } catch (e) { list = []; }
  if (!Array.isArray(list) || !list.length) return;
  var app = box.getAttribute('data-app'), tex = box.getAttribute('data-tex');
  var row = box.querySelector('.recent-home__row');
  list.slice(0, 4).forEach(function (x) {
    var a = document.createElement('a');
    a.className = 'recent-home__it';
    a.href = x.url || (app + (app.indexOf('?') === -1 ? '?' : '&') + 'pro=' + encodeURIComponent(x.id));
    var img = document.createElement('img');
    img.alt = ''; img.src = x.photo || (tex + (x.hair || 'boucles') + '.svg');
    if (!x.photo) img.className = 't';
    var t = document.createElement('span');
    var s = document.createElement('strong'); s.textContent = x.name;
    var m = document.createElement('small'); m.textContent = (x.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + (x.place || '');
    t.appendChild(s); t.appendChild(m); a.appendChild(img); a.appendChild(t); row.appendChild(a);
  });
  box.hidden = false;
})();

/* Barre de progression : chaque clic qui charge une page, ou chaque échange avec l'application, se voit tout de suite. */
(function () {
  var bar = document.createElement('div');
  bar.className = 'cm-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var t = 0, on = false;
  function start() {
    if (on) return; on = true; clearTimeout(t);
    bar.style.transition = 'none'; bar.style.opacity = '1'; bar.style.transform = 'scaleX(0)';
    void bar.offsetWidth;
    bar.style.transition = 'transform 8s cubic-bezier(.1, .9, .2, 1)'; bar.style.transform = 'scaleX(.9)';
  }
  function done() {
    if (!on) return; on = false;
    bar.style.transition = 'transform .2s ease, opacity .3s ease .15s'; bar.style.transform = 'scaleX(1)'; bar.style.opacity = '0';
  }
  document.addEventListener('cm:busy', function () { clearTimeout(t); t = setTimeout(start, 120); });
  document.addEventListener('cm:idle', function () { clearTimeout(t); done(); });
  window.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search && u.hash)) return;
    if (/^(mailto|tel|sms):/.test(a.href)) return;
    start();
  });
  window.addEventListener('submit', function (e) { if (!e.defaultPrevented) start(); });
  window.addEventListener('pageshow', done);
})();

/* Photo introuvable : on affiche le motif de texture à la place d'une image cassée. */
document.addEventListener('error', function (e) {
  var img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.getAttribute('data-fb') || img.src.indexOf(img.getAttribute('data-fb')) !== -1) return;
  img.src = img.getAttribute('data-fb');
}, true);
document.querySelectorAll('img[data-fb]').forEach(function (img) { if (img.complete && !img.naturalWidth) img.src = img.getAttribute('data-fb'); });
