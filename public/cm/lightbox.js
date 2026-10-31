/**
 * Coiff'Match – agrandir une photo : clic ou toucher sur une image d'une galerie [data-lb].
 * Flèches du clavier, balayage du doigt, Échap pour fermer.
 */
(function () {
  var box, img, count, list = [], i = 0, lastFocus = null, x0 = null;
  function build() {
    box = document.createElement('div');
    box.className = 'cm-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Photo agrandie'); box.hidden = true;
    box.innerHTML = '<button type="button" class="cm-lb__close" aria-label="Fermer">×</button>' +
      '<button type="button" class="cm-lb__nav cm-lb__prev" aria-label="Photo précédente">‹</button>' +
      '<figure class="cm-lb__fig"><img alt=""><figcaption class="cm-lb__count"></figcaption></figure>' +
      '<button type="button" class="cm-lb__nav cm-lb__next" aria-label="Photo suivante">›</button>';
    document.body.appendChild(box);
    img = box.querySelector('img'); count = box.querySelector('.cm-lb__count');
    box.querySelector('.cm-lb__close').onclick = close;
    box.querySelector('.cm-lb__prev').onclick = function () { go(-1); };
    box.querySelector('.cm-lb__next').onclick = function () { go(1); };
    box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('cm-lb__fig')) close(); });
    box.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    box.addEventListener('pointerup', function (e) { if (x0 === null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') { e.preventDefault(); box.querySelector('.cm-lb__close').focus(); }
    });
  }
  function draw() {
    img.classList.remove('in');
    img.onload = function () { img.classList.add('in'); };
    img.src = list[i].src; img.alt = list[i].alt || '';
    count.textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : '';
    box.querySelectorAll('.cm-lb__nav').forEach(function (b) { b.hidden = list.length < 2; });
  }
  function go(d) { i = (i + d + list.length) % list.length; draw(); }
  function open(group, start) {
    if (!box) build();
    list = Array.prototype.slice.call(group.tagName === 'IMG' ? [group] : group.querySelectorAll('img')).filter(function (im) { return (im.currentSrc || im.src) && !/cm_art=|\/hair\//.test(im.src); }).map(function (im) { return { src: im.currentSrc || im.src, alt: im.alt }; });
    i = Math.max(0, start); lastFocus = document.activeElement;
    draw(); box.hidden = false; document.documentElement.classList.add('cm-lb-open');
    box.querySelector('.cm-lb__close').focus();
  }
  function close() {
    box.hidden = true; document.documentElement.classList.remove('cm-lb-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var im = e.target.closest && e.target.closest('[data-lb] img, img[data-lb]');
    if (!im) {
      var ph = e.target.closest && e.target.closest('[data-lb] .ph, [data-lb] figure');
      im = ph && ph.querySelector('img');
    }
    // Seules les vraies photos s'agrandissent (pas les visuels de texture).
    if (!im || /cm_art=|\/hair\//.test(im.src)) return;
    var group = im.closest('[data-lb]');
    e.preventDefault();
    open(group, group.tagName === 'IMG' ? 0 : Array.prototype.indexOf.call(group.querySelectorAll('img'), im));
  });
})();
