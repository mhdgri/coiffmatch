/**
 * Coiff'Match – application (recherche, profil, réservation, rendez-vous, avis, messages, espace coiffeur).
 * Elle parle à l'API WordPress « coiffmatch/v1 » définie dans includes/class-cm-rest.php.
 */
(function () {
  'use strict';

  var root = document.getElementById('cm-app');
  if (!root || !window.CM_CONFIG) return;
  var C = window.CM_CONFIG;
  var PRO = C.mode === 'pro'; // Espace coiffeur (page à part) ou espace client.

  /* ================= Outils ================= */
  var HAIR = Object.keys(C.hair).map(function (k) { return [k, C.hair[k]]; });
  var SERVICES = Object.keys(C.services).map(function (k) { return [k, C.services[k]]; });
  var DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  var DOWL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var REASONS = ['Faux profil ou arnaque', 'Contenu inapproprié', 'Avis mensonger', 'Autre'];
  var COLS = ['--ph1', '--ph2', '--ph3', '--ph4'];
  var STATUS = {
    pending: ['En attente de confirmation', 'warn'], confirmed: ['Confirmé', 'ok'],
    refused: ['Refusé par le coiffeur', 'grey'], cancelled: ['Annulé', 'grey'], expired: ['Sans réponse du coiffeur', 'grey']
  };

  function $(id) { return document.getElementById('cm-' + id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hairLabel(k) { return C.hair[k] || k || ''; }
  function svcLabel(k) { return k === '' ? 'Toutes prestations' : (C.services[k] || 'Autre'); }
  function fmtDur(m) { m = +m; return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '') : m + ' min'; }
  function fmtAvg(a) { return Number(a).toFixed(1).replace('.', ','); }
  function hash(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function colorFor(id) { return COLS[hash(id) % COLS.length]; }
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  var ICON = {
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    heart: function (on) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'; },
    send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z"/></svg>',
    tick: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="flex:none;margin-top:2px;color:var(--accent)"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'
  };

  /** Construit l'URL de l'API (marche avec ou sans permaliens « jolis »). */
  function apiUrl(path, params) {
    var base = C.api + path;
    var q = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v !== '' && v != null && v !== false) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    if (!q.length) return base;
    return base + (base.indexOf('?') === -1 ? '?' : '&') + q.join('&');
  }

  /* Barre de progression en haut de l'écran pendant les échanges avec le serveur (gérée par le thème). */
  var BUSY = 0;
  function busyBar(d) {
    BUSY = Math.max(0, BUSY + d);
    try { document.dispatchEvent(new CustomEvent(BUSY ? 'cm:busy' : 'cm:idle')); } catch (e) {}
  }
  /** Appel de l'API. Lance une erreur avec un message en français. */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'X-WP-Nonce': C.nonce };
    var body;
    if (opts.form) body = opts.form;
    else if (opts.body) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    if (!opts.quiet) busyBar(1);
    var q = !!opts.quiet;
    return fetch(apiUrl(path, opts.params), { method: opts.method || 'GET', headers: headers, body: body, credentials: 'same-origin' })
      .then(function (res) { if (!q) busyBar(-1); return res; }, function (e) { if (!q) busyBar(-1); throw e; })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var e = new Error(data && data.message ? data.message : 'Une erreur est survenue. Réessayez.');
            e.status = res.status; e.code = data && data.code;
            throw e;
          }
          return data;
        });
      }, function () { throw new Error('Connexion impossible. Vérifiez votre réseau et réessayez.'); });
  }

  function toast(t) {
    var e = $('toast'); e.textContent = t; e.hidden = false; e.classList.remove('out');
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.add('out'); setTimeout(function () { e.hidden = true; }, 250); }, 2800);
  }
  /** Bouton en deux temps pour les actions importantes (annuler, refuser…). */
  function twoStep(btn, label, fn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.sure !== '1') {
        btn.dataset.sure = '1'; btn.dataset.orig = btn.textContent; btn.textContent = label;
        setTimeout(function () { if (btn.isConnected) { btn.dataset.sure = ''; btn.textContent = btn.dataset.orig; } }, 4000);
        return;
      }
      btn.disabled = true;
      Promise.resolve(fn()).catch(function (e) { toast(e.message); }).then(function () { btn.disabled = false; });
    });
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Un instant…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function loginUrl(extra) {
    var back = C.appUrl + (extra ? (C.appUrl.indexOf('?') === -1 ? '?' : '&') + extra : '');
    return C.accountUrl + (C.accountUrl.indexOf('?') === -1 ? '?' : '&') + 'redirect=' + encodeURIComponent(back);
  }
  function loginBox(text, extra, asPro) {
    return '<div class="empty"><p style="margin-bottom:12px">' + esc(text) + '</p><a class="cta-link" href="' + esc(loginUrl(extra) + (asPro ? '&inscription=coiffeur' : '')) + '">Se connecter ou créer un compte</a></div>';
  }
  /* Squelettes de chargement : la page garde sa forme pendant qu'elle se remplit. */
  function skeleton(n) {
    var h = ''; for (var i = 0; i < n; i++) h += '<li class="cardwrap sk" aria-hidden="true"><div class="sk__ph"></div><div class="sk__lines"><i></i><i></i><i></i></div></li>';
    return h;
  }
  /* Vus récemment (dans ce navigateur seulement). */
  function recentGet() { try { return JSON.parse(localStorage.getItem('cm_recent') || '[]'); } catch (e) { return []; } }
  function recentAdd(p) {
    try {
      var l = recentGet().filter(function (x) { return x.id !== p.id; });
      l.unshift({ id: p.id, name: p.name, place: p.place, mode: p.mode, hair: (p.hair || [])[0] || '', photo: p.photos[0] ? p.photos[0].url : '', url: p.url || '' });
      localStorage.setItem('cm_recent', JSON.stringify(l.slice(0, 6)));
    } catch (e) {}
  }
  function renderRecent() {
    var box = $('recent'); if (!box) return;
    var l = recentGet();
    box.hidden = !l.length;
    if (!l.length) return;
    box.innerHTML = '<span class="label">Vus récemment</span><div class="recent__row">' + l.map(function (x) {
      return '<button type="button" class="recent__it" data-id="' + x.id + '">' + (x.photo ? '<img src="' + esc(x.photo) + '" alt="">' : '<img class="t" src="' + esc(C.hairImg + (x.hair || 'boucles') + '.svg') + '" alt="">') + '<span><strong>' + esc(x.name) + '</strong><small>' + esc(x.place) + '</small></span></button>';
    }).join('') + '</div>';
    box.querySelectorAll('.recent__it').forEach(function (b) { b.onclick = function () { openPro(+b.dataset.id); }; });
  }
  function photoBox(p, i, label, cls) {
    var ph = (p.photos || [])[i];
    if (ph) return '<div class="ph ' + (cls || '') + '" role="img" aria-label="' + esc(label) + '"><img src="' + esc(ph.url) + '" alt="" loading="lazy" onload="this.classList.add(\'in\')"></div>';
    // Pas encore de photo : un visuel de texture propre à ce coiffeur (jamais présenté comme une réalisation).
    var art = (p.art || [])[(i - (p.photos || []).length + 6) % 6];
    if (art) return '<div class="ph ph--art ' + (cls || '') + '" role="img" aria-label="' + esc(label) + ' (pas encore de photo)"><img src="' + esc(art) + '" alt="" loading="lazy" onload="this.classList.add(\'in\')"></div>';
    var h = (p.hair && p.hair.length) ? p.hair[i % p.hair.length] : 'boucles';
    return '<div class="ph ph--tex ' + (cls || '') + '" role="img" aria-label="' + esc(label) + ' (pas encore de photo)"><img src="' + esc(C.hairImg + h + '.svg') + '" alt=""></div>';
  }
  /* Salon avec une équipe : chaque coiffeur a son agenda, la cliente choisit avec qui. */
  function staffFor(p, k) { return (p.staff || []).filter(function (m) { return !m.presta.length || m.presta.indexOf(k) !== -1; }); }
  function daysFor(p, k) { return p.staffDays && k && p.staffDays[k] ? p.staffDays[k] : p.days; }
  function firstFit(days, dur) {
    for (var i = 0; i < days.length; i++) for (var j = 0; j < days[i].hours.length; j++) if (fits(days[i], days[i].hours[j], dur)) return { i: i, j: j, m: days[i].hours[j].m };
    return null;
  }
  /** Garde un coiffeur de l'équipe qui fait la prestation choisie ; sinon prend celui qui a le créneau le plus proche. */
  function pickStaff() {
    var p = S.pro;
    if (!p || !(p.staff || []).length) { S.staff = null; return; }
    var list = staffFor(p, S.presta);
    if (list.some(function (m) { return m.k === S.staff; })) return;
    var best = null, dur = curDur();
    list.forEach(function (m) {
      var f = firstFit(daysFor(p, m.k), dur);
      if (f && (!best || f.i < best.i || (f.i === best.i && f.m < best.m))) best = { k: m.k, i: f.i, m: f.m };
    });
    S.staff = best ? best.k : (list[0] ? list[0].k : null);
  }
  function bookDays() { return daysFor(S.pro, S.staff); }
  /* Premier créneau libre pour la prestation choisie, en texte (« demain à 9:00 »), tous coiffeurs du salon confondus. */
  function nextFree(p) {
    var dur = +((cur() || {}).dur || 60), best = null;
    var ks = (p.staff || []).length ? staffFor(p, S.presta).map(function (m) { return m.k; }) : [null];
    ks.forEach(function (k) {
      var d = daysFor(p, k), f = firstFit(d, dur);
      if (f && (!best || f.i < best.i || (f.i === best.i && f.m < best.m))) best = { i: f.i, m: f.m, label: (f.i === 0 ? 'demain' : d[f.i].label) + ' à ' + d[f.i].hours[f.j].h };
    });
    return best ? best.label : '';
  }
  /* Prix selon la longueur des cheveux (supplément indiqué par le coiffeur). */
  function hasPlus(c) { return !!(c && c.plus && Object.keys(c.plus).length); }
  function priceFor(c, len) { return +c.price + ((c.plus || {})[len] || 0); }
  function plusText(c) {
    if (!hasPlus(c)) return '';
    return Object.keys(c.plus).map(function (k) { return '+' + c.plus[k] + ' € ' + String(C.lengths[k] || k).toLowerCase(); }).join(' · ');
  }
  function mapsUrl(a) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a); }
  function telHref(t) { return 'tel:' + String(t || '').replace(/[^0-9+]/g, ''); }
  function fmtPhone(t) { t = String(t || ''); return /^0\d{9}$/.test(t) ? t.replace(/(\d{2})(?=\d)/g, '$1 ') : t; }
  /** Un rendez-vous de « dur » minutes à l'heure h tient-il sans chevaucher les plages occupées du jour ? */
  function fits(day, h, dur) {
    var m = h.m != null ? h.m : (+h.h.split(':')[0] * 60 + +h.h.split(':')[1]);
    return !(day.busy || []).some(function (iv) { return m < iv[1] && iv[0] < m + dur; });
  }
  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || 'Lien copié'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copiez ce lien :', text); });
    else window.prompt('Copiez ce lien :', text);
  }
  function ratingText(r) { return r && r.n ? '★ ' + fmtAvg(r.avg) + ' · ' + plural(r.n, 'avis', 'avis') : 'Nouveau'; }
  function badges(p) {
    var h = '';
    if (p.example) h += '<span class="pill grey">Exemple</span> ';
    if (p.verified) h += '<span class="pill ok">✓ Diplôme vérifié</span> ';
    return h;
  }

  /* ================= État ================= */
  var params = new URLSearchParams(location.search);
  var S = {
    me: { loggedIn: !!C.loggedIn, favs: [] },
    hair: C.hair[params.get('hair')] ? params.get('hair') : 'boucles',
    service: C.services[params.get('service')] ? params.get('service') : 'coupe',
    where: ['salon', 'domicile'].indexOf(params.get('where')) !== -1 ? params.get('where') : 'all',
    skill: C.skills[params.get('savoir')] ? params.get('savoir') : '', staff: null, length: '', bookPhotos: [],
    city: params.get('ville') || '', sort: ['rating', 'soon', 'price', 'new'].indexOf(params.get('sort')) !== -1 ? params.get('sort') : 'rating', onlyFav: false, onlyVerified: false, avail: false, maxprice: '',
    pro: null, presta: null, day: 0, hour: null,
    reviewFor: null, stars: 0, thread: null, poll: null,
    space: null, draft: null, searchSeq: 0,
    hairProfile: loadLocalHair(), diagStep: 0, diagDraft: null, revFilter: 'all', preset: null
  };
  if (!C.hair[params.get('hair')] && S.hairProfile && C.hair[S.hairProfile.type]) S.hair = S.hairProfile.type;
  function loadLocalHair() { try { return JSON.parse(localStorage.getItem('cm_hair') || 'null') || {}; } catch (e) { return {}; } }
  function saveLocalHair(p) { try { localStorage.setItem('cm_hair', JSON.stringify(p)); } catch (e) {} }
  function hairText(p) {
    if (!p || !p.type) return '';
    var Q = C.hairQuestions, parts = [];
    ['type', 'length', 'thick', 'state'].forEach(function (k) { if (p[k] && p[k] !== 'nsp' && Q[k] && Q[k][1][p[k]]) parts.push(String(Q[k][1][p[k]]).toLowerCase()); });
    if (p.porosity === 'vite' || p.porosity === 'lent') parts.push(p.porosity === 'vite' ? 'porosité forte' : 'porosité faible');
    var t = parts.join(', '); t = t.charAt(0).toUpperCase() + t.slice(1);
    if (p.goal) t += ' · objectif : ' + String(Q.goal[1][p.goal]).toLowerCase();
    return t;
  }

  /* ================= Squelette ================= */
  root.innerHTML =
    '<header class="top">' +
      (PRO
        ? '<nav class="tabs" aria-label="Espace coiffeur">' +
            '<button type="button" data-tab="pro" aria-current="page">Tableau de bord <span class="badge" id="cm-b-pending" hidden></span></button>' +
            '<button type="button" data-tab="clients">Clientes</button>' +
            '<button type="button" data-tab="proedit">Mon profil</button>' +
            '<button type="button" data-tab="inbox">Messages <span class="badge" id="cm-b-unread" hidden></span></button>' +
          '</nav>' +
          '<div class="side__links"><a href="' + esc(C.accountUrl) + '">Mon compte</a><a href="' + esc(C.logoutUrl) + '">Se déconnecter</a></div>'
        : '<nav class="tabs tabs--3" aria-label="Espace client">' +
            '<button type="button" data-tab="search" aria-current="page">Trouver</button>' +
            '<button type="button" data-tab="mine">Mes rendez-vous</button>' +
            '<button type="button" data-tab="inbox">Messages <span class="badge" id="cm-b-unread" hidden></span></button>' +
          '</nav>') +
    '</header>' +
    '<p class="msg" id="cm-roleNote" hidden></p>' +

    /* Recherche */
    '<section class="view search2" id="cm-v-search">' +
      '<aside class="filters">' +
        '<details class="filters__box" id="cm-filters" open><summary>Filtrer les résultats</summary>' +
          '<div class="filters__body">' +
            '<div class="diagbar" id="cm-diagbar"></div>' +
            '<div class="field"><span class="label" id="cm-l-hair">Vos cheveux</span><div class="chips" role="radiogroup" aria-labelledby="cm-l-hair" id="cm-hair"></div></div>' +
            '<label class="field"><span class="label">Prestation</span><select id="cm-service"></select></label>' +
            '<label class="field"><span class="label">Savoir-faire</span><select id="cm-skill"><option value="">Tous les savoir-faire</option>' + Object.keys(C.skills).map(function (k) { return '<option value="' + k + '">' + esc(C.skills[k]) + '</option>'; }).join('') + '</select></label>' +
            '<label class="field"><span class="label">Où</span><select id="cm-where"><option value="all">Salon ou domicile</option><option value="salon">Au salon</option><option value="domicile">À domicile</option></select></label>' +
            '<label class="field"><span class="label">Ville ou quartier</span><input id="cm-city" type="search" placeholder="Ex. : Paris 18e" autocomplete="address-level2"></label>' +
            '<label class="field"><span class="label">Trier par</span><select id="cm-sort"><option value="rating">Mieux notés</option><option value="soon">Disponible au plus tôt</option><option value="price">Prix le plus bas</option><option value="new">Nouveaux</option></select></label>' +
            '<label class="field"><span class="label">Prix</span><select id="cm-maxprice"><option value="">Tous les prix</option><option value="30">30 € max</option><option value="50">50 € max</option><option value="80">80 € max</option><option value="120">120 € max</option></select></label>' +
            '<div class="chips"><button type="button" class="chip sm" id="cm-avail" aria-pressed="false">Disponible demain</button><button type="button" class="chip sm" id="cm-onlyVerified" aria-pressed="false">Diplôme vérifié</button><button type="button" class="chip sm" id="cm-onlyFav" aria-pressed="false">Mes favoris</button></div>' +
          '</div>' +
        '</details>' +
      '</aside>' +
      '<div class="results">' +
        '<div class="results__head"><h1 class="results__title">Résultats de la recherche</h1>' +
          '<div class="viewtoggle" role="group" aria-label="Affichage des résultats"><button type="button" id="cm-asList" aria-pressed="true">Liste</button><button type="button" id="cm-asMap" aria-pressed="false">Carte</button></div></div>' +
        '<div class="recent" id="cm-recent" hidden></div>' +
        '<p class="count" id="cm-count" aria-live="polite"></p>' +
        '<div class="mapbox" id="cm-map" hidden></div>' +
        '<ul class="list" id="cm-results"></ul>' +
      '</div>' +
    '</section>' +

    /* Diagnostic cheveux */
    '<section class="view" id="cm-v-diag" hidden>' +
      '<div class="head"><button class="iconbtn" type="button" data-go="search" aria-label="Retour à la recherche">' + ICON.back + '</button><span class="sub" id="cm-diag-step" style="flex:1"></span></div>' +
      '<div class="progress" aria-hidden="true"><span id="cm-diag-bar"></span></div>' +
      '<h1 id="cm-diag-q"></h1><div class="stack" id="cm-diag-opts" role="radiogroup" aria-labelledby="cm-diag-q"></div>' +
      '<p class="sub small">Votre fiche cheveux sert à trouver les bons coiffeurs et leur est transmise quand vous réservez. Vous pouvez la modifier à tout moment.</p>' +
    '</section>' +

    /* Profil */
    '<section class="view" id="cm-v-profile" hidden>' +
      '<div class="head"><button class="iconbtn" type="button" data-go="search" aria-label="Retour aux résultats">' + ICON.back + '</button><span class="sub" style="flex:1">Résultats</span><button class="iconbtn" type="button" id="cm-p-fav" aria-pressed="false"></button></div>' +
      '<div id="cm-p-body"></div>' +
    '</section>' +

    /* Réservation */
    '<section class="view" id="cm-v-book" hidden>' +
      '<div class="head"><button class="iconbtn" type="button" data-go="profile" aria-label="Retour au profil">' + ICON.back + '</button><h1 id="cm-b-title" style="font-size:22px"></h1></div>' +
      '<div class="stack" id="cm-staffWrap" hidden><span class="label" id="cm-l-staff">Avec qui ?</span><div class="chips" role="radiogroup" aria-labelledby="cm-l-staff" id="cm-staff"></div></div>' +
      '<div class="stack" id="cm-lenWrap" hidden><span class="label" id="cm-l-len">Longueur de vos cheveux</span><div class="chips" role="radiogroup" aria-labelledby="cm-l-len" id="cm-len"></div><span class="sub small" id="cm-lenNote"></span></div>' +
      '<div class="stack"><span class="label">Jour</span><div class="days" id="cm-days"></div></div>' +
      '<div class="stack"><span class="label">Heure</span><div class="grid4" id="cm-hours"></div></div>' +
      '<div class="waitbox" id="cm-waitbox" hidden></div>' +
      '<form id="cm-bookForm" class="stack" style="gap:16px" novalidate>' +
        '<label class="field"><span class="label">Votre prénom</span><input id="cm-firstname" autocomplete="given-name" maxlength="40" placeholder="Ex. : Amaëlle"></label>' +
        '<label class="field"><span class="label">Votre téléphone</span><input id="cm-phone" type="tel" autocomplete="tel" maxlength="20" placeholder="Ex. : 06 12 34 56 78"><span class="sub small">Transmis au coiffeur uniquement, pour vous joindre le jour du rendez-vous.</span></label>' +
        '<label class="field" id="cm-addrField"><span class="label">Adresse du rendez-vous</span><input id="cm-address" autocomplete="street-address" maxlength="200" placeholder="Ex. : 12 rue des Lilas, 75019 Paris, 3e étage"></label>' +
        '<div class="hairnote" id="cm-b-hair"></div>' +
        '<div class="field bphotos-field"><span class="label">Photos de vos cheveux (facultatif)</span>' +
          '<span class="sub small">Vos cheveux aujourd\'hui, et ce que vous aimeriez : le coiffeur voit tout de suite le travail à prévoir. Visibles seulement par lui, effacées après le rendez-vous. 3 photos au plus.</span>' +
          '<div class="thumbs" id="cm-b-photos"></div>' +
          '<label class="ghost sm" for="cm-b-file" id="cm-b-addPhoto" style="align-self:flex-start;cursor:pointer">Ajouter une photo</label><input type="file" id="cm-b-file" accept="image/jpeg,image/png,image/webp" multiple hidden></div>' +
        '<p class="err" id="cm-formErr" role="alert" hidden></p>' +
        '<div class="box"><h2 style="font-size:17px">Récapitulatif</h2>' +
          '<div class="l"><span id="cm-r-service"></span><strong id="cm-r-price"></strong></div>' +
          '<div class="l sub"><span id="cm-r-when"></span></div>' +
          '<div class="l" id="cm-r-travelRow"><span>Frais de déplacement</span><strong id="cm-r-travel"></strong></div>' +
          '<div class="l" id="cm-r-totalRow"><span>Total</span><strong id="cm-r-total"></strong></div>' +
          '<div class="l sep" id="cm-r-depositRow"><span>Acompte</span><strong id="cm-r-deposit"></strong></div>' +
          '<div class="l sub" id="cm-r-restRow"><span>Reste à payer sur place</span><span id="cm-r-rest"></span></div>' +
          '<div class="l sep" id="cm-r-onsiteRow"><span>Paiement</span><strong>Sur place, au coiffeur</strong></div></div>' +
        '<p class="note">' + ICON.shield + '<span id="cm-b-note"></span></p>' +
        '<div class="bar"><button class="cta" type="submit" id="cm-confirm">Envoyer la demande</button></div>' +
      '</form>' +
    '</section>' +

    /* Confirmation */
    '<section class="view done" id="cm-v-done" hidden role="status">' +
      '<div class="tick">' + ICON.tick + '</div><h1 style="font-size:28px" id="cm-d-title"></h1>' +
      '<p style="font-size:17px" id="cm-d-text"></p><p class="sub" id="cm-d-sub"></p>' +
      '<div class="cal" id="cm-d-cal"></div>' +
      '<button class="ghost" type="button" data-tab="mine" style="width:100%">Voir mes rendez-vous</button>' +
    '</section>' +

    /* Mes RDV */
    '<section class="view" id="cm-v-mine" hidden>' +
      '<h1>Mes rendez-vous</h1><div class="cm-install" data-cm-install hidden></div><ul class="list" id="cm-mineList"></ul>' +
      '<div class="stack" id="cm-waitWrap" hidden><h2>Liste d\'attente</h2><ul class="list" id="cm-waitList"></ul></div>' +
      '<div class="stack"><h2>Mes favoris</h2><ul class="list" id="cm-favList"></ul></div>' +
    '</section>' +

    /* Avis */
    '<section class="view" id="cm-v-review" hidden>' +
      '<div class="head"><button class="iconbtn" type="button" data-tab="mine" aria-label="Retour à mes rendez-vous">' + ICON.back + '</button><h1 style="font-size:22px" id="cm-rv-title"></h1></div>' +
      '<form id="cm-reviewForm" class="stack" style="gap:16px" novalidate>' +
        '<fieldset class="stack plain"><legend class="label">Votre note</legend><div class="stars" id="cm-stars"></div></fieldset>' +
        '<label class="field"><span class="label">Votre avis</span><textarea id="cm-rv-text" maxlength="600" placeholder="Ex. : elle a su respecter mes boucles."></textarea></label>' +
        '<label class="field"><span class="label">Une photo du résultat (facultatif)</span><input type="file" id="cm-rv-photo" accept="image/jpeg,image/png,image/webp"><span class="sub small">Elle sera visible sur le profil du coiffeur. JPG, PNG ou WebP, 6 Mo maximum.</span></label>' +
        '<p class="err" id="cm-rvErr" role="alert" hidden></p>' +
        '<button class="cta" type="submit" id="cm-rvSave">Publier mon avis</button>' +
      '</form>' +
    '</section>' +

    /* Messages */
    '<section class="view" id="cm-v-inbox" hidden><h1>Messages</h1><ul class="list" id="cm-threadList"></ul></section>' +
    '<section class="view" id="cm-v-thread" hidden>' +
      '<div class="head"><button class="iconbtn" type="button" data-tab="inbox" aria-label="Retour aux messages">' + ICON.back + '</button><h1 id="cm-t-title" style="font-size:22px"></h1></div>' +
      '<div class="thread" id="cm-t-msgs" aria-live="polite"></div>' +
      '<form class="bar composer" id="cm-t-form" novalidate>' +
        '<label for="cm-t-text" class="sr">Votre message</label><textarea id="cm-t-text" maxlength="1000" placeholder="Votre message…"></textarea>' +
        '<button class="iconbtn primary" type="submit" aria-label="Envoyer">' + ICON.send + '</button>' +
      '</form>' +
    '</section>' +

    /* Espace coiffeur */
    '<section class="view" id="cm-v-pro" hidden><h1>Tableau de bord</h1><div id="cm-pro-body" class="stack" style="gap:20px"></div></section>' +
    '<section class="view" id="cm-v-clients" hidden><h1>Mes clientes</h1><p class="sub">Retrouvez chaque cliente, ses cheveux, son historique, et gardez vos notes (visibles par vous seul).</p><ul class="list" id="cm-clientList"></ul></section>' +
    '<section class="view" id="cm-v-proedit" hidden><form id="cm-proForm" class="stack" style="gap:16px" novalidate><p class="sub">Chargement…</p></form></section>' +

    '<div class="toast" id="cm-toast" hidden role="status"></div>';

  /* ================= Navigation ================= */
  function route(q) {
    var pro = parseInt(q.get('pro'), 10), tab = q.get('tab');
    if (q.get('hair') && C.hair[q.get('hair')] && q.get('hair') !== S.hair) { S.hair = q.get('hair'); S.lastList = null; renderHair(); }
    if (q.get('diag')) { S.diagReturn = current(); S.diagDraft = null; show('diag'); }
    else if (pro) { if (S.pro && S.pro.id === pro) show('profile'); else openPro(pro, q.get('presta') ? { pick: q.get('presta') } : null); }
    else if (tab === 'mine' || tab === 'inbox') show(tab);
    else show('search');
  }
  var VIEWS = ['search', 'diag', 'profile', 'book', 'done', 'mine', 'review', 'inbox', 'thread', 'pro', 'clients', 'proedit'];
  function current() { for (var i = 0; i < VIEWS.length; i++) if (!$('v-' + VIEWS[i]).hidden) return VIEWS[i]; }
  /* L'adresse suit l'écran affiché : le bouton « retour » du navigateur et les liens partagés marchent sans recharger la page. */
  function urlFor(v) {
    var base = location.pathname;
    if (v === 'search') { var q = []; if (S.hair) q.push('hair=' + encodeURIComponent(S.hair)); if (S.skill) q.push('savoir=' + encodeURIComponent(S.skill)); if (S.city) q.push('ville=' + encodeURIComponent(S.city)); return base + (q.length ? '?' + q.join('&') : ''); }
    if (v === 'profile' && S.proId) return base + '?pro=' + S.proId;
    if (v === 'mine' || v === 'inbox') return base + '?tab=' + v;
    if (v === 'diag') return base + '?diag=1';
    return null;
  }
  function syncUrl(v) {
    if (PRO || S.fromPop || !window.history || !history.pushState) return;
    var u = urlFor(v);
    if (u && u !== location.pathname + location.search) history.pushState({ cm: v }, '', u);
  }
  function show(v) {
    if (S.poll) { clearInterval(S.poll); S.poll = null; }
    syncUrl(v);
    VIEWS.forEach(function (n) { $('v-' + n).hidden = n !== v; });
    var tab = { mine: 'mine', review: 'mine', inbox: 'inbox', thread: 'inbox', pro: 'pro', proedit: 'proedit', clients: 'clients' }[v] || 'search';
    root.querySelectorAll('.tabs button').forEach(function (t) { t.setAttribute('aria-current', t.dataset.tab === tab ? 'page' : 'false'); });
    var top = root.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
    if (v === 'search' && S.lastList) {
      renderResults(S.lastList); renderRecent();
      if (S.searchScroll != null) { var y = S.searchScroll; S.searchScroll = null; requestAnimationFrame(function () { window.scrollTo(0, y); }); }
      return;
    }
    var r = { search: function () { renderRecent(); loadResults(); }, profile: renderProfile, book: renderBook, mine: loadMine, review: renderReview, inbox: loadInbox, thread: loadThread, pro: loadPro, proedit: loadProEdit, clients: loadClients, diag: renderDiag }[v];
    if (r) r();
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab],[data-go]');
    if (!b || !root.contains(b)) return;
    var v = b.dataset.tab || b.dataset.go;
    // Retour aux résultats depuis un profil : comme le bouton « retour » du navigateur.
    if (v === 'search' && current() === 'profile' && history.state && history.state.cm === 'profile') { history.back(); return; }
    if (v === 'diag') { S.diagReturn = current(); S.diagDraft = null; }
    show(v);
  });

  function refreshMe() {
    return api('me').then(function (me) {
      S.me = me;
      if (me.loggedIn) {
        var server = me.hairProfile || {};
        if (server.type) { S.hairProfile = server; saveLocalHair(server); }
        else if (S.hairProfile && S.hairProfile.type && !PRO) api('me/hair', { method: 'POST', body: S.hairProfile }).catch(function () {});
      }
      renderDiagBar();
      $('b-unread').hidden = !me.unread; $('b-unread').textContent = me.unread || '';
      // Pastille « messages non lus » sur le menu de la cliente, dans l'en-tête du site.
      var acct = document.querySelector('.acct > summary');
      if (acct) acct.classList.toggle('has-unread', !!me.unread);
      if ($('b-pending')) { $('b-pending').hidden = !me.pending; $('b-pending').textContent = me.pending || ''; }
      // Un compte coiffeur qui ouvre l'espace client : il est renvoyé vers son espace.
      var note = $('roleNote');
      if (!PRO && me.role === 'coiffeur') {
        note.innerHTML = 'Vous êtes connecté avec un compte coiffeur. Les réservations se font avec un compte client. <a href="' + esc(C.proUrl) + '">Aller à mon espace coiffeur</a>';
        note.hidden = false;
      } else note.hidden = true;
      return me;
    }).catch(function () { return S.me; });
  }
  function isFav(id) { return (S.me.favs || []).indexOf(+id) !== -1; }
  function toggleFav(id) {
    if (!S.me.loggedIn) { toast('Connectez-vous pour enregistrer vos favoris'); return Promise.resolve(); }
    return api('favs/' + id, { method: 'POST' }).then(function (r) {
      S.me.favs = r.favs; toast(r.fav ? 'Ajouté à vos favoris' : 'Retiré de vos favoris');
    }).catch(function (e) { toast(e.message); });
  }

  /* ================= Recherche ================= */
  $('service').innerHTML = '<option value="">Toutes les prestations</option>' + SERVICES.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + '</option>'; }).join('');
  $('service').value = S.service; $('where').value = S.where; $('city').value = S.city; $('sort').value = S.sort; $('skill').value = S.skill;
  $('skill').onchange = function (e) { S.skill = e.target.value; loadResults(); };
  if (window.matchMedia && !window.matchMedia('(min-width: 960px)').matches) $('filters').open = false;
  $('service').onchange = function (e) { S.service = e.target.value; loadResults(); };
  $('where').onchange = function (e) { S.where = e.target.value; loadResults(); };
  $('sort').onchange = function (e) { S.sort = e.target.value; loadResults(); };
  var cityTimer;
  $('city').oninput = function (e) { S.city = e.target.value.trim(); clearTimeout(cityTimer); cityTimer = setTimeout(loadResults, 300); };
  $('onlyFav').onclick = function () {
    if (!S.me.loggedIn) { toast('Connectez-vous pour voir vos favoris'); return; }
    S.onlyFav = !S.onlyFav; this.setAttribute('aria-pressed', S.onlyFav); loadResults();
  };
  $('onlyVerified').onclick = function () { S.onlyVerified = !S.onlyVerified; this.setAttribute('aria-pressed', S.onlyVerified); loadResults(); };
  $('avail').onclick = function () { S.avail = !S.avail; this.setAttribute('aria-pressed', S.avail); loadResults(); };
  $('maxprice').onchange = function (e) { S.maxprice = e.target.value; loadResults(); };
  function syncFilters() {
    $('service').value = S.service; $('where').value = S.where; $('city').value = S.city; $('maxprice').value = S.maxprice; $('skill').value = S.skill;
    $('avail').setAttribute('aria-pressed', S.avail); $('onlyVerified').setAttribute('aria-pressed', S.onlyVerified); $('onlyFav').setAttribute('aria-pressed', S.onlyFav);
  }
  $('asList').onclick = function () { setView(false); };
  $('asMap').onclick = function () { setView(true); };

  function renderDiagBar() {
    var bar = $('diagbar'); if (!bar) return;
    var t = hairText(S.hairProfile);
    bar.innerHTML = t
      ? '<span><strong>Vos cheveux :</strong> ' + esc(t) + '</span><button type="button" class="link" data-go="diag">Modifier</button>'
      : '<span>Pas sûre de votre type ?</span><button type="button" class="link" data-go="diag">Faire le diagnostic</button>';
  }
  var DIAG_KEYS = ['type', 'length', 'thick', 'state', 'porosity', 'goal'];
  function renderDiag() {
    if (!S.diagDraft) { S.diagDraft = JSON.parse(JSON.stringify(S.hairProfile || {})); S.diagStep = 0; }
    var k = DIAG_KEYS[S.diagStep], q = C.hairQuestions[k];
    $('diag-step').textContent = 'Question ' + (S.diagStep + 1) + ' sur ' + DIAG_KEYS.length;
    $('diag-bar').style.width = (100 * S.diagStep / DIAG_KEYS.length) + '%';
    $('diag-q').textContent = q[0];
    var box = $('diag-opts'); box.innerHTML = '';
    Object.keys(q[1]).forEach(function (v) {
      var b = el('<button type="button" class="opt" role="radio"></button>');
      b.setAttribute('aria-checked', S.diagDraft[k] === v);
      b.innerHTML = (k === 'type' ? '<span class="tex tex--' + v + '" aria-hidden="true"></span>' : '') + '<span style="flex:1;text-align:left"><strong>' + esc(q[1][v]) + '</strong></span>';
      b.onclick = function () {
        S.diagDraft[k] = v;
        if (S.diagStep < DIAG_KEYS.length - 1) { S.diagStep++; renderDiag(); return; }
        S.hairProfile = S.diagDraft; S.diagDraft = null; saveLocalHair(S.hairProfile);
        S.hair = S.hairProfile.type;
        if (S.hairProfile.goal === 'protection') S.service = 'tresses';
        else if (S.hairProfile.goal === 'couleur') S.service = 'couleur';
        $('service').value = S.service;
        if (S.me.loggedIn) api('me/hair', { method: 'POST', body: S.hairProfile }).catch(function () {});
        renderHair(); renderDiagBar(); toast('Fiche cheveux enregistrée');
        if (S.diagReturn === 'book' && S.pro) { S.diagReturn = null; show('book'); } else show('search');
      };
      box.appendChild(b);
    });
  }

  function renderHair() {
    $('hair').innerHTML = HAIR.map(function (h) {
      return '<button type="button" class="chip" role="radio" aria-checked="' + (S.hair === h[0]) + '" data-h="' + h[0] + '">' + esc(h[1]) + '</button>';
    }).join('');
    $('hair').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.hair = b.dataset.h; renderHair(); loadResults(); }; });
  }

  function loadResults() {
    var seq = ++S.searchSeq;
    $('count').textContent = 'Recherche des coiffeurs…';
    if (!S.lastList) $('results').innerHTML = skeleton(3);
    api('pros', { params: { hair: S.hair, service: S.service, where: S.where === 'all' ? '' : S.where, city: S.city, sort: S.sort, skill: S.skill, verified: S.onlyVerified ? 1 : '', fav: S.onlyFav ? 1 : '', avail: S.avail ? 'tomorrow' : '', maxprice: S.maxprice } })
      .then(function (r) { if (seq === S.searchSeq) renderResults(r.pros); })
      .catch(function (e) { if (seq === S.searchSeq) { $('count').textContent = ''; $('results').innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; } });
  }
  /* Carte : Leaflet est chargé seulement quand on ouvre la vue Carte. */
  var MAP = { lib: null, map: null, layer: null };
  function loadLeaflet() {
    if (MAP.lib) return MAP.lib;
    MAP.lib = new Promise(function (ok, ko) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = C.leaflet.css; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = C.leaflet.js; js.onload = function () { ok(window.L); }; js.onerror = function () { MAP.lib = null; ko(new Error('La carte n\'a pas pu être chargée.')); };
      document.head.appendChild(js);
    });
    return MAP.lib;
  }
  function setView(asMap) {
    S.asMap = asMap;
    $('asList').setAttribute('aria-pressed', !asMap); $('asMap').setAttribute('aria-pressed', asMap);
    $('map').hidden = !asMap; $('results').hidden = asMap;
    if (asMap) drawMap();
  }
  function drawMap() {
    var box = $('map');
    loadLeaflet().then(function (L) {
      if (!MAP.map) {
        MAP.map = L.map(box, { scrollWheelZoom: false }).setView([48.86, 2.35], 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(MAP.map);
        MAP.layer = L.layerGroup().addTo(MAP.map);
      }
      MAP.map.invalidateSize();
      MAP.layer.clearLayers();
      var pts = [];
      (S.lastList || []).forEach(function (p) {
        if (!p.geo) return;
        var icon = L.divIcon({ className: 'pin', html: '<span>' + p.minPrice + ' €</span>', iconSize: null });
        var m = L.marker(p.geo, { icon: icon, title: p.name, keyboard: true }).addTo(MAP.layer);
        var pop = el('<div class="pop"><strong>' + esc(p.name) + '</strong><span>' + (p.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + esc(p.place) + '</span>' +
          (p.next ? '<span>Prochaine dispo : ' + esc(p.next.label) + '</span>' : '') + '<button type="button" class="cta">Voir le profil</button>' +
          (p.mode === 'domicile' ? '<span class="small">Position approximative : se déplace chez vous.</span>' : '') + '</div>');
        pop.querySelector('button').onclick = function () { openPro(p.id); };
        m.bindPopup(pop);
        pts.push(p.geo);
      });
      if (pts.length) MAP.map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
      var miss = (S.lastList || []).length - pts.length;
      $('count').innerHTML = $('count').innerHTML.replace(/ · <em>.*<\/em>$/, '') + (miss > 0 ? ' · <em>' + plural(miss, 'coiffeur', 'coiffeurs') + ' sans adresse sur la carte</em>' : '');
    }).catch(function (e) { box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  function filterCount() {
    var n = (!!S.skill) + (S.where !== 'all') + (!!S.city) + (!!S.avail) + (!!S.onlyVerified) + (!!S.onlyFav) + (!!S.maxprice) + (S.service === '');
    var sm = document.querySelector('#cm-filters > summary');
    if (sm) sm.innerHTML = 'Filtrer les résultats' + (n ? ' <span class="fcount">' + n + '</span>' : '');
  }
  function renderResults(list) {
    var ul = $('results');
    var rt = root.querySelector('.results__title');
    if (rt) rt.textContent = 'Coiffeurs pour cheveux ' + hairLabel(S.hair).toLowerCase();
    filterCount();
    S.lastList = list;
    if (S.asMap) setTimeout(drawMap, 0);
    $('count').innerHTML = list.length ? '<strong>' + plural(list.length, 'coiffeur', 'coiffeurs') + '</strong> pour les cheveux ' + esc(hairLabel(S.hair).toLowerCase()) + ' · ' + esc(svcLabel(S.service).toLowerCase()) : '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty">Aucun coiffeur ne correspond à tous ces critères.<div class="empty__acts"></div></li>';
      var acts = ul.querySelector('.empty__acts');
      function act(label, fn) { var x = el('<button type="button" class="ghost sm">' + esc(label) + '</button>'); x.onclick = function () { fn(); syncFilters(); loadResults(); }; acts.appendChild(x); }
      if (S.skill) act('Tous les savoir-faire', function () { S.skill = ''; });
      if (S.city) act('Toutes les villes', function () { S.city = ''; });
      if (S.where !== 'all') act('Salon ou domicile', function () { S.where = 'all'; });
      if (S.avail || S.maxprice || S.onlyVerified || S.onlyFav) act('Retirer les filtres', function () { S.avail = false; S.maxprice = ''; S.onlyVerified = false; S.onlyFav = false; });
      act('Toutes les prestations', function () { S.service = ''; });
      return;
    }
    ul.innerHTML = '';
    list.forEach(function (p) {
      var li = el('<li class="cardwrap"></li>');
      li.className = 'cardwrap rc';
      li.innerHTML = '<button type="button" class="card rc__card">' + photoBox(p, 0, 'Réalisation de ' + p.name, 'rc__img') +
        (p.example ? '<span class="rc__tag">Exemple</span>' : '') +
        '<span class="rc__body"><span class="rc__top"><span class="name">' + esc(p.name) + (p.verified ? ' <span class="rc__ok" title="Diplôme vérifié" aria-label="Diplôme vérifié">✓</span>' : '') + '</span>' +
          '<span class="rc__rate">' + (p.rating && p.rating.n ? '★ ' + fmtAvg(p.rating.avg) + ' <small>(' + p.rating.n + ')</small>' : '<small>Nouveau</small>') + '</span></span>' +
          '<span class="sub">' + (p.mode === 'domicile' ? 'À domicile' : 'Salon') + ' · ' + esc(p.place) + (p.staff && p.staff.length > 1 ? ' · ' + p.staff.length + ' coiffeurs' : '') + '</span>' +
          (p.skills && p.skills.length ? '<span class="rc__skills">' + p.skills.slice(0, 2).map(function (k) { return esc(C.skills[k] || k); }).join(' · ') + '</span>' : '') +
          '<span class="price">' + (S.service ? esc(svcLabel(S.service)) + ' dès ' : 'Dès ') + p.minPrice + ' €</span>' +
          (p.next ? '' : '<span class="sub small">Pas de créneau libre dans les 2 semaines</span>') + '</span></button>' +
        (p.next ? '<button type="button" class="nextslot">' + esc(p.next.label.charAt(0).toUpperCase() + p.next.label.slice(1)) + ' · <strong>Réserver</strong></button>' : '') +
        '<button type="button" class="heart" aria-pressed="' + isFav(p.id) + '" aria-label="' + (isFav(p.id) ? 'Retirer des favoris' : 'Ajouter aux favoris') + '">' + ICON.heart(isFav(p.id)) + '</button>';
      li.querySelector('.card').onclick = function () { openPro(p.id); };
      li.addEventListener('pointerenter', function () { preload(p.id); }, { once: true });
      li.addEventListener('touchstart', function () { preload(p.id); }, { once: true, passive: true });
      var ns = li.querySelector('.nextslot');
      if (ns) ns.onclick = function () { openPro(p.id, { presta: p.nextPresta, date: p.next.date, hour: p.next.hour, staff: p.next.staff || null }); };
      li.querySelector('.heart').onclick = function () {
        var h = this;
        toggleFav(p.id).then(function () { h.setAttribute('aria-pressed', isFav(p.id)); h.innerHTML = ICON.heart(isFav(p.id)); if (S.onlyFav) loadResults(); });
      };
      ul.appendChild(li);
    });
  }

  /* ================= Profil ================= */
  /* Profil préchargé dès que la souris (ou le doigt) se pose sur une carte : il s'ouvre aussitôt. */
  var PROCACHE = {};
  function preload(id) {
    if (PROCACHE[id] && Date.now() - PROCACHE[id].t < 60000) return;
    var pr = api('pros/' + id, { params: { pre: 1 }, quiet: true });
    pr.catch(function () { delete PROCACHE[id]; });
    PROCACHE[id] = { t: Date.now(), p: pr };
  }
  function openPro(id, preset) {
    S.proId = id;
    if (current() === 'search') S.searchScroll = window.scrollY;
    $('p-body').innerHTML = '<div class="sk sk--pv" aria-label="Chargement du profil"><i class="sk__t"></i><i class="sk__s"></i><div class="sk__g"><i></i><i></i><i></i></div></div>';
    S.pro = null; S.revFilter = 'all';
    show('profile');
    var cached = PROCACHE[id] && Date.now() - PROCACHE[id].t < 60000 ? PROCACHE[id].p : null;
    if (cached) api('pros/' + id + '/view', { method: 'POST' }).catch(function () {});
    delete PROCACHE[id];
    return (cached || api('pros/' + id)).then(function (p) {
      S.pro = p;
      recentAdd(p);
      var ok = p.presta.filter(function (x) { return x.service === S.service; });
      S.presta = p.presta.length ? (ok[0] || p.presta[0]).k : null;
      if (preset && preset.pick && p.presta.some(function (x) { return x.k === preset.pick; })) S.presta = preset.pick;
      S.staff = null; S.length = '';
      pickStaff();
      renderProfile();
      // « Reprendre rendez-vous » : même coiffeur, même prestation, premier jour ouvert.
      if (preset && preset.book) {
        if (!S.me.loggedIn) { location.href = loginUrl('pro=' + p.id); return; }
        S.day = firstOpenDay(); S.hour = null; $('formErr').hidden = true; show('book');
        return;
      }
      // Réservation en un clic depuis « Prochaine dispo » : on va directement au créneau choisi.
      if (preset && preset.presta) {
        S.presta = preset.presta;
        S.staff = preset.staff || null; pickStaff();
        if (!S.me.loggedIn) { location.href = loginUrl('pro=' + p.id); return; }
        if (S.me.role === 'coiffeur') { toast('Connectez-vous avec un compte client pour réserver'); return; }
        var di = bookDays().map(function (d) { return d.date; }).indexOf(preset.date);
        S.day = di === -1 ? firstOpenDay() : di; S.hour = di === -1 ? null : preset.hour;
        $('formErr').hidden = true; show('book');
      }
    }).catch(function (e) { $('p-body').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  function cur() { return S.pro && S.pro.presta.filter(function (x) { return x.k === S.presta; })[0]; }

  function renderProfile() {
    var p = S.pro;
    if (!p) return;
    var fav = isFav(p.id);
    $('p-fav').setAttribute('aria-pressed', fav); $('p-fav').innerHTML = ICON.heart(fav);
    $('p-fav').setAttribute('aria-label', fav ? 'Retirer des favoris' : 'Ajouter aux favoris');
    $('p-fav').onclick = function () { toggleFav(p.id).then(renderProfile); };
    var n = Math.max(3, Math.min(7, p.photos.length));
    var gallery = ''; for (var i = 0; i < n; i++) gallery += photoBox(p, i, 'Réalisation ' + (i + 1) + ' de ' + p.name, i === 0 ? 'big' : '');
    var bA = p.photos.filter(function (x) { return x.tag === 'avant'; })[0], aA = p.photos.filter(function (x) { return x.tag === 'apres'; })[0];
    var ba = bA && aA ? '<section class="pv__sec"><h2>Avant / après</h2><div class="ba" data-lb><figure><img src="' + esc(bA.url) + '" alt="Avant"><figcaption>Avant</figcaption></figure><figure><img src="' + esc(aA.url) + '" alt="Après"><figcaption>Après</figcaption></figure></div></section>' : '';
    var dipl = p.verified ? '' : (p.diploma ? '<span class="pill warn">Diplôme déclaré : ' + esc(p.diploma) + ' (non vérifié)</span>' : '');
    var prices = p.presta.map(function (x) { return +x.price; });
    var nf = nextFree(p);
    var where = p.mode === 'domicile'
      ? '<div class="where"><strong>Se déplace à domicile</strong>' + (p.zones && p.zones.length ? '<span class="sub">' + esc(p.zones.join(', ')) + '</span>' : '<span class="sub">' + esc(p.place) + '</span>') +
        '<span class="sub">' + (p.travel ? 'Frais de déplacement : ' + p.travel + ' €' : 'Déplacement offert') + '</span></div>'
      : (p.address ? '<div class="where"><strong>Adresse du salon</strong><span class="sub">' + esc(p.address) + '</span><a class="small" href="' + esc(mapsUrl(p.address)) + '" target="_blank" rel="noopener">Voir sur la carte</a></div>' : '');
    var body = $('p-body');
    body.innerHTML =
      (p.status && p.status !== 'publish' ? '<p class="msg">Aperçu : ce profil n\'est pas encore en ligne.</p>' : '') +
      '<header class="pv__head"><h1>' + esc(p.name) + '</h1>' +
        '<p class="sub">' + (p.mode === 'domicile' ? 'Coiffure à domicile · ' : 'Coiffure en salon · ') + esc(p.place) + ' · ' + (p.rating.n ? '<a href="#cm-p-reviews" class="rlink">' + ratingText(p.rating) + '</a>' : 'Pas encore d\'avis') + '</p>' +
        '<div class="chips">' + badges(p) + dipl + '</div></header>' +
      '<div class="pv__grid"><div class="pv__main">' +
        '<div class="gallery gallery--pv" data-lb>' + gallery + '</div>' + ba +
        '<section class="pv__sec"><h2>À propos</h2>' +
          (p.hairStats && p.hairStats[S.hair] ? '<p class="spec">★ ' + fmtAvg(p.hairStats[S.hair].avg) + ' · ' + plural(p.hairStats[S.hair].n, 'avis', 'avis') + ' de clientes aux cheveux ' + esc(hairLabel(S.hair).toLowerCase()) + '</p>' : '') +
          (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : '') +
          '<ul class="tags" aria-label="Types de cheveux et spécialités">' + p.hair.map(function (h) { return '<li>Cheveux ' + esc(hairLabel(h).toLowerCase()) + '</li>'; }).join('') + p.tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          ((p.skills || []).length ? '<div class="skills"><h3>Savoir-faire</h3><ul class="skills__list">' + p.skills.map(function (k) { return '<li>' + esc(C.skills[k] || k) + '</li>'; }).join('') + '</ul><p class="sub small">Déclarés par le coiffeur.</p></div>' : '') +
          ((p.staff || []).length ? '<div class="team"><h3>L\'équipe</h3><p class="sub">' + p.staff.map(function (m) { return esc(m.name); }).join(', ') + ' · vous choisissez avec qui au moment de réserver.</p></div>' : '') +
          where + '</section>' +
        '<section class="pv__sec"><h2 id="cm-l-presta">Prestations</h2><div role="radiogroup" aria-labelledby="cm-l-presta" class="stack" id="cm-p-presta"></div></section>' +
        '<section class="pv__sec"><h2>Avis</h2><div class="chips" id="cm-p-revfilter"></div><div class="stack" id="cm-p-reviews"></div></section>' +
        '<div id="cm-p-report"></div>' +
      '</div>' +
      '<aside class="pv__side"><div class="pv__card">' +
        (prices.length ? '<p class="pv__from">À partir de <strong>' + Math.min.apply(null, prices) + ' €</strong></p>' : '') +
        '<p class="pv__next">' + (nf ? 'Prochain créneau : <strong>' + esc(nf) + '</strong>' : 'Aucun créneau libre dans les 2 semaines') + '</p>' +
        '<button class="cta" type="button" id="cm-toBook"></button>' +
        (p.isMine ? '' : '<button class="ghost" type="button" id="cm-p-msg">Envoyer un message</button>') +
        '<button type="button" class="link" id="cm-p-share">Partager ce profil</button>' +
        '<p class="sub small">Gratuit, paiement au coiffeur. Annulation sans frais jusqu\'à ' + C.cancelHours + ' h avant.</p>' +
      '</div></aside></div>' +
      '<div class="bar bar--mobile"><button class="cta" type="button" id="cm-toBook2"></button></div>';

    var rv = $('p-reviews'), rf = $('p-revfilter');
    var sameHair = p.reviews.filter(function (v) { return v.hair === S.hair; });
    if (p.reviews.length && sameHair.length && sameHair.length < p.reviews.length) {
      rf.innerHTML = '<button type="button" class="chip sm" data-f="all">Tous (' + p.reviews.length + ')</button><button type="button" class="chip sm" data-f="mine">Cheveux ' + esc(hairLabel(S.hair).toLowerCase()) + ' comme les vôtres (' + sameHair.length + ')</button>';
      rf.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', S.revFilter === b.dataset.f);
        b.onclick = function () { S.revFilter = b.dataset.f; renderProfile(); };
      });
    }
    var shown = S.revFilter === 'mine' ? sameHair : p.reviews;
    if (!p.reviews.length) rv.innerHTML = '<p class="sub">Pas encore d\'avis. Seules les clientes venues à un rendez-vous peuvent en laisser un.</p>';
    shown.forEach(function (v) {
      var q = el('<blockquote class="quote"></blockquote>');
      q.innerHTML = '<span><span aria-label="' + v.rating + ' sur 5">' + '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating) + '</span> ' + esc(v.body) + '</span>' +
        (v.photo ? '<img class="rvph" data-lb src="' + esc(v.photo) + '" alt="Photo de la cliente après le rendez-vous" loading="lazy">' : '') +
        '<footer>' + esc(v.firstName || 'Client') + (v.hair ? ' · cheveux ' + esc(hairLabel(v.hair).toLowerCase()) : '') + ' · ' + esc(v.date) + '</footer>' +
        (v.reply ? '<div class="reply"><strong>Réponse du coiffeur :</strong> ' + esc(v.reply) + '</div>' : '');
      if (S.me.loggedIn && !p.isMine) {
        var b = el('<button type="button" class="link danger small">Signaler cet avis</button>');
        b.onclick = function () { openReport('review', v.id, q); };
        q.appendChild(b);
      }
      rv.appendChild(q);
    });
    if (S.me.loggedIn && !p.isMine && !p.example) {
      var rb = el('<button type="button" class="link danger">Signaler ce profil</button>');
      rb.onclick = function () { openReport('pro', p.id, $('p-report')); };
      $('p-report').appendChild(rb);
    }
    $('p-share').onclick = function () { copyText(p.url || (C.appUrl + (C.appUrl.indexOf('?') === -1 ? '?' : '&') + 'pro=' + p.id), 'Lien du profil copié'); };
    var msg = $('p-msg');
    if (msg) msg.onclick = function () {
      if (!S.me.loggedIn) { location.href = loginUrl('pro=' + p.id); return; }
      S.thread = { pro: p.id, client: S.me.id }; show('thread');
    };
    $('toBook').onclick = $('toBook2').onclick = function () {
      if (!S.me.loggedIn) { location.href = loginUrl('pro=' + p.id); return; }
      if (S.me.role === 'coiffeur') { toast('Connectez-vous avec un compte client pour réserver'); return; }
      S.day = firstOpenDay(); S.hour = null; $('formErr').hidden = true; show('book');
    };
    renderPresta();
  }
  function renderPresta() {
    var p = S.pro, box = $('p-presta');
    box.innerHTML = p.presta.length ? '' : '<p class="sub">Aucune prestation pour l\'instant.</p>';
    p.presta.forEach(function (x) {
      var b = el('<button type="button" class="opt" role="radio"></button>');
      b.setAttribute('aria-checked', S.presta === x.k);
      b.innerHTML = '<span><strong>' + esc(x.label) + '</strong><br><span class="sub">' + esc(svcLabel(x.service)) + ' · ' + fmtDur(x.dur) + '</span>' + (hasPlus(x) ? '<br><span class="sub small">Cheveux courts · ' + esc(plusText(x)) + '</span>' : '') + '</span><strong>' + (hasPlus(x) ? 'dès ' : '') + x.price + ' €</strong>';
      b.onclick = function () { S.presta = x.k; pickStaff(); renderPresta(); var nx = root.querySelector('.pv__next'); if (nx) { var nf = nextFree(p); nx.innerHTML = nf ? 'Prochain créneau : <strong>' + esc(nf) + '</strong>' : 'Aucun créneau libre dans les 2 semaines'; } };
      box.appendChild(b);
    });
    var c = cur();
    [$('toBook'), $('toBook2')].forEach(function (btn) {
      btn.disabled = !!p.isMine || !c || (p.status && p.status !== 'publish');
      btn.textContent = p.isMine ? 'C\'est votre profil' : (c ? 'Choisir un créneau · ' + (hasPlus(c) ? 'dès ' : '') + c.price + ' €' : 'Choisir un créneau');
    });
  }
  function openReport(type, id, host) {
    if (host.querySelector('.inline')) return;
    var f = el('<div class="inline"></div>');
    f.innerHTML = '<label class="field"><span class="label">Motif du signalement</span><select>' + REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></label>' +
      '<div class="row"><button type="button" class="ghost">Envoyer le signalement</button><button type="button" class="link">Annuler</button></div>';
    var bs = f.querySelectorAll('button');
    bs[1].onclick = function () { f.remove(); };
    bs[0].onclick = function () {
      busy(bs[0], true);
      api('reports', { method: 'POST', body: { type: type, target_id: id, reason: f.querySelector('select').value } })
        .then(function () { f.innerHTML = '<p class="sub">Merci, votre signalement a été transmis à l\'équipe.</p>'; })
        .catch(function (e) { busy(bs[0], false); toast(e.message); });
    };
    host.appendChild(f);
  }

  /* ================= Réservation ================= */
  function curDur() { var c = cur(); return c ? +c.dur : 60; }
  function firstOpenDay() {
    var days = bookDays(), dur = curDur();
    for (var i = 0; i < days.length; i++) if (days[i].hours.some(function (h) { return fits(days[i], h, dur); })) return i;
    return 0;
  }
  function renderBook() {
    var p = S.pro;
    if (!p) return show('search');
    var c = cur();
    $('b-title').textContent = 'Réserver avec ' + p.name;
    // Avec qui ? (salon avec plusieurs coiffeurs)
    var team = (p.staff || []).length ? staffFor(p, S.presta) : [];
    $('staffWrap').hidden = !team.length;
    $('staff').innerHTML = team.map(function (m) { return '<button type="button" class="chip" role="radio" aria-checked="' + (S.staff === m.k) + '" data-k="' + esc(m.k) + '">' + esc(m.name) + '</button>'; }).join('');
    $('staff').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.staff = b.dataset.k; S.hour = null; S.day = firstOpenDay(); renderBook(); }; });
    // Longueur des cheveux, quand le prix en dépend.
    var plus = hasPlus(c);
    if (plus && !S.length && S.hairProfile && C.lengths[S.hairProfile.length]) S.length = S.hairProfile.length;
    $('lenWrap').hidden = !plus;
    $('len').innerHTML = plus ? Object.keys(C.lengths).map(function (k) { return '<button type="button" class="chip" role="radio" aria-checked="' + (S.length === k) + '" data-k="' + k + '">' + esc(C.lengths[k]) + ' · ' + priceFor(c, k) + ' €</button>'; }).join('') : '';
    $('len').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.length = b.dataset.k; $('formErr').hidden = true; renderBook(); }; });
    $('lenNote').textContent = plus ? 'Le prix de cette prestation dépend de la longueur de vos cheveux.' : '';
    var pdays = bookDays();
    if (S.day >= pdays.length) S.day = 0;
    var days = $('days'); days.innerHTML = '';
    var dur = curDur();
    pdays.forEach(function (d, i) {
      var closed = !d.hours.length, full = !closed && d.hours.every(function (h) { return !fits(d, h, dur); });
      var b = el('<button type="button" class="slot"></button>');
      b.innerHTML = '<small>' + DOW[d.dow] + '</small>' + d.day;
      b.setAttribute('aria-pressed', S.day === i);
      b.setAttribute('aria-label', d.label + (closed ? ', fermé' : full ? ', complet' : ''));
      if (closed || full) b.classList.add('taken');
      b.onclick = function () { S.day = i; S.hour = null; renderBook(); };
      days.appendChild(b);
    });
    var day = pdays[S.day], hours = $('hours');
    hours.innerHTML = '';
    if (!day.hours.length) hours.innerHTML = '<p class="sub" style="grid-column:1/-1">Fermé ce jour-là. Choisissez un autre jour.</p>';
    day.hours.forEach(function (h) {
      var b = el('<button type="button" class="slot"></button>');
      b.textContent = h.h;
      if (!fits(day, h, dur)) { b.classList.add('taken'); b.disabled = true; b.setAttribute('aria-label', h.h + (h.taken ? ', déjà pris' : ', pas assez de temps avant le rendez-vous suivant')); }
      else b.onclick = function () { S.hour = h.h; $('formErr').hidden = true; renderBook(); };
      b.setAttribute('aria-pressed', S.hour === h.h);
      hours.appendChild(b);
    });
    // Jour complet : proposer la liste d'attente.
    var wb = $('waitbox'), isFull = day.hours.length && day.hours.every(function (h) { return !fits(day, h, dur); });
    wb.hidden = !isFull || p.example;
    if (isFull && !p.example) {
      wb.innerHTML = '<span>Ce jour est complet.</span> <button type="button" class="link">Me prévenir si un créneau se libère</button>';
      wb.querySelector('button').onclick = function () {
        var btn = this;
        if (!S.me.loggedIn) { location.href = loginUrl('pro=' + p.id); return; }
        busy(btn, true, 'Envoi…');
        api('waitlist', { method: 'POST', body: { pro: p.id, date: day.date, presta: S.presta } })
          .then(function (r) { wb.innerHTML = '<span>' + esc(r.message) + '</span>'; })
          .catch(function (e) { toast(e.message); busy(btn, false); });
      };
    }
    if (!$('firstname').value && S.me.firstName) $('firstname').value = S.me.firstName;
    var ht = hairText(S.hairProfile);
    $('b-hair').innerHTML = ht ? '<span><strong>Votre fiche cheveux</strong>, transmise au coiffeur : ' + esc(ht) + '</span> <button type="button" class="link" data-go="diag">Modifier</button>'
      : '<span>Aidez le coiffeur à se préparer : </span><button type="button" class="link" data-go="diag">faire mon diagnostic cheveux (30 s)</button>';
    if (!$('phone').value && S.me.phone) $('phone').value = fmtPhone(S.me.phone);
    var home = p.mode === 'domicile';
    $('addrField').hidden = !home;
    if (home && !$('address').value && S.me.address) $('address').value = S.me.address;
    var travel = home ? (+p.travel || 0) : 0;
    var price = priceFor(c, S.length), staffName = S.staff ? (team.filter(function (m) { return m.k === S.staff; })[0] || {}).name : '';
    $('r-travelRow').hidden = !travel; $('r-totalRow').hidden = !travel;
    $('r-travel').textContent = travel + ' €'; $('r-total').textContent = (price + travel) + ' €';
    $('r-service').textContent = c.label + ' · ' + fmtDur(c.dur) + (plus && S.length ? ' · cheveux ' + String(C.lengths[S.length]).toLowerCase() : '') + (staffName ? ' · avec ' + staffName : '');
    $('r-price').textContent = (plus && !S.length ? 'dès ' : '') + price + ' €';
    drawBookPhotos();
    $('r-when').textContent = (S.hour ? day.label + ' à ' + S.hour : 'Choisissez une heure') + ' · ' + (p.mode === 'domicile' ? 'à votre domicile' : (p.address || p.place));
    var demo = C.payment === 'demo';
    $('r-depositRow').hidden = !demo; $('r-restRow').hidden = !demo; $('r-onsiteRow').hidden = demo;
    $('r-deposit').textContent = C.deposit + ' €';
    $('r-rest').textContent = Math.max(0, price + travel - C.deposit) + ' €';
    $('b-note').textContent = (p.example ? 'Profil d\'exemple : le rendez-vous est confirmé automatiquement. ' : (C.emails ? 'Le coiffeur confirme votre demande, vous recevez un e-mail. ' : 'Le coiffeur confirme votre demande : suivez-la dans « Mes rendez-vous ». ')) +
      (C.emails ? 'Rappel par e-mail la veille. ' : '') + 'Annulation gratuite jusqu\'à ' + C.cancelHours + ' h avant.' +
      (demo ? ' Démonstration : l\'acompte n\'est pas débité.' : ' Rien n\'est payé en ligne.');
  }
  $('bookForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('formErr'), name = $('firstname').value.trim(), p = S.pro, day = bookDays()[S.day];
    function fail(t) { err.textContent = t; err.hidden = false; }
    if ((p.staff || []).length && !S.staff) return fail('Choisissez le coiffeur avec qui vous voulez prendre rendez-vous.');
    if (hasPlus(cur()) && !S.length) return fail('Indiquez la longueur de vos cheveux : le prix en dépend.');
    if (!S.hour) return fail('Choisissez une heure pour votre rendez-vous.');
    if (!name) { $('firstname').focus(); return fail('Indiquez votre prénom : le coiffeur l\'utilisera pour vous accueillir.'); }
    var phone = $('phone').value.trim(), digits = phone.replace(/[^0-9+]/g, '');
    if (!/^0[1-9]\d{8}$/.test(digits) && !/^\+[1-9]\d{7,14}$/.test(digits)) { $('phone').focus(); return fail('Indiquez un numéro de téléphone valide, par exemple 06 12 34 56 78.'); }
    var address = $('address').value.trim();
    if (p.mode === 'domicile' && address.length < 8) { $('address').focus(); return fail('Indiquez l\'adresse où le coiffeur doit venir : numéro, rue et ville.'); }
    var btn = $('confirm'); busy(btn, true, 'Envoi…');
    api('bookings', { method: 'POST', body: { pro_id: p.id, presta: S.presta, date: day.date, hour: S.hour, first_name: name, hair: (S.hairProfile && S.hairProfile.type) || S.hair, hair_profile: S.hairProfile || {}, phone: phone, address: p.mode === 'domicile' ? address : '', staff: S.staff || '', length: hasPlus(cur()) ? S.length : '', photos: S.bookPhotos.map(function (x) { return x.id; }) } })
      .then(function (b) {
        S.bookPhotos = [];
        var ok = b.status === 'confirmed';
        $('d-title').textContent = ok ? 'C\'est réservé !' : 'Demande envoyée';
        $('d-text').innerHTML = esc(name) + ', rendez-vous avec ' + esc(p.name) + (b.staffName ? ' (' + esc(b.staffName) + ')' : '') + ' <strong>' + esc(b.dateLabel) + ' à ' + esc(b.hour) + '</strong>.<br>' + (p.mode === 'domicile' ? 'À votre domicile' : esc(p.address || p.place));
        $('d-sub').textContent = ok ? (C.emails ? 'Vous recevez la confirmation par e-mail, puis un rappel la veille.' : 'Retrouvez-le à tout moment dans « Mes rendez-vous ».') : 'Le coiffeur a ' + (C.expireHours || 24) + ' h pour confirmer : ' + (C.emails ? 'vous recevrez un e-mail et verrez' : 'vous verrez') + ' le statut dans « Mes RDV ».';
        $('d-cal').innerHTML = calLinks(b);
        refreshMe();
        show('done');
      })
      .catch(function (x) {
        fail(x.message);
        if (x.status === 409 && x.code !== 'cm_busy') api('pros/' + p.id).then(function (fresh) { S.pro = fresh; S.hour = null; renderBook(); });
      })
      .then(function () { busy(btn, false); });
  });

  /* Photos des cheveux jointes à la demande : envoyées tout de suite, gardées jusqu'à l'envoi de la demande. */
  function drawBookPhotos() {
    var box = $('b-photos'); if (!box) return;
    box.innerHTML = '';
    S.bookPhotos.forEach(function (ph, i) {
      var t = el('<div class="thumb"><img src="' + esc(ph.url) + '" alt="Photo de mes cheveux"><button type="button" aria-label="Retirer cette photo">×</button></div>');
      t.querySelector('button').onclick = function () {
        api('booking-photos/' + ph.id, { method: 'DELETE', quiet: true }).catch(function () {});
        S.bookPhotos.splice(i, 1); drawBookPhotos();
      };
      box.appendChild(t);
    });
    $('b-addPhoto').hidden = S.bookPhotos.length >= 3;
  }
  $('b-file').onchange = function () {
    var input = this, files = Array.prototype.slice.call(input.files, 0, 3 - S.bookPhotos.length);
    files.reduce(function (chain, f) {
      return chain.then(function () {
        if (f.size > 6 * 1024 * 1024) throw new Error('Photo trop lourde (6 Mo maximum).');
        var fd = new FormData(); fd.append('file', f);
        return api('booking-photos', { method: 'POST', form: fd }).then(function (r) { S.bookPhotos.push(r); drawBookPhotos(); });
      });
    }, Promise.resolve()).catch(function (e) { toast(e.message); }).then(function () { input.value = ''; });
  };

  function calLinks(b) {
    if (!b.gcal) return '';
    return '<span class="sub small">Ajouter à mon agenda :</span> <a href="' + esc(b.gcal) + '" target="_blank" rel="noopener">Google Agenda</a> · <a href="' + esc(b.ics) + '">iPhone, Outlook (.ics)</a>';
  }

  /* ================= Mes rendez-vous ================= */
  function loadMine() {
    var ul = $('mineList'), fl = $('favList');
    if (!S.me.loggedIn) { ul.innerHTML = loginBox('Connectez-vous pour voir vos rendez-vous.', 'tab=mine'); fl.innerHTML = ''; return; }
    ul.innerHTML = '<li class="sub">Chargement…</li>';
    api('me/bookings').then(function (list) {
      var upcoming = list.filter(function (b) { return !b.past; }).reverse();
      var past = list.filter(function (b) { return b.past; });
      ul.innerHTML = list.length ? '' : '<li class="empty"><p style="margin-bottom:12px">Aucun rendez-vous pour l\'instant.</p><button type="button" class="cta-link" data-tab="search">Trouver mon coiffeur</button></li>';
      upcoming.concat(past).forEach(function (b) { ul.appendChild(bookingItem(b)); });
    }).catch(function (e) { ul.innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; });
    api('waitlist').then(function (r) {
      var wl = $('waitList'); $('waitWrap').hidden = !r.items.length; wl.innerHTML = '';
      r.items.forEach(function (w) {
        var li = el('<li class="rdv"><strong>' + esc(w.proName) + '</strong><span class="sub">' + esc(w.dateLabel) + ' · ' + (w.notified ? (C.emails ? 'Un créneau s\'est libéré : vous avez reçu un e-mail.' : 'Un créneau s\'est libéré : réservez vite.') : (C.emails ? 'Vous serez prévenue par e-mail si un créneau se libère.' : 'Revenez voir : un créneau peut se libérer.')) + '</span><div class="actions"></div></li>');
        var a = li.querySelector('.actions');
        var go = el('<button type="button" class="link">Voir les créneaux</button>'); go.onclick = function () { openPro(w.proId); }; a.appendChild(go);
        var rm = el('<button type="button" class="link danger">Retirer</button>');
        rm.onclick = function () { api('waitlist/' + w.id, { method: 'DELETE' }).then(loadMine); };
        a.appendChild(rm);
        wl.appendChild(li);
      });
    }).catch(function () {});
    fl.innerHTML = '';
    api('pros', { params: { fav: 1 } }).then(function (r) {
      fl.innerHTML = r.pros.length ? '' : '<li class="empty">Touchez le cœur sur un coiffeur pour le retrouver ici.</li>';
      r.pros.forEach(function (p) {
        var li = el('<li class="cardwrap"></li>');
        li.innerHTML = '<button type="button" class="card">' + photoBox(p, 0, p.name) + '<span class="meta"><span class="name">' + esc(p.name) + '</span><span class="sub">' + ratingText(p.rating) + ' · ' + (p.mode === 'domicile' ? 'À domicile' : 'Salon') + ' · ' + esc(p.place) + '</span></span></button>';
        li.querySelector('.card').onclick = function () { openPro(p.id); };
        fl.appendChild(li);
      });
    }).catch(function () {});
  }
  function bookingItem(b) {
    var st = b.past && b.status === 'confirmed' ? ['Passé', 'grey'] : (STATUS[b.status] || STATUS.pending);
    var li = el('<li class="rdv"></li>');
    li.innerHTML = '<span class="pill ' + st[1] + '" style="align-self:flex-start">' + st[0] + '</span><strong>' + esc(b.proName) + '</strong>' +
      '<span class="sub">' + esc(b.label) + (b.staffName ? ' avec ' + esc(b.staffName) : '') + ' · ' + esc(b.dateLabel) + ' à ' + esc(b.hour) + ' · ' + b.total + ' €' + (b.travel ? ' (dont ' + b.travel + ' € de déplacement)' : '') + '</span>' +
      (b.photos && b.photos.length ? '<span class="sub small">' + plural(b.photos.length, 'photo jointe', 'photos jointes') + ' à la demande</span>' : '') +
      '<span class="sub">' + (b.proMode === 'domicile' ? 'À votre domicile' : (b.proAddress ? '<a href="' + esc(mapsUrl(b.proAddress)) + '" target="_blank" rel="noopener">' + esc(b.proAddress) + '</a>' : esc(b.proPlace))) + '</span>' +
      (calLinks(b) ? '<span class="cal">' + calLinks(b) + '</span>' : '') + '<div class="actions"></div>';
    var act = li.querySelector('.actions');
    function add(label, cls, fn) { var x = el('<button type="button" class="link ' + (cls || '') + '">' + esc(label) + '</button>'); if (fn) x.onclick = fn; act.appendChild(x); return x; }
    if (b.canReview) add('Laisser un avis', '', function () { S.reviewFor = b; S.stars = 0; show('review'); });
    if (b.reviewed) act.appendChild(el('<span class="sub">Avis publié, merci !</span>'));
    add('Écrire au coiffeur', '', function () { S.thread = { pro: b.proId, client: S.me.id }; show('thread'); });
    if (b.status === 'refused' || b.status === 'expired' || (b.past && b.status === 'confirmed')) add('Reprendre rendez-vous', '', function () { openPro(b.proId, { pick: b.prestaK, book: true }); });
    if (b.canCancel) {
      var x = add('Annuler', 'danger');
      twoStep(x, b.freeCancel ? 'Confirmer l\'annulation' : (C.payment === 'demo' ? 'Annuler (acompte non remboursé)' : 'Confirmer l\'annulation tardive'), function () {
        return api('bookings/' + b.id + '/cancel', { method: 'POST' }).then(function () { toast('Rendez-vous annulé'); loadMine(); });
      });
    }
    return li;
  }

  /* ================= Avis ================= */
  function renderStars() {
    var box = $('stars'); box.innerHTML = '';
    for (var i = 1; i <= 5; i++) (function (n) {
      var b = el('<button type="button" class="star" aria-label="' + n + ' étoile' + (n > 1 ? 's' : '') + '">★</button>');
      b.setAttribute('aria-pressed', S.stars >= n);
      b.onclick = function () { S.stars = n; renderStars(); };
      box.appendChild(b);
    })(i);
  }
  function renderReview() {
    if (!S.reviewFor) return show('mine');
    $('rv-title').textContent = 'Votre avis sur ' + S.reviewFor.proName;
    $('rv-text').value = ''; $('rv-photo').value = ''; $('rvErr').hidden = true; renderStars();
  }
  $('reviewForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('rvErr'), t = $('rv-text').value.trim();
    function fail(m) { err.textContent = m; err.hidden = false; }
    if (!S.stars) return fail('Choisissez une note de 1 à 5 étoiles.');
    if (t.length < 5) return fail('Écrivez quelques mots sur votre expérience.');
    var btn = $('rvSave'); busy(btn, true, 'Publication…');
    var ph = $('rv-photo').files[0];
    if (ph && ph.size > 6 * 1024 * 1024) { busy(btn, false); return fail('Photo trop lourde (6 Mo maximum).'); }
    var fd = new FormData(); fd.append('booking_id', S.reviewFor.id); fd.append('rating', S.stars); fd.append('body', t); if (ph) fd.append('photo', ph);
    api('reviews', { method: 'POST', form: fd })
      .then(function () { toast('Merci, votre avis est publié'); show('mine'); })
      .catch(function (x) { fail(x.message); })
      .then(function () { busy(btn, false); });
  });

  /* ================= Messages ================= */
  function loadInbox() {
    var ul = $('threadList');
    if (!S.me.loggedIn) { ul.innerHTML = loginBox('Connectez-vous pour voir vos messages.', 'tab=inbox'); return; }
    ul.innerHTML = '<li class="sub">Chargement…</li>';
    api('threads').then(function (list) {
      list = list.filter(function (t) { return PRO ? t.asPro : !t.asPro; });
      ul.innerHTML = list.length ? '' : (PRO ? '<li class="empty">Aucune conversation. Les clientes peuvent vous écrire depuis votre profil.</li>' : '<li class="empty">Aucune conversation. Ouvrez le profil d\'un coiffeur et touchez « Envoyer un message ».</li>');
      list.forEach(function (t) {
        var li = el('<li class="cardwrap"></li>');
        li.innerHTML = '<button type="button" class="card"><span class="ph pattern" style="width:52px;height:52px;border-radius:999px;--c:var(' + colorFor(t.proId + '-' + t.clientId) + ')"></span>' +
          '<span class="meta"><span class="name">' + esc(t.title) + (t.asPro ? ' <span class="pill grey">Client</span>' : '') + (t.unread ? ' <span class="badge">' + t.unread + '</span>' : '') + '</span>' +
          '<span class="sub">' + (t.lastMine ? 'Vous : ' : '') + esc(t.last) + '</span><span class="sub small">' + esc(t.date) + '</span></span></button>';
        li.querySelector('.card').onclick = function () { S.thread = { pro: t.proId, client: t.clientId }; show('thread'); };
        ul.appendChild(li);
      });
      refreshMe();
    }).catch(function (e) { ul.innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; });
  }
  function drawThread(t) {
    $('t-title').textContent = t.title;
    var box = $('t-msgs');
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = t.messages.length ? t.messages.map(function (m) {
      return '<div class="bubble' + (m.mine ? ' mine' : '') + '"><span>' + esc(m.body).replace(/\n/g, '<br>') + '</span><time>' + esc(m.date) + '</time></div>';
    }).join('') : '<p class="sub">Posez votre question : disponibilités, type de cheveux, prix…</p>';
    if (atBottom || !box.dataset.ready) { box.scrollTop = box.scrollHeight; box.dataset.ready = '1'; }
  }
  function loadThread() {
    if (!S.me.loggedIn) { $('t-msgs').innerHTML = loginBox('Connectez-vous pour écrire au coiffeur.', 'tab=inbox'); return; }
    if (!S.thread) return show('inbox');
    var th = S.thread;
    $('t-msgs').innerHTML = '<p class="sub">Chargement…</p>'; $('t-msgs').dataset.ready = '';
    var get = function () {
      return api('threads/' + th.pro + '/' + th.client).then(function (t) { if (S.thread === th) drawThread(t); });
    };
    get().catch(function (e) { $('t-msgs').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
    S.poll = setInterval(function () { if (!document.hidden) get().catch(function () {}); }, 8000);
  }
  $('t-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('t-text').value.trim(), th = S.thread;
    if (!t || !th) return;
    var btn = this.querySelector('button'); btn.disabled = true;
    api('threads/' + th.pro + '/' + th.client, { method: 'POST', body: { body: t } })
      .then(function (r) { $('t-text').value = ''; $('t-msgs').dataset.ready = ''; drawThread(r); })
      .catch(function (x) { toast(x.message); })
      .then(function () { btn.disabled = false; });
  });
  $('t-text').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('t-form').requestSubmit();
  });

  /* ================= Espace coiffeur ================= */
  function loadPro() {
    var body = $('pro-body');
    if (!S.me.loggedIn) {
      body.innerHTML = '<p>Vous êtes coiffeur, en salon ou à domicile ? Créez votre profil gratuitement : vos réalisations, vos prestations, vos horaires, et des clientes qui correspondent à votre spécialité.</p>' + loginBox('Créez votre compte coiffeur ou connectez-vous.', 'tab=pro', true);
      return;
    }
    body.innerHTML = '<p class="sub">Chargement…</p>';
    api('pro').then(function (d) { S.space = d; renderPro(); }).catch(function (e) { body.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  /* Statistiques : vues du profil et demandes reçues sur 30 jours, détail des 14 derniers jours. */
  /* « Pour recevoir vos premières demandes » : ce qui reste à faire, tant que ce n'est pas fait. */
  function startList(d, p) {
    var n = (p.photos || []).length;
    var items = [
      [p.status === 'publish', 'Profil validé et en ligne', p.status === 'publish' ? '' : (C.emails ? 'L\'équipe le relit, vous recevrez un e-mail.' : 'L\'équipe le relit, il apparaîtra ici dès qu\'il sera en ligne.')],
      [n >= 3, 'Au moins 3 photos de vos réalisations', n + ' sur 3 · les clientes choisissent d\'abord sur les photos', 'proedit'],
      [!!p.verified, 'Badge « Diplôme vérifié »', p.diploma ? 'Diplôme déclaré, en attente de contrôle.' : 'Indiquez votre diplôme dans « Mon profil ».', 'proedit'],
      [(d.audience && d.audience.views > 0), 'Votre lien partagé', 'Mettez-le dans votre bio Instagram ou WhatsApp.']
    ];
    var left = items.filter(function (x) { return !x[0]; }).length;
    if (!left) return '';
    return '<div class="startlist"><h2>Pour recevoir vos premières demandes</h2><p class="sub">' + plural(left, 'étape restante', 'étapes restantes') + '</p><ul>' + items.map(function (x) {
      return '<li class="' + (x[0] ? 'done' : '') + '"><span class="ck" aria-hidden="true">' + (x[0] ? '✓' : '') + '</span><span><strong>' + esc(x[1]) + '</strong>' + (x[0] || !x[2] ? '' : '<small>' + esc(x[2]) + '</small>') + '</span>' +
        (!x[0] && x[3] ? '<button type="button" class="link" data-tab="' + x[3] + '">Faire</button>' : '') + '</li>';
    }).join('') + '</ul></div>';
  }
  function audienceBlock(d) {
    var a = d.audience;
    if (!a) return '';
    var max = Math.max.apply(null, a.days.map(function (x) { return x.n; }).concat([1]));
    var trend = a.prev ? Math.round(100 * (a.views - a.prev) / a.prev) : null;
    return '<div class="stack"><h2>Mon audience · 30 derniers jours</h2><div class="stats">' +
      '<div class="stat"><b>' + a.views + '</b>' + (a.views > 1 ? 'vues de mon profil' : 'vue de mon profil') + (trend !== null ? ' · ' + (trend >= 0 ? '+' : '') + trend + ' % vs mois précédent' : '') + '</div>' +
      '<div class="stat"><b>' + a.requests + '</b>' + (a.requests > 1 ? 'demandes de rendez-vous' : 'demande de rendez-vous') + '</div>' +
      '<div class="stat"><b>' + (a.rate === null ? '—' : a.rate + ' %') + '</b>des visites finissent en demande</div>' +
      '<div class="stat"><b>' + (d.waiting || 0) + '</b>' + ((d.waiting || 0) > 1 ? 'clientes en liste d\'attente' : 'cliente en liste d\'attente') + '</div></div>' +
      '<div class="spark" role="img" aria-label="Vues du profil sur les 14 derniers jours">' + a.days.map(function (x) {
        return '<span style="--h:' + Math.round(100 * x.n / max) + '%" title="' + esc(x.date) + ' : ' + x.n + '"><i></i><small>' + esc(x.label) + '</small></span>';
      }).join('') + '</div>' +
      (a.views < 20 ? '<p class="sub small">Astuce : ajoutez au moins 6 photos et partagez votre lien sur Instagram pour attirer plus de visites.</p>' : '') + '</div>';
  }

  function renderPro() {
    var d = S.space, p = d.profile, body = $('pro-body');
    var status = !p ? '' : p.status === 'publish' ? '<p class="msg ok">Votre profil est en ligne et apparaît dans la recherche.</p>'
      : p.status === 'pending' ? '<p class="msg">Votre profil est en attente de validation par l\'équipe. ' + (C.emails ? 'Vous recevrez un e-mail dès qu\'il sera en ligne.' : 'Il sera visible dès sa validation.') + '</p>'
      : (p.refused ? '<p class="msg"><strong>L\'équipe vous demande quelques corrections :</strong> ' + esc(p.refused) + '<br>Modifiez votre profil dans « Mon profil » puis enregistrez-le : il nous sera renvoyé.</p>' : '<p class="msg">Votre profil est hors ligne. Enregistrez-le pour le soumettre à nouveau.</p>');
    body.innerHTML = status +
      (!p ? '<div class="empty"><p style="margin-bottom:12px">Bienvenue ! Commencez par créer votre profil : il sera vérifié par l\'équipe avant d\'apparaître dans la recherche.</p><button type="button" class="cta" data-tab="proedit">Créer mon profil</button></div>' : '') +
      (p ? startList(d, p) : '') +
      (p ? '<div class="stack"><h2>Mon mois ' + (/^[aeiouo]/i.test(d.month.label) ? 'd\'' : 'de ') + esc(d.month.label) + '</h2><div class="stats">' +
        '<div class="stat"><b>' + d.month.rdv + '</b>rendez-vous confirmés</div>' +
        '<div class="stat"><b>' + d.month.revenue + ' €</b>chiffre prévu</div>' +
        '<div class="stat"><b>' + d.month.loyal + '</b>' + (d.month.loyal > 1 ? 'clientes fidèles' : 'cliente fidèle') + ' (2 visites ou +)</div>' +
        '<div class="stat"><b>' + (d.stats.rating ? '★ ' + fmtAvg(d.stats.rating) : '—') + '</b>' + plural(d.stats.reviews, 'avis', 'avis') + ' · ' + d.month.cancelRate + ' % d\'annulation</div></div></div>' +
        audienceBlock(d) +
        '<div class="stack"><h2>Ma semaine</h2><div class="weekgrid" id="cm-week"></div><p class="sub small"><span class="lg lg--ok"></span> confirmé <span class="lg lg--warn"></span> à confirmer</p></div>' +
        '<div class="stack"><h2>Demandes à confirmer' + (d.requests.length ? ' (' + d.requests.length + ')' : '') + '</h2><ul class="list" id="cm-requests"></ul></div>' +
        '<div class="stack"><h2>Mes prochains rendez-vous</h2><ul class="list" id="cm-agenda"></ul></div>' +
        '<div class="stack"><h2>Avis reçus</h2><div class="stack" id="cm-myReviews"></div></div>' +
        (p.status === 'publish' ? '<div class="stack"><h2>Mon lien à partager</h2><p class="sub">À mettre dans votre bio Instagram, sur Google ou WhatsApp : vos clientes réservent directement.</p>' +
          '<div class="row share"><input id="cm-shareUrl" readonly aria-label="Lien de votre profil"><button type="button" class="ghost" id="cm-copyShare">Copier</button></div>' +
          '<a class="ghost" id="cm-preview" target="_blank" rel="noopener">Voir mon profil comme une cliente</a></div>' : '') +
        (p.ical ? '<div class="stack icalbox"><h2>Mon agenda sur mon téléphone</h2><p class="sub">Vos demandes et vos rendez-vous s\'ajoutent tout seuls à votre agenda habituel, et se mettent à jour.</p>' +
          '<div class="row wrap"><a class="ghost" id="cm-icalGoogle" target="_blank" rel="noopener">Ajouter à Google Agenda</a><a class="ghost" id="cm-icalApple">iPhone ou Outlook</a><button type="button" class="link" id="cm-icalCopy">Copier le lien</button></div>' +
          '<p class="sub small">Google relit l\'agenda toutes les quelques heures : pour une nouvelle demande, ' + (C.emails ? 'l\'e-mail reste le plus rapide.' : 'votre tableau de bord reste le plus rapide.') + ' Ce lien est personnel, ne le partagez pas. <button type="button" class="link small" id="cm-icalReset">Changer de lien</button></p></div>' : '') +
        '<div class="cm-install" data-cm-install hidden></div>' : '');

    if (p) {
      drawWeek(d.week);
      var rq = $('requests');
      rq.innerHTML = d.requests.length ? '' : '<li class="empty">Aucune demande en attente.</li>';
      d.requests.forEach(function (b) {
        var li = el('<li class="rdv"></li>');
        li.innerHTML = '<span class="pill warn" style="align-self:flex-start">À confirmer</span><strong>' + esc(b.firstName) + '</strong>' +
          '<span class="sub">' + esc(b.label) + (b.staffName ? ' · avec ' + esc(b.staffName) : '') + (b.hair ? ' · cheveux ' + esc(hairLabel(b.hair).toLowerCase()) : '') + (b.lengthLabel ? ' (' + esc(b.lengthLabel.replace('cheveux ', '')) + ')' : '') + ' · ' + esc(b.dateLabel) + ' à ' + esc(b.hour) + ' · ' + fmtDur(b.dur) + ' · ' + b.total + ' €</span>' + (b.hairProfile ? '<span class="sub">Ses cheveux : ' + esc(b.hairProfile) + '</span>' : '') + photoStrip(b) + contactLine(b) +
          '<div class="actions"><button type="button" class="link">Accepter</button><button type="button" class="link danger">Refuser</button><button type="button" class="link">Écrire</button></div>';
        var bs = li.querySelectorAll('button');
        bs[0].onclick = function () { busy(bs[0], true); setBooking(b.id, 'confirmed').catch(function (e) { busy(bs[0], false); toast(e.message); }); };
        twoStep(bs[1], 'Confirmer le refus', function () { return setBooking(b.id, 'refused'); });
        bs[2].onclick = function () { S.thread = { pro: p.id, client: b.clientId }; show('thread'); };
        rq.appendChild(li);
      });
      var ag = $('agenda');
      ag.innerHTML = d.agenda.length ? '' : '<li class="empty">Aucun rendez-vous confirmé à venir.</li>';
      d.agenda.forEach(function (b) {
        var li = el('<li class="rdv"></li>');
        li.innerHTML = '<span class="pill ok" style="align-self:flex-start">Confirmé</span><strong>' + esc(b.dateLabel) + ' à ' + esc(b.hour) + '</strong>' +
          '<span class="sub">' + esc(b.firstName) + ' · ' + esc(b.label) + (b.staffName ? ' · avec ' + esc(b.staffName) : '') + ' · ' + fmtDur(b.dur) + ' · ' + b.total + ' €</span>' + (b.hairProfile ? '<span class="sub">Ses cheveux : ' + esc(b.hairProfile) + '</span>' : '') + photoStrip(b) + contactLine(b) +
          '<div class="actions"><button type="button" class="link">Écrire</button><button type="button" class="link danger">Annuler</button></div>';
        var bs = li.querySelectorAll('button');
        bs[0].onclick = function () { S.thread = { pro: p.id, client: b.clientId }; show('thread'); };
        twoStep(bs[1], 'Confirmer l\'annulation', function () {
          return api('bookings/' + b.id + '/cancel', { method: 'POST' }).then(function () { toast('Rendez-vous annulé, la cliente est prévenue'); loadPro(); });
        });
        ag.appendChild(li);
      });
      var mr = $('myReviews');
      mr.innerHTML = d.reviews.length ? '' : '<p class="sub">Pas encore d\'avis.</p>';
      d.reviews.forEach(function (v) {
        var q = el('<div class="quote"></div>');
        q.innerHTML = '<span>' + '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating) + ' ' + esc(v.body) + '</span><footer>' + esc(v.firstName) + ' · ' + esc(v.date) + '</footer>' +
          (v.reply ? '<div class="reply"><strong>Votre réponse :</strong> ' + esc(v.reply) + '</div>' : '');
        var rb = el('<button type="button" class="link">' + (v.reply ? 'Modifier ma réponse' : 'Répondre') + '</button>');
        rb.onclick = function () {
          if (q.querySelector('.inline')) return;
          var f = el('<div class="inline"><label class="field"><span class="label">Votre réponse publique</span><textarea maxlength="600"></textarea></label><div class="row"><button type="button" class="ghost">Publier la réponse</button><button type="button" class="link">Annuler</button></div></div>');
          f.querySelector('textarea').value = v.reply || '';
          var fb = f.querySelectorAll('button');
          fb[1].onclick = function () { f.remove(); };
          fb[0].onclick = function () {
            busy(fb[0], true);
            api('pro/reviews/' + v.id + '/reply', { method: 'POST', body: { reply: f.querySelector('textarea').value } })
              .then(function (dd) { S.space = dd; renderPro(); toast('Réponse publiée'); })
              .catch(function (e) { busy(fb[0], false); toast(e.message); });
          };
          q.appendChild(f);
        };
        q.appendChild(rb);
        mr.appendChild(q);
      });
      var pv = $('preview');
      if (pv) pv.href = p.shareUrl;
      if (p.ical) {
        var setIcal = function (ic) { p.ical = ic; $('icalGoogle').href = ic.google; $('icalApple').href = ic.webcal; };
        setIcal(p.ical);
        $('icalCopy').onclick = function () { copyText(p.ical.url, 'Lien de l\'agenda copié'); };
        twoStep($('icalReset'), 'Confirmer : l\'ancien lien ne marchera plus', function () {
          return api('pro/ical', { method: 'POST' }).then(function (r) { setIcal(r.ical); toast('Nouveau lien créé : ajoutez-le de nouveau à votre agenda'); });
        });
      }
      if ($('shareUrl')) {
        $('shareUrl').value = p.shareUrl;
        $('shareUrl').onfocus = function () { this.select(); };
        $('copyShare').onclick = function () { copyText(p.shareUrl, 'Lien copié : collez-le dans votre bio Instagram'); };
      }
    }
  }
  /** Agenda visuel : 7 colonnes, chaque rendez-vous est un bloc dont la hauteur suit la durée. */
  function drawWeek(week) {
    var box = $('week'); if (!box || !week) return;
    var min = 24 * 60, max = 0;
    week.forEach(function (d) {
      d.hours.forEach(function (h) { var m = +h.split(':')[0] * 60 + +h.split(':')[1]; min = Math.min(min, m); max = Math.max(max, m + 60); });
      d.items.forEach(function (it) { min = Math.min(min, it.m); max = Math.max(max, it.m + it.dur); });
    });
    if (max <= min) { min = 9 * 60; max = 19 * 60; }
    min = Math.floor(min / 60) * 60; max = Math.ceil(max / 60) * 60;
    var PX = 0.8, H = (max - min) * PX;
    var html = '<div class="wg-hours" style="height:' + H + 'px">';
    for (var t = min; t < max; t += 60) html += '<span style="top:' + ((t - min) * PX) + 'px">' + (t / 60) + 'h</span>';
    html += '</div>';
    week.forEach(function (d, i) {
      html += '<div class="wg-day' + (d.hours.length ? '' : ' closed') + '"><div class="wg-head"><small>' + (i === 0 ? 'Auj.' : DOW[d.dow]) + '</small>' + d.day + '</div><div class="wg-col" style="height:' + H + 'px">';
      d.items.forEach(function (it) {
        html += '<div class="wg-item ' + (it.status === 'pending' ? 'warn' : 'ok') + '" style="top:' + ((it.m - min) * PX) + 'px;height:' + Math.max(18, it.dur * PX - 2) + 'px" title="' + esc(it.hour + ' · ' + it.firstName + ' · ' + it.label + (it.staff ? ' · avec ' + it.staff : '')) + '"><b>' + esc(it.hour) + '</b> ' + esc(it.firstName) + '<br><span>' + esc(it.label) + (it.staff ? ' · ' + esc(it.staff) : '') + '</span></div>';
      });
      if (!d.hours.length && !d.items.length) html += '<span class="wg-closed">Fermé</span>';
      html += '</div></div>';
    });
    box.innerHTML = html;
  }

  function loadClients() {
    var ul = $('clientList');
    ul.innerHTML = '<li class="sub">Chargement…</li>';
    api('pro').then(function (d) {
      S.space = d;
      var list = d.clients || [];
      ul.innerHTML = list.length ? '' : '<li class="empty">Vos clientes apparaîtront ici après leur première réservation.</li>';
      list.forEach(function (c) {
        var li = el('<li class="rdv client"></li>');
        li.innerHTML = '<div class="cl-head"><strong>' + esc(c.firstName || 'Cliente') + '</strong>' + (c.visits >= 2 ? ' <span class="pill ok">Fidèle</span>' : '') + '</div>' +
          (c.hairProfile ? '<span class="sub">Cheveux : ' + esc(c.hairProfile) + '</span>' : (c.hair ? '<span class="sub">Cheveux ' + esc(hairLabel(c.hair).toLowerCase()) + '</span>' : '')) +
          '<span class="sub">' + plural(c.visits, 'visite', 'visites') + (c.spent ? ' · ' + c.spent + ' €' : '') + (c.last ? ' · dernière le ' + esc(c.last) : '') + '</span>' +
          (c.next ? '<span class="sub">Prochain rendez-vous : <strong>' + esc(c.next) + '</strong></span>' : '') +
          (c.phone ? '<span class="sub">Tél. <a href="' + esc(telHref(c.phone)) + '">' + esc(fmtPhone(c.phone)) + '</a></span>' : '') +
          '<label class="field"><span class="label">Ma note privée</span><textarea maxlength="1000" placeholder="Ex. : cheveux fins, préfère la coupe à sec, allergique au henné"></textarea></label>' +
          '<div class="actions"><button type="button" class="link">Enregistrer la note</button><button type="button" class="link">Écrire</button></div>';
        var ta = li.querySelector('textarea'); ta.value = c.note || '';
        var bs = li.querySelectorAll('.actions button');
        bs[0].onclick = function () {
          busy(bs[0], true);
          api('pro/clients/' + c.id + '/note', { method: 'POST', body: { note: ta.value } })
            .then(function () { toast('Note enregistrée'); }).catch(function (e) { toast(e.message); }).then(function () { busy(bs[0], false); });
        };
        bs[1].onclick = function () { S.thread = { pro: d.profile.id, client: c.id }; show('thread'); };
        ul.appendChild(li);
      });
    }).catch(function (e) { ul.innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; });
  }

  function loadProEdit() {
    if (S.space) { renderProForm(); return; }
    api('pro').then(function (d) { S.space = d; renderProForm(); }).catch(function (e) { $('proForm').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  function photoStrip(b) {
    if (!b.photos || !b.photos.length) return '';
    return '<div class="bphotos" data-lb aria-label="Photos des cheveux de la cliente">' + b.photos.map(function (u, i) { return '<img src="' + esc(u) + '" alt="Photo ' + (i + 1) + ' des cheveux de ' + esc(b.firstName) + '" loading="lazy">'; }).join('') + '</div>';
  }
  function contactLine(b) {
    var h = '';
    if (b.phone) h += '<span class="sub">Tél. <a href="' + esc(telHref(b.phone)) + '">' + esc(fmtPhone(b.phone)) + '</a></span>';
    if (b.address) h += '<span class="sub">' + esc(b.address) + ' · <a href="' + esc(mapsUrl(b.address)) + '" target="_blank" rel="noopener">Itinéraire</a></span>';
    return h;
  }
  function setBooking(id, status) {
    return api('pro/bookings/' + id, { method: 'POST', body: { status: status } }).then(function (dd) {
      S.space = dd; renderPro(); refreshMe(); toast(status === 'confirmed' ? 'Rendez-vous confirmé, la cliente est prévenue' : 'Demande refusée');
    });
  }

  function nextDays(n) {
    var out = [], d = new Date(); d.setDate(d.getDate() + 1);
    for (var i = 0; i < n; i++) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function renderProForm() {
    var p = S.space.profile;
    var src = p || { name: S.me.firstName || '', mode: 'salon', place: '', bio: '', hair: [], tags: [], skills: [], staff: [], diploma: '', presta: [], week: null, off: [], photos: [], address: '', zones: [], travel: 0 };
    if (!S.draft || S.draft.id !== (p ? p.id : 0)) {
      S.draft = JSON.parse(JSON.stringify(src));
      S.draft.id = p ? p.id : 0;
      if (!S.draft.presta.length) S.draft.presta = [{ label: '', service: 'coupe', dur: 60, price: '' }];
      S.draft.skills = S.draft.skills || [];
      // Équipe : les prestations de chaque coiffeur sont suivies par leur position dans la liste.
      S.draft.staff = (S.draft.staff || []).map(function (m) {
        return { k: m.k, name: m.name, days: (m.days || [0, 1, 2, 3, 4, 5, 6]).slice(), pidx: (m.presta || []).map(function (k) { return S.draft.presta.map(function (x) { return x.k; }).indexOf(k); }).filter(function (i) { return i !== -1; }) };
      });
      if (!S.draft.week) { S.draft.week = []; for (var d = 0; d < 7; d++) S.draft.week.push(d === 0 ? [] : ['9:00', '10:30', '11:15', '14:00', '15:30', '16:15', '17:00', '18:30']); }
    }
    var D = S.draft, form = $('proForm');
    form.innerHTML =
      '<h1>' + (p ? 'Mon profil' : 'Créer mon profil coiffeur') + '</h1>' +
      (p ? '' : '<p class="sub">Remplissez votre profil. Il sera vérifié par l\'équipe avant d\'apparaître dans la recherche.</p>') +
      '<label class="field"><span class="label">Nom affiché</span><input id="cm-pf-name" maxlength="40" placeholder="Ex. : Nadia K. ou Salon Les Boucles"></label>' +
      '<div class="row"><label class="field"><span class="label">Je coiffe</span><select id="cm-pf-mode"><option value="salon">Au salon</option><option value="domicile">À domicile</option></select></label>' +
        '<label class="field"><span class="label">Ville ou quartier affiché</span><input id="cm-pf-place" maxlength="60" placeholder="Ex. : Paris 18e"></label></div>' +
      '<label class="field" id="cm-pf-addrField"><span class="label">Adresse du salon</span><input id="cm-pf-address" maxlength="120" autocomplete="street-address" placeholder="Ex. : 12 rue Oberkampf, 75011 Paris"><span class="sub small">Affichée sur votre profil avec un lien vers la carte.</span></label>' +
      '<div class="row" id="cm-pf-homeFields"><label class="field"><span class="label">Communes où je me déplace (séparées par des virgules)</span><input id="cm-pf-zones" maxlength="300" placeholder="Ex. : Montreuil, Bagnolet, Paris 20e"></label>' +
        '<label class="field"><span class="label">Frais de déplacement (€)</span><input id="cm-pf-travel" type="number" min="0" max="50" inputmode="numeric" placeholder="0 = offert"></label></div>' +
      '<label class="field"><span class="label">Présentation</span><textarea id="cm-pf-bio" maxlength="400" placeholder="Ex. : spécialiste des boucles depuis 8 ans, coupe à sec."></textarea></label>' +
      '<fieldset class="stack plain"><legend class="label">Types de cheveux que je maîtrise</legend><div class="chips" id="cm-pf-hair"></div></fieldset>' +
      '<fieldset class="stack plain"><legend class="label">Mes savoir-faire (6 au plus)</legend><div class="chips" id="cm-pf-skills"></div><p class="sub small">Les clientes filtrent la recherche avec : cochez seulement ce que vous maîtrisez vraiment.</p></fieldset>' +
      '<label class="field"><span class="label">Autres spécialités (séparées par des virgules)</span><input id="cm-pf-tags" maxlength="160" placeholder="Ex. : soins sans sulfates, diagnostic offert"></label>' +
      '<label class="field"><span class="label">Diplôme de coiffure</span><select id="cm-pf-dipl">' + Object.keys(C.diplomas).map(function (k) { return '<option value="' + esc(k) + '">' + esc(C.diplomas[k]) + '</option>'; }).join('') + '</select></label>' +
      '<p class="sub">La loi impose un diplôme pour coiffer en France. Le badge « Diplôme vérifié » est attribué par l\'équipe après contrôle de votre justificatif (envoyez-le via la page Contact).</p>' +
      '<fieldset class="stack plain"><legend class="label">Prestations</legend><div class="stack" id="cm-pf-presta"></div><button class="ghost" type="button" id="cm-addPresta" style="align-self:flex-start">Ajouter une prestation</button></fieldset>' +
      '<fieldset class="stack plain" id="cm-pf-teamBox"><legend class="label">Mon équipe (facultatif)</legend><p class="sub small">Plusieurs coiffeurs dans votre salon ? Ajoutez-les : chacun a son agenda et la cliente choisit avec qui elle prend rendez-vous. Ils travaillent aux horaires du salon, les jours cochés.</p><div class="stack" id="cm-pf-team"></div><button class="ghost" type="button" id="cm-addStaff" style="align-self:flex-start">Ajouter un coiffeur</button></fieldset>' +
      '<fieldset class="stack plain"><legend class="label">Mes horaires, jour par jour</legend><div class="stack" id="cm-pf-week"></div></fieldset>' +
      '<fieldset class="stack plain"><legend class="label">Jours de fermeture exceptionnelle (2 prochaines semaines)</legend><div class="chips" id="cm-pf-off"></div></fieldset>' +
      '<fieldset class="stack plain"><legend class="label">Photos de mes réalisations</legend><div class="thumbs" id="cm-pf-photos"></div>' +
        (p ? '<label class="ghost" for="cm-pf-file" style="align-self:flex-start;cursor:pointer">Ajouter des photos</label><input type="file" id="cm-pf-file" accept="image/jpeg,image/png,image/webp" multiple hidden><p class="sub" id="cm-uploadNote">JPG, PNG ou WebP, 6 Mo maximum, 12 photos au plus.</p>'
           : '<p class="sub">Vous pourrez ajouter vos photos juste après avoir enregistré votre profil.</p>') + '</fieldset>' +
      '<p class="err" id="cm-proErr" role="alert" hidden></p>' +
      '<div class="bar"><button class="cta" type="submit" id="cm-proSave">' + (p ? 'Enregistrer mon profil' : 'Envoyer mon profil pour validation') + '</button></div>' +
      (p && p.status !== 'draft' ? '<button class="link danger" type="button" id="cm-withdraw">Retirer mon profil de la recherche</button>' : '');

    $('pf-name').value = D.name; $('pf-mode').value = D.mode; $('pf-place').value = D.place; $('pf-bio').value = D.bio;
    $('pf-tags').value = (D.tags || []).join(', '); $('pf-dipl').value = D.diploma || '';
    $('pf-address').value = D.address || ''; $('pf-zones').value = (D.zones || []).join(', '); $('pf-travel').value = D.travel || '';
    function modeFields() { $('pf-addrField').hidden = D.mode === 'domicile'; $('pf-homeFields').hidden = D.mode !== 'domicile'; $('pf-teamBox').hidden = D.mode === 'domicile'; }
    modeFields();
    $('pf-address').oninput = function () { D.address = this.value; };
    $('pf-zones').oninput = function () { D.zones = this.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean); };
    $('pf-travel').oninput = function () { D.travel = this.value; };
    ['name', 'place', 'bio'].forEach(function (k) { $('pf-' + k).oninput = function () { D[k] = this.value; }; });
    $('pf-mode').onchange = function () { D.mode = this.value; modeFields(); };
    $('pf-tags').oninput = function () { D.tags = this.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean); };
    $('pf-dipl').onchange = function () { D.diploma = this.value; };

    function drawHair() {
      $('pf-hair').innerHTML = HAIR.map(function (h) { return '<button type="button" class="chip sm" aria-pressed="' + (D.hair.indexOf(h[0]) !== -1) + '" data-h="' + h[0] + '">' + esc(h[1]) + '</button>'; }).join('');
      $('pf-hair').querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { var h = b.dataset.h, i = D.hair.indexOf(h); if (i === -1) D.hair.push(h); else D.hair.splice(i, 1); drawHair(); };
      });
    }
    drawHair();

    function drawSkills() {
      $('pf-skills').innerHTML = Object.keys(C.skills).map(function (k) { return '<button type="button" class="chip sm" aria-pressed="' + (D.skills.indexOf(k) !== -1) + '" data-k="' + k + '">' + esc(C.skills[k]) + '</button>'; }).join('');
      $('pf-skills').querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.k, i = D.skills.indexOf(k);
          if (i === -1) { if (D.skills.length >= 6) { toast('6 savoir-faire au plus : retirez-en un d\'abord'); return; } D.skills.push(k); } else D.skills.splice(i, 1);
          drawSkills();
        };
      });
    }
    drawSkills();

    function drawTeam() {
      var box = $('pf-team'); box.innerHTML = '';
      D.staff.forEach(function (m, si) {
        var row = el('<div class="staffrow"></div>');
        row.innerHTML = '<div class="row"><label class="field"><span class="label">Prénom</span><input maxlength="30" placeholder="Ex. : Inès"></label><button type="button" class="link danger" style="align-self:end">Retirer</button></div>' +
          '<div class="field"><span class="label">Jours de travail</span><div class="chips" data-days></div></div>' +
          '<div class="field"><span class="label">Prestations qu\'il ou elle fait (aucune cochée = toutes)</span><div class="chips" data-presta></div></div>';
        var inp = row.querySelector('input'); inp.value = m.name || ''; inp.oninput = function () { m.name = this.value; };
        twoStep(row.querySelector('.danger'), 'Confirmer', function () { D.staff.splice(si, 1); drawTeam(); });
        var dd = row.querySelector('[data-days]');
        [1, 2, 3, 4, 5, 6, 0].forEach(function (dow) {
          var b = el('<button type="button" class="chip sm"></button>'); b.textContent = DOW[dow];
          b.setAttribute('aria-pressed', m.days.indexOf(dow) !== -1);
          b.onclick = function () { var i = m.days.indexOf(dow); if (i === -1) m.days.push(dow); else m.days.splice(i, 1); b.setAttribute('aria-pressed', i === -1); };
          dd.appendChild(b);
        });
        var pp = row.querySelector('[data-presta]');
        D.presta.forEach(function (x, pi) {
          var b = el('<button type="button" class="chip sm"></button>'); b.textContent = x.label || ('Prestation ' + (pi + 1));
          b.setAttribute('aria-pressed', m.pidx.indexOf(pi) !== -1);
          b.onclick = function () { var i = m.pidx.indexOf(pi); if (i === -1) m.pidx.push(pi); else m.pidx.splice(i, 1); b.setAttribute('aria-pressed', i === -1); };
          pp.appendChild(b);
        });
        box.appendChild(row);
      });
    }
    drawTeam();
    $('addStaff').onclick = function () {
      if (D.staff.length >= 8) { toast('8 coiffeurs au plus'); return; }
      D.staff.push({ k: '', name: '', days: [1, 2, 3, 4, 5, 6], pidx: [] }); drawTeam();
      var ins = $('pf-team').querySelectorAll('input'); if (ins.length) ins[ins.length - 1].focus();
    };

    function drawPresta() {
      var box = $('pf-presta'); box.innerHTML = '';
      D.presta.forEach(function (x, i) {
        var row = el('<div class="prow"></div>');
        row.innerHTML = '<label class="field full"><span class="label">Nom de la prestation</span><input data-f="label" maxlength="60" placeholder="Ex. : Coupe sur boucles"></label>' +
          '<label class="field"><span class="label">Type</span><select data-f="service">' + SERVICES.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span class="label">Durée</span><select data-f="dur">' + [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300].map(function (m) { return '<option value="' + m + '">' + fmtDur(m) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span class="label">Prix (€)</span><input data-f="price" type="number" min="1" max="999" inputmode="numeric"></label>' +
          (D.presta.length > 1 ? '<button type="button" class="link danger" style="align-self:end">Supprimer</button>' : '') +
          '<details class="pmore full"><summary>Prix selon la longueur, rappel d\'entretien</summary><div class="row">' +
            '<label class="field"><span class="label">Supplément cheveux mi-longs (€)</span><input data-p="mi-long" type="number" min="0" max="300" inputmode="numeric" placeholder="0"></label>' +
            '<label class="field"><span class="label">Supplément cheveux longs (€)</span><input data-p="long" type="number" min="0" max="300" inputmode="numeric" placeholder="0"></label>' +
            '<label class="field"><span class="label">Rappel d\'entretien après (semaines)</span><input data-f="every" type="number" min="0" max="52" inputmode="numeric" placeholder="Auto"></label>' +
          '</div><p class="sub small">Le prix affiché est celui des cheveux courts. Avec un supplément, la cliente indique sa longueur en réservant et voit le bon prix. Le rappel invite la cliente à revenir (laisser vide : 6 semaines pour des tresses, 8 pour une coupe).</p></details>';
        row.querySelector('[data-f=label]').value = x.label || '';
        row.querySelector('[data-f=service]').value = x.service || 'coupe';
        row.querySelector('[data-f=dur]').value = String(x.dur || 60);
        row.querySelector('[data-f=price]').value = x.price || '';
        row.querySelector('[data-f=every]').value = x.every || '';
        x.plus = x.plus || {};
        row.querySelectorAll('[data-p]').forEach(function (f) { f.value = x.plus[f.dataset.p] || ''; f.oninput = function () { x.plus[f.dataset.p] = f.value; }; });
        if (hasPlus(x) || x.every) row.querySelector('.pmore').open = true;
        row.querySelectorAll('[data-f]').forEach(function (f) { f.oninput = f.onchange = function () { x[f.dataset.f] = f.value; if (f.dataset.f === 'label') drawTeam(); }; });
        var del = row.querySelector('button.danger'); if (del) del.onclick = function () {
          D.presta.splice(i, 1);
          D.staff.forEach(function (m) { m.pidx = m.pidx.filter(function (k) { return k !== i; }).map(function (k) { return k > i ? k - 1 : k; }); });
          drawPresta(); drawTeam();
        };
        box.appendChild(row);
      });
    }
    drawPresta();
    $('addPresta').onclick = function () { D.presta.push({ label: '', service: 'coupe', dur: 60, price: '' }); drawPresta(); drawTeam(); };

    function drawWeek() {
      var box = $('pf-week'); box.innerHTML = '';
      [1, 2, 3, 4, 5, 6, 0].forEach(function (dow) {
        var hours = D.week[dow] || [];
        var row = el('<div class="dayrow"></div>');
        row.innerHTML = '<div class="dayhead"><label class="check-inline"><input type="checkbox"' + (hours.length ? ' checked' : '') + '> <strong>' + DOWL[dow] + '</strong></label>' +
          '<span class="sub">' + (hours.length ? plural(hours.length, 'créneau', 'créneaux') : 'Fermé') + '</span>' +
          (hours.length ? '<button type="button" class="link">Modifier</button>' : '') + '</div><div class="hgrid" hidden></div>';
        var cb = row.querySelector('input'), grid = row.querySelector('.hgrid'), edit = row.querySelector('button');
        cb.onchange = function () { D.week[dow] = cb.checked ? ['9:00', '10:30', '11:15', '14:00', '15:30', '16:15', '17:00', '18:30'] : []; drawWeek(); };
        if (edit) edit.onclick = function () {
          grid.hidden = !grid.hidden;
          edit.textContent = grid.hidden ? 'Modifier' : 'Fermer';
          if (!grid.hidden && !grid.children.length) {
            C.allHours.forEach(function (h) {
              var b = el('<button type="button" class="chip sm"></button>');
              b.textContent = h; b.setAttribute('aria-pressed', D.week[dow].indexOf(h) !== -1);
              b.onclick = function () {
                var list = D.week[dow], i = list.indexOf(h);
                if (i === -1) list.push(h); else list.splice(i, 1);
                list.sort(function (a, c) { return C.allHours.indexOf(a) - C.allHours.indexOf(c); });
                b.setAttribute('aria-pressed', i === -1);
                row.querySelector('.sub').textContent = list.length ? plural(list.length, 'créneau', 'créneaux') : 'Fermé';
              };
              grid.appendChild(b);
            });
          }
        };
        box.appendChild(row);
      });
    }
    drawWeek();

    function drawOff() {
      var box = $('pf-off');
      box.innerHTML = nextDays(14).map(function (d) {
        var k = dkey(d);
        return '<button type="button" class="chip sm" aria-pressed="' + (D.off.indexOf(k) !== -1) + '" data-k="' + k + '">' + DOW[d.getDay()] + ' ' + d.getDate() + '</button>';
      }).join('');
      box.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { var k = b.dataset.k, i = D.off.indexOf(k); if (i === -1) D.off.push(k); else D.off.splice(i, 1); drawOff(); };
      });
    }
    drawOff();

    function drawPhotos(list) {
      var box = $('pf-photos');
      box.innerHTML = list.length ? '' : '<p class="sub">Aucune photo pour l\'instant. Les clientes choisissent d\'abord sur les réalisations : ajoutez-en au moins 3.</p>';
      list.forEach(function (ph) {
        var t = el('<div class="thumb"><img src="' + esc(ph.url) + '" alt="Réalisation"><button type="button" aria-label="Supprimer cette photo">×</button>' +
          '<label class="tagsel"><span class="sr">Étiquette de la photo</span><select><option value="">Réalisation</option><option value="avant">Avant</option><option value="apres">Après</option></select></label></div>');
        var sel = t.querySelector('select'); sel.value = ph.tag || '';
        sel.onchange = function () { api('pro/photos/' + ph.id + '/tag', { method: 'POST', body: { tag: sel.value } }).then(function (r) { S.space.profile.photos = r.photos; toast(sel.value ? 'Photo marquée « ' + (sel.value === 'avant' ? 'Avant' : 'Après') + ' »' : 'Étiquette retirée'); }).catch(function (e) { toast(e.message); }); };
        twoStep(t.querySelector('button'), '✓', function () {
          return api('pro/photos/' + ph.id, { method: 'DELETE' }).then(function (r) { S.space.profile.photos = r.photos; drawPhotos(r.photos); });
        });
        box.appendChild(t);
      });
    }
    drawPhotos(p ? p.photos : []);
    var file = $('pf-file');
    if (file) file.onchange = function () {
      var files = Array.prototype.slice.call(file.files), note = $('uploadNote'), done = 0;
      if (!files.length) return;
      note.textContent = 'Envoi de ' + plural(files.length, 'photo', 'photos') + '…';
      files.reduce(function (chain, f) {
        return chain.then(function () {
          var fd = new FormData(); fd.append('file', f);
          return api('pro/photos', { method: 'POST', form: fd }).then(function (r) {
            done++; S.space.profile.photos = r.photos; drawPhotos(r.photos);
          });
        });
      }, Promise.resolve())
        .then(function () { note.textContent = plural(done, 'photo ajoutée', 'photos ajoutées') + '.'; })
        .catch(function (e) { note.textContent = e.message; })
        .then(function () { file.value = ''; });
    };

    form.onsubmit = function (e) {
      e.preventDefault();
      var err = $('proErr');
      function fail(t, focus) { err.textContent = t; err.hidden = false; if (focus) $(focus).focus(); }
      err.hidden = true;
      if (!D.name.trim()) return fail('Indiquez le nom affiché sur votre profil.', 'pf-name');
      if (!D.place.trim()) return fail('Indiquez votre ville ou votre quartier.', 'pf-place');
      if (D.mode !== 'domicile' && String(D.address || '').trim().length < 8) return fail('Indiquez l\'adresse du salon : numéro, rue, code postal et ville.', 'pf-address');
      if (!D.hair.length) return fail('Choisissez au moins un type de cheveux que vous maîtrisez.');
      var presta = [], keyOf = {};
      D.presta.forEach(function (x, i) { if (String(x.label || '').trim() && +x.price > 0) { presta.push(x); keyOf[i] = 'p' + presta.length; } });
      if (!presta.length) return fail('Ajoutez au moins une prestation avec un nom et un prix.');
      var staff = D.mode === 'domicile' ? [] : D.staff.filter(function (m) { return String(m.name || '').trim(); }).map(function (m) {
        return { k: m.k, name: m.name.trim(), days: m.days, presta: m.pidx.map(function (i) { return keyOf[i]; }).filter(Boolean) };
      });
      if (staff.some(function (m) { return !m.days.length; })) return fail('Cochez au moins un jour de travail pour chaque coiffeur de l\'équipe.');
      if (!D.week.some(function (h) { return h.length; })) return fail('Ouvrez au moins un jour dans vos horaires.');
      var btn = $('proSave'); busy(btn, true, 'Enregistrement…');
      api('pro', { method: 'POST', body: { name: D.name, mode: D.mode, place: D.place, bio: D.bio, hair: D.hair, tags: D.tags, skills: D.skills, staff: staff, diploma: D.diploma, presta: presta, week: D.week, off: D.off, address: D.address || '', zones: D.zones || [], travel: +D.travel || 0 } })
        .then(function (dd) {
          var wasNew = !S.space.profile;
          S.space = dd; S.draft = null; refreshMe();
          toast(wasNew ? 'Profil envoyé : il sera visible après validation' : 'Profil enregistré');
          show('pro');
        })
        .catch(function (x) { busy(btn, false); fail(x.message); });
    };
    var wd = $('withdraw');
    if (wd) twoStep(wd, 'Confirmer : retirer mon profil', function () {
      return api('pro/withdraw', { method: 'POST' }).then(function (dd) { S.space = dd; S.draft = null; toast('Profil retiré de la recherche'); show('pro'); });
    });
  }

  /* ================= Démarrage ================= */
  renderHair();
  refreshMe().then(function () {
    if (!PRO) {
      window.addEventListener('popstate', function () { S.fromPop = true; route(new URLSearchParams(location.search)); S.fromPop = false; });
      // Liens vers l'application depuis l'en-tête ou le menu : on change d'écran sur place, sans recharger.
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
        var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
        if (u.origin !== location.origin || u.pathname !== location.pathname || u.hash) return;
        e.preventDefault();
        var acct = document.querySelector('details.acct[open]'); if (acct) acct.removeAttribute('open');
        var nav = document.querySelector('.site-nav.is-open'); if (nav) { nav.classList.remove('is-open'); var t = document.querySelector('.site-header__toggle'); if (t) t.setAttribute('aria-expanded', 'false'); }
        history.pushState({}, '', u.pathname + u.search);
        S.fromPop = true; route(u.searchParams); S.fromPop = false;
      });
    }
    var tab = params.get('tab'), pro = parseInt(params.get('pro'), 10);
    if (PRO) {
      if (tab === 'profil') show('proedit');
      else if (tab === 'messages') show('inbox');
      else if (tab === 'clientes') show('clients');
      else api('pro').then(function (d) { S.space = d; show(d.profile ? 'pro' : 'proedit'); }).catch(function () { show('pro'); });
      return;
    }
    if (params.get('diag')) { S.diagDraft = null; show('diag'); return; }
    if (pro) openPro(pro, params.get('presta') ? { pick: params.get('presta') } : null);
    else if (['mine', 'inbox', 'pro'].indexOf(tab) !== -1) show(tab);
    else loadResults();
  });
})();
