/**
 * Coiff'Match – application installable.
 * Enregistre le service worker et fait apparaître les boutons « Installer l'application »
 * (éléments [data-cm-install]) quand le navigateur le permet. Sur iPhone, affiche la marche à suivre.
 */
(function () {
  'use strict';
  var C = window.CM_PWA || {};
  // Pas dans un cadre (démonstration intégrée, aperçu) : le site qui l'affiche a peut-être son propre service worker.
  var framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if ('serviceWorker' in navigator && C.sw && !framed && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register(C.sw, { scope: '/' }).catch(function () {}); });
  }

  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var deferred = null;

  function boxes() { return document.querySelectorAll('[data-cm-install]'); }
  function render() {
    boxes().forEach(function (box) {
      if (standalone) { box.hidden = true; return; }
      if (deferred) {
        box.hidden = false;
        box.innerHTML = '<p><strong>Coiff\'Match sur votre téléphone</strong><br>Une icône sur l\'écran d\'accueil, vos rendez-vous en un geste.</p><button type="button" class="cm-btn cm-install__btn">Installer l\'application</button>';
        box.querySelector('button').onclick = function () {
          var d = deferred; deferred = null;
          d.prompt();
          d.userChoice.then(function () { render(); });
        };
      } else if (ios) {
        box.hidden = false;
        box.innerHTML = '<p><strong>Coiff\'Match sur votre iPhone</strong><br>Dans Safari, touchez <span aria-label="Partager">Partager</span> puis « Sur l\'écran d\'accueil ».</p>';
      } else box.hidden = true;
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', function () { standalone = true; render(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  // L'application ajoute ses écrans après coup : on vérifie de nouveau quand elle a fini.
  document.addEventListener('cm:idle', render);
})();
