/**
 * Coiff'Match – espace équipe : tableau de bord, coiffeurs à valider, signalements, rendez-vous, membres.
 * Données via l'API coiffmatch/v1/team (réservée aux administrateurs).
 */
(function () {
  'use strict';
  var C = window.CM_TEAM, root = document.getElementById('cm-app');
  if (!C || !root) return;

  /* ---------- Outils ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById('cm-' + id); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function plural(n, a, b) { return n + ' ' + (n > 1 ? b : a); }
  function euros(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
  var busyN = 0;
  function busy(d) { busyN = Math.max(0, busyN + d); try { document.dispatchEvent(new CustomEvent(busyN ? 'cm:busy' : 'cm:idle')); } catch (e) {} }
  function api(path, opts) {
    opts = opts || {};
    var url = C.api + 'team/' + path;
    if (opts.params) {
      var q = Object.keys(opts.params).filter(function (k) { return opts.params[k] !== '' && opts.params[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(opts.params[k]); });
      if (q.length) url += (url.indexOf('?') === -1 ? '?' : '&') + q.join('&');
    }
    var h = { 'X-WP-Nonce': C.nonce };
    if (opts.body) h['Content-Type'] = 'application/json';
    busy(1);
    return fetch(url, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' })
      .then(function (r) { busy(-1); return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || 'Une erreur est survenue.'); e.status = r.status; throw e; } return j; }); },
        function () { busy(-1); throw new Error('Connexion impossible. Vérifiez votre réseau.'); });
  }
  function toast(t) {
    var e = $('toast'); e.textContent = t; e.hidden = false; e.classList.remove('out');
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.add('out'); setTimeout(function () { e.hidden = true; }, 250); }, 2800);
  }
  /** Bouton en deux temps pour les actions importantes. */
  function twoStep(btn, label, fn) {
    var orig = btn.textContent, armed = false, t;
    btn.onclick = function () {
      if (!armed) { armed = true; btn.textContent = label; btn.classList.add('armed'); t = setTimeout(function () { armed = false; btn.textContent = orig; btn.classList.remove('armed'); }, 4000); return; }
      clearTimeout(t); btn.disabled = true;
      Promise.resolve(fn()).catch(function (e) { toast(e.message); btn.disabled = false; armed = false; btn.textContent = orig; btn.classList.remove('armed'); });
    };
  }
  var STATUS = { pending: ['À confirmer', 'warn'], confirmed: ['Confirmé', 'ok'], refused: ['Refusé', 'grey'], cancelled: ['Annulé', 'grey'], expired: ['Expiré', 'grey'] };
  /* Tableaux en grille : rôles d'accessibilité pour les lecteurs d'écran. */
  function cellRoles(scope) {
    scope.querySelectorAll('.rows__h > span').forEach(function (c) { c.setAttribute('role', 'columnheader'); });
    (scope.classList && scope.classList.contains('rows__r') ? [scope] : scope.querySelectorAll('.rows__r')).forEach(function (r) {
      Array.prototype.forEach.call(r.children, function (c) { c.setAttribute('role', 'cell'); });
    });
  }
  function skeleton(n) { var h = ''; for (var i = 0; i < n; i++) h += '<li class="sk" aria-hidden="true"><div class="sk__lines"><i></i><i></i><i></i></div></li>'; return '<ul class="list">' + h + '</ul>'; }

  /* ---------- Squelette ---------- */
  var VIEWS = [['dash', 'Tableau de bord'], ['months', 'Chiffres du mois'], ['pros', 'Coiffeurs'], ['reports', 'Signalements'], ['bookings', 'Rendez-vous'], ['members', 'Membres'], ['contact', 'Messages']];
  root.innerHTML =
    '<header class="top">' +
      '<nav class="tabs" aria-label="Espace équipe">' + VIEWS.map(function (v) {
        return '<button type="button" data-tab="' + v[0] + '">' + v[1] + (v[0] === 'pros' || v[0] === 'reports' ? ' <span class="badge" id="cm-b-' + v[0] + '" hidden></span>' : '') + '</button>';
      }).join('') + '</nav>' +
      '<div class="side__links">' +
        '<a href="' + esc(C.adminUrl) + '" target="_blank" rel="noopener">Base de données (Supabase)</a>' +
        '<a href="' + esc(C.siteUrl) + '" target="_blank" rel="noopener">Voir le site</a>' +
        '<a href="' + esc(C.logoutUrl) + '">Se déconnecter</a>' +
      '</div>' +
    '</header>' +
    VIEWS.map(function (v) { return '<section class="view" id="cm-v-' + v[0] + '" hidden></section>'; }).join('') +
    '<div class="toast" id="cm-toast" hidden role="status"></div>';

  var S = { view: 'dash', proStatus: 'pending', proQ: '', repStatus: 'open', bkStatus: '', bkQ: '', memRole: 'client', memQ: '' };

  function show(v, push) {
    S.view = v;
    VIEWS.forEach(function (x) { $('v-' + x[0]).hidden = x[0] !== v; });
    root.querySelectorAll('.tabs button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === v ? 'page' : 'false'); });
    if (push !== false && history.pushState) {
      var u = location.pathname + (v === 'dash' ? '' : '?tab=' + v);
      if (u !== location.pathname + location.search) history.pushState({ t: v }, '', u);
    }
    var top = root.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
    ({ dash: loadDash, pros: loadPros, reports: loadReports, bookings: loadBookings, members: loadMembers, contact: loadContact, months: loadMonths })[v]();
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b && root.contains(b)) show(b.dataset.tab);
  });
  window.addEventListener('popstate', function () {
    var t = new URLSearchParams(location.search).get('tab');
    show(VIEWS.some(function (v) { return v[0] === t; }) ? t : 'dash', false);
  });
  function badges(pending, reports) {
    var a = $('b-pros'), b = $('b-reports');
    a.hidden = !pending; a.textContent = pending || '';
    b.hidden = !reports; b.textContent = reports || '';
  }

  /* ---------- Tableau de bord ---------- */
  function loadDash() {
    var box = $('v-dash');
    if (!box.innerHTML) box.innerHTML = '<h1>Bonjour ' + esc(C.firstName) + '</h1>' + skeleton(3);
    api('overview').then(function (d) {
      badges(d.todo.pending, d.todo.reports);
      var k = d.kpi, trend = k.bookingsPrev ? Math.round(100 * (k.bookings - k.bookingsPrev) / k.bookingsPrev) : null;
      var todo = [];
      if (d.todo.pending) todo.push(['pros', plural(d.todo.pending, 'profil coiffeur attend', 'profils coiffeur attendent') + ' votre validation', 'Valider']);
      if (d.todo.reports) todo.push(['reports', plural(d.todo.reports, 'signalement à traiter', 'signalements à traiter'), 'Traiter']);
      if (d.todo.toVerify) todo.push(['pros-online', plural(d.todo.toVerify, 'diplôme déclaré à vérifier', 'diplômes déclarés à vérifier'), 'Vérifier']);
      var max = Math.max.apply(null, d.days.map(function (x) { return x.n; }).concat([1]));
      box.innerHTML = '<h1>Bonjour ' + esc(C.firstName) + '</h1>' +
        '<div class="todo">' + (todo.length ? '<h2>À faire</h2><ul>' + todo.map(function (t) {
          return '<li><span>' + esc(t[1]) + '</span><button type="button" class="cta-sm" data-go="' + t[0] + '">' + t[2] + '</button></li>';
        }).join('') + '</ul>' : '<p class="todo__ok">Rien à traiter : tout est à jour.</p>') + '</div>' +
        '<div class="stack"><h2>Les 30 derniers jours</h2><div class="stats">' +
          '<div class="stat"><b>' + k.bookings + '</b>' + (k.bookings > 1 ? 'réservations' : 'réservation') + (trend !== null ? ' · ' + (trend >= 0 ? '+' : '') + trend + ' %' : '') + '</div>' +
          '<div class="stat"><b>' + k.confirmed + '</b>' + (k.confirmed > 1 ? 'confirmées' : 'confirmée') + '</div>' +
          '<div class="stat"><b>' + k.cancelRate + ' %</b>annulées ou expirées</div>' +
          '<div class="stat"><b>' + euros(k.value) + '</b>de prestations confirmées</div>' +
          '<div class="stat"><b>' + k.clients + '</b>' + (k.clients > 1 ? 'clientes' : 'cliente') + ' · ' + plural(k.clientsNew, 'nouvelle', 'nouvelles') + '</div>' +
          '<div class="stat"><b>' + k.pros + '</b>' + (k.pros > 1 ? 'coiffeurs en ligne' : 'coiffeur en ligne') + ' · ' + plural(k.prosNew, 'inscrit', 'inscrits') + ' ce mois</div>' +
        '</div>' +
        '<div class="spark spark--30" role="img" aria-label="Réservations par jour sur 30 jours">' + d.days.map(function (x, i) {
          return '<span style="--h:' + Math.round(100 * x.n / max) + '%" title="' + esc(x.date) + ' : ' + x.n + '"><i></i><small>' + (i % 5 === 0 ? esc(x.label) : '') + '</small></span>';
        }).join('') + '</div></div>' +
        '<div class="grid2">' +
          '<div class="stack"><h2>Recherches sans résultat</h2><p class="sub small">Ce que les clientes cherchent et ne trouvent pas : les coiffeurs à recruter en priorité.</p>' +
            (d.missed.length ? '<ul class="tbl">' + d.missed.map(function (m) { return '<li><span><strong>' + esc(m.hair) + '</strong> · ' + esc(m.city) + '</span><span class="n">' + m.n + '</span></li>'; }).join('') + '</ul>' : '<p class="empty">Aucune recherche sans résultat ce mois-ci.</p>') + '</div>' +
          '<div class="stack"><h2>Activité récente</h2>' +
            (d.recent.length ? '<ul class="feed">' + d.recent.map(function (a) {
              return '<li><span class="dot dot--' + esc(a.type) + '" aria-hidden="true"></span><span>' + esc(a.text) + '<small>' + esc(a.when) + '</small></span></li>';
            }).join('') + '</ul>' : '<p class="empty">Pas encore d\'activité.</p>') + '</div>' +
        '</div>' +
        '<div class="stack"><h2>Parrainage</h2><p class="sub small">' + (d.reward ? 'Avantage annoncé aux clientes : « ' + esc(d.reward) + ' ». Remettez-le aux marraines dont les amies sont venues.' : 'Aucun avantage annoncé (Réglages → Avantage du parrainage). Les clientes peuvent quand même partager leur lien.') + '</p>' +
          ((d.referrals || []).length ? '<ul class="tbl">' + d.referrals.map(function (r) { return '<li><span><strong>' + esc(r.name) + '</strong> · ' + esc(r.email) + '</span><span class="n" title="inscrites / venues">' + r.joined + ' / ' + r.came + '</span></li>'; }).join('') + '</ul><p class="sub small">Chiffres : amies inscrites / amies venues à un rendez-vous.</p>' : '<p class="empty">Pas encore de filleule.</p>') + '</div>';
      box.querySelectorAll('[data-go]').forEach(function (b) {
        b.onclick = function () { var g = b.dataset.go; if (g === 'pros-online') { S.proStatus = 'publish'; g = 'pros'; } else if (g === 'pros') S.proStatus = 'pending'; show(g); };
      });
    }).catch(function (e) { box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  /* ---------- Coiffeurs ---------- */
  var CHECKS = { photos: ['Au moins 3 photos', 'Ajoutez au moins 3 photos de vos réalisations : les clientes choisissent d\'abord sur les photos.'],
    presta: ['Une prestation avec prix', 'Ajoutez au moins une prestation avec sa durée et son prix.'],
    bio: ['Présentation', 'Rédigez une présentation de quelques lignes : votre spécialité et votre façon de travailler.'],
    diploma: ['Diplôme indiqué', 'Indiquez votre diplôme de coiffure (CAP, BP…) : il est obligatoire pour exercer en France.'],
    address: ['Adresse ou communes', 'Indiquez l\'adresse du salon, ou les communes où vous vous déplacez.'] };
  function loadPros() {
    var box = $('v-pros');
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      box.innerHTML = '<div class="vhead"><h1>Coiffeurs</h1><label class="search"><span class="sr">Rechercher un coiffeur</span><input type="search" id="cm-proQ" placeholder="Rechercher un nom"></label></div>' +
        '<div class="seg" role="group" aria-label="Statut" id="cm-proSeg"></div><div id="cm-proList"></div>';
      var t; $('proQ').oninput = function (e) { clearTimeout(t); t = setTimeout(function () { S.proQ = e.target.value.trim(); loadPros(); }, 300); };
    }
    $('proList').innerHTML = skeleton(2);
    api('pros', { params: { status: S.proStatus, q: S.proQ } }).then(function (d) {
      $('b-pros').hidden = !d.counts.pending; $('b-pros').textContent = d.counts.pending || '';
      $('proSeg').innerHTML = [['pending', 'À valider', d.counts.pending], ['publish', 'En ligne', d.counts.publish], ['draft', 'Hors ligne', d.counts.draft]].map(function (x) {
        return '<button type="button" data-s="' + x[0] + '" aria-pressed="' + (S.proStatus === x[0]) + '">' + x[1] + ' <small>' + x[2] + '</small></button>';
      }).join('');
      $('proSeg').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.proStatus = b.dataset.s; loadPros(); }; });
      var list = $('proList');
      if (!d.pros.length) {
        list.innerHTML = '<p class="empty">' + (S.proStatus === 'pending' ? 'Aucun profil en attente. Les nouveaux coiffeurs apparaîtront ici.' : 'Aucun coiffeur ici.') + '</p>';
        return;
      }
      list.innerHTML = '';
      d.pros.forEach(function (p) { list.appendChild(proCard(p)); });
    }).catch(function (e) { $('proList').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  function proCard(p) {
    var img = p.photos[0] ? p.photos[0].url : (p.art && p.art[0]);
    var miss = Object.keys(CHECKS).filter(function (k) { return !p.checks[k]; });
    var li = el('<article class="pcard"></article>');
    li.innerHTML =
      '<div class="pcard__media"><img src="' + esc(img) + '" alt="">' + (p.photos.length > 1 ? '<span class="pcard__n">' + plural(p.photos.length, 'photo', 'photos') + '</span>' : '') + '</div>' +
      '<div class="pcard__body">' +
        '<div class="pcard__top"><div><h2>' + esc(p.name) + '</h2><p class="sub">' + (p.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + esc(p.place) + ' · ' + esc(p.email) + '</p></div>' +
          (p.status === 'pending' ? '<span class="pill warn">Inscrit le ' + esc(p.submitted) + '</span>' : p.status === 'publish' ? (p.verified ? '<span class="pill ok">✓ Diplôme vérifié</span>' : (p.diploma ? '<span class="pill warn">Diplôme ' + esc(p.diploma) + ' à vérifier</span>' : '<span class="pill grey">Sans diplôme indiqué</span>')) : '<span class="pill grey">Hors ligne</span>') + '</div>' +
        '<ul class="checks">' + Object.keys(CHECKS).map(function (k) { return '<li class="' + (p.checks[k] ? 'ok' : 'no') + '">' + (p.checks[k] ? '✓' : '✕') + ' ' + CHECKS[k][0] + '</li>'; }).join('') + '</ul>' +
        (p.bio ? '<p class="pcard__bio">' + esc(p.bio) + '</p>' : '') +
        '<p class="sub small">' + p.hair.map(function (h) { return 'Cheveux ' + esc((C.hair[h] || h).toLowerCase()); }).join(' · ') + (p.presta.length ? ' — ' + p.presta.map(function (x) { return esc(x.label) + ' ' + x.price + ' €'; }).join(', ') : '') + (p.diploma ? ' — Diplôme : ' + esc(p.diploma) : '') + '</p>' +
        (p.refused ? '<p class="msg small"><strong>Corrections demandées :</strong> ' + esc(p.refused) + '</p>' : '') +
        '<div class="actions"></div>' +
      '</div>';
    var act = li.querySelector('.actions');
    function btn(label, cls) { var b = el('<button type="button" class="' + cls + '">' + esc(label) + '</button>'); act.appendChild(b); return b; }
    function run(b, body) { b.disabled = true; return api('pros/' + p.id, { method: 'POST', body: body }).then(function (r) { toast(r.message); loadPros(); }).catch(function (e) { b.disabled = false; toast(e.message); }); }
    if (p.status !== 'publish') {
      var pub = btn('Publier', 'cta-sm');
      if (miss.length) twoStep(pub, 'Publier quand même ?', function () { return run(pub, { do: 'publish' }); });
      else pub.onclick = function () { run(pub, { do: 'publish' }); };
      var ask = btn('Demander des corrections', 'ghost-sm');
      ask.onclick = function () {
        if (li.querySelector('.inline')) return;
        var f = el('<div class="inline"><label class="field"><span class="label">Message envoyé au coiffeur par e-mail</span><textarea maxlength="400"></textarea></label><div class="row"><button type="button" class="cta-sm">Envoyer</button><button type="button" class="link">Annuler</button></div></div>');
        f.querySelector('textarea').value = miss.length ? miss.map(function (k) { return '• ' + CHECKS[k][1]; }).join('\n') : '';
        var fb = f.querySelectorAll('button');
        fb[1].onclick = function () { f.remove(); };
        fb[0].onclick = function () { run(fb[0], { do: 'refuse', reason: f.querySelector('textarea').value }); };
        li.querySelector('.pcard__body').appendChild(f);
        f.querySelector('textarea').focus();
      };
    } else {
      var see = el('<a class="ghost-sm" target="_blank" rel="noopener">Voir sa page</a>'); see.href = p.url; act.appendChild(see);
      var v = btn(p.verified ? 'Retirer le badge diplôme' : 'Attribuer le badge diplôme', p.verified ? 'link' : 'cta-sm');
      v.onclick = function () { run(v, { do: p.verified ? 'unverify' : 'verify' }); };
      var off = btn('Retirer de la recherche', 'link danger');
      twoStep(off, 'Confirmer le retrait', function () { return run(off, { do: 'unpublish' }); });
    }
    return li;
  }

  /* ---------- Signalements ---------- */
  function loadReports() {
    var box = $('v-reports');
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      box.innerHTML = '<div class="vhead"><h1>Signalements</h1></div><div class="seg" role="group" aria-label="Statut" id="cm-repSeg"></div><div id="cm-repList"></div>';
    }
    $('repList').innerHTML = skeleton(2);
    api('reports', { params: { status: S.repStatus } }).then(function (d) {
      $('b-reports').hidden = !d.open; $('b-reports').textContent = d.open || '';
      $('repSeg').innerHTML = [['open', 'À traiter'], ['done', 'Traités']].map(function (x) { return '<button type="button" data-s="' + x[0] + '" aria-pressed="' + (S.repStatus === x[0]) + '">' + x[1] + (x[0] === 'open' ? ' <small>' + d.open + '</small>' : '') + '</button>'; }).join('');
      $('repSeg').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.repStatus = b.dataset.s; loadReports(); }; });
      var list = $('repList');
      if (!d.reports.length) { list.innerHTML = '<p class="empty">' + (S.repStatus === 'open' ? 'Aucun signalement à traiter.' : 'Aucun signalement traité.') + '</p>'; return; }
      list.innerHTML = '';
      d.reports.forEach(function (x) {
        var li = el('<article class="rcard"></article>');
        li.innerHTML = '<div class="rcard__top"><span class="pill warn">' + (x.type === 'review' ? 'Avis' : 'Profil') + '</span><strong>' + esc(x.reason) + '</strong><span class="sub small">' + esc(x.date) + '</span></div>' +
          '<p class="sub">Signalé par ' + esc(x.by) + ' · concerne <a href="' + esc(x.proUrl) + '" target="_blank" rel="noopener">' + esc(x.proName) + '</a></p>' +
          (x.review ? '<blockquote class="quote"><span>' + '★'.repeat(x.review.rating) + '☆'.repeat(5 - x.review.rating) + ' ' + esc(x.review.body) + '</span><footer>' + esc(x.review.firstName) + (x.review.hidden ? ' · avis masqué' : '') + '</footer></blockquote>' : '') +
          '<div class="actions"></div>';
        var act = li.querySelector('.actions');
        if (S.repStatus === 'open') {
          function b(label, cls, body, confirm) {
            var x2 = el('<button type="button" class="' + cls + '">' + esc(label) + '</button>'); act.appendChild(x2);
            var go = function () { return api('reports/' + x.id, { method: 'POST', body: body }).then(function (r) { toast(r.message); loadReports(); }); };
            if (confirm) twoStep(x2, confirm, go); else x2.onclick = function () { x2.disabled = true; go().catch(function (e) { x2.disabled = false; toast(e.message); }); };
          }
          if (x.review && !x.review.hidden) b('Masquer l\'avis', 'cta-sm', { do: 'hide_review' });
          if (x.type === 'pro') b('Retirer le profil', 'cta-sm danger', { do: 'unpublish_pro' }, 'Confirmer le retrait');
          b('Classer sans suite', 'ghost-sm', { do: 'keep' });
        }
        list.appendChild(li);
      });
    }).catch(function (e) { $('repList').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  /* ---------- Rendez-vous ---------- */
  function loadBookings() {
    var box = $('v-bookings');
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      box.innerHTML = '<div class="vhead"><h1>Rendez-vous</h1><label class="search"><span class="sr">Rechercher</span><input type="search" id="cm-bkQ" placeholder="Cliente, e-mail, coiffeur, téléphone"></label></div>' +
        '<div class="seg" role="group" aria-label="Statut" id="cm-bkSeg">' + [['', 'Tous'], ['pending', 'À confirmer'], ['confirmed', 'Confirmés'], ['cancelled', 'Annulés'], ['expired', 'Expirés']].map(function (x) {
          return '<button type="button" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div id="cm-bkList"></div>';
      var t; $('bkQ').oninput = function (e) { clearTimeout(t); t = setTimeout(function () { S.bkQ = e.target.value.trim(); loadBookings(); }, 300); };
      $('bkSeg').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.bkStatus = b.dataset.s; loadBookings(); }; });
    }
    $('bkSeg').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.s === S.bkStatus); });
    $('bkList').innerHTML = skeleton(4);
    api('bookings', { params: { status: S.bkStatus, q: S.bkQ } }).then(function (d) {
      var list = $('bkList');
      if (!d.bookings.length) { list.innerHTML = '<p class="empty">Aucun rendez-vous ne correspond.</p>'; return; }
      list.innerHTML = '<div class="rows" role="table" aria-label="Rendez-vous"><div class="rows__h" role="row"><span>Quand</span><span>Cliente</span><span>Coiffeur</span><span>Prestation</span><span>Statut</span><span></span></div></div>';
      var rows = list.querySelector('.rows');
      cellRoles(rows);
      d.bookings.forEach(function (b) {
        var st = b.past && b.status === 'confirmed' ? ['Passé', 'grey'] : (STATUS[b.status] || STATUS.pending);
        var r = el('<div class="rows__r" role="row"></div>');
        r.innerHTML = '<span><strong>' + esc(b.date) + '</strong> ' + esc(b.hour) + '<small>réservé le ' + esc(b.created) + '</small></span>' +
          '<span>' + esc(b.client) + '<small>' + esc(b.email) + (b.phone ? ' · ' + esc(b.phone) : '') + '</small></span>' +
          '<span>' + esc(b.pro) + '</span><span>' + esc(b.label) + '<small>' + b.total + ' €</small></span>' +
          '<span><span class="pill ' + st[1] + '">' + st[0] + '</span></span><span class="rows__a"></span>';
        if ((b.status === 'pending' || b.status === 'confirmed') && !b.past) {
          var x = el('<button type="button" class="link danger">Annuler</button>');
          twoStep(x, 'Confirmer', function () { return api('bookings/' + b.id + '/cancel', { method: 'POST' }).then(function (res) { toast(res.message); loadBookings(); }); });
          r.querySelector('.rows__a').appendChild(x);
        }
        rows.appendChild(r); cellRoles(r);
      });
    }).catch(function (e) { $('bkList').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  /* ---------- Membres ---------- */
  /* ---------- Chiffres du mois (kit de lancement) ---------- */
  var MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function monthLabel(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  var GOAL = 30;
  var ROWS = [
    ['pros', 'Coiffeurs en ligne (total)', '10 au lancement', function (x) { return x.pros + (x.prosNew ? ' (+' + x.prosNew + ')' : ''); }],
    ['clients', 'Clientes inscrites (total)', '30 au lancement', function (x) { return x.clients + (x.clientsNew ? ' (+' + x.clientsNew + ')' : ''); }],
    ['asked', 'Rendez-vous demandés', GOAL + ' par mois', function (x) { return String(x.asked); }],
    ['confirmed', 'Rendez-vous confirmés', '25 par mois', function (x) { return String(x.confirmed); }],
    ['active', 'Coiffeurs actifs (au moins 1 demande)', '', function (x) { return String(x.active); }],
    ['perActive', 'Rendez-vous par coiffeur actif', '2 ou plus', function (x) { return String(x.perActive).replace('.', ','); }],
    ['lostRate', 'Annulés, refusés ou sans réponse', 'moins de 20 %', function (x) { return x.asked ? x.lostRate + ' %' : '–'; }],
    ['reviews', 'Avis laissés', '10 par mois', function (x) { return String(x.reviews); }]
  ];
  function loadMonths() {
    var box = $('v-months');
    var head = '<div class="vhead"><h1>Chiffres du mois</h1></div><p class="sub small">Les indicateurs du kit de lancement, calculés automatiquement sur les 6 derniers mois. Les profils et avis d\'exemple ne sont pas comptés.</p>';
    if (!box.innerHTML) box.innerHTML = head + skeleton(3);
    api('months').then(function (d) {
      var cur = d.months[d.months.length - 1];
      d.months = d.months.slice().reverse(); // le mois en cours d'abord
      var ok = cur.asked >= GOAL;
      var html = head +
        '<div class="mgoal' + (ok ? ' mgoal--ok' : '') + '"><b>' + cur.asked + ' / ' + GOAL + '</b><span>rendez-vous demandés en ' + esc(monthLabel(cur.month)) + '. ' +
          (ok ? 'Objectif atteint : vous pouvez passer à la phase suivante.' : 'Objectif du lancement : ' + GOAL + ' par mois. Encore ' + (GOAL - cur.asked) + '.') + '</span></div>' +
        '<div class="mtbl-wrap"><table class="mtbl"><thead><tr><th scope="col">Indicateur</th><th scope="col">Objectif</th>' +
          d.months.map(function (x) { return '<th scope="col"' + (x.month === cur.month ? ' class="mtbl__now"' : '') + '>' + esc(monthLabel(x.month)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          ROWS.map(function (r) {
            return '<tr><th scope="row">' + esc(r[1]) + '</th><td class="mtbl__goal">' + esc(r[2]) + '</td>' + d.months.map(function (x) { return '<td' + (x.month === cur.month ? ' class="mtbl__now"' : '') + '>' + esc(r[3](x)) + '</td>'; }).join('') + '</tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<p class="sub small">À noter à la main dans le kit de lancement : coiffeurs contactés et abonnés Instagram. Entre parenthèses : les nouveaux du mois.</p>' +
        '<p><button type="button" class="cta-sm" id="cm-mcopy">Copier le tableau</button></p>';
      box.innerHTML = html;
      $('mcopy').onclick = function () {
        var lines = [['Indicateur', 'Objectif'].concat(d.months.map(function (x) { return monthLabel(x.month); })).join('\t')].concat(ROWS.map(function (r) {
          return [r[1], r[2]].concat(d.months.map(function (x) { return r[3](x); })).join('\t');
        }));
        var txt = lines.join('\n');
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Tableau copié : collez-le dans votre kit de lancement.'); }).catch(function () { toast('Copie impossible sur ce navigateur.'); });
      };
    }).catch(function (e) { box.innerHTML = head + '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  function loadContact() {
    var box = $('v-contact');
    box.innerHTML = '<div class="vhead"><h1>Messages</h1></div><p class="sub small">Messages envoyés depuis la page Contact. Répondez par e-mail à l\'adresse indiquée.</p>' + skeleton(3);
    api('contact').then(function (d) {
      var head = '<div class="vhead"><h1>Messages</h1></div><p class="sub small">Messages envoyés depuis la page Contact. Répondez par e-mail à l\'adresse indiquée.</p>';
      if (!d.messages.length) { box.innerHTML = head + '<p class="empty">Aucun message pour le moment.</p>'; return; }
      box.innerHTML = head + '<ul class="list">' + d.messages.map(function (m) {
        return '<li class="card"><p><strong>' + esc(m.subject || 'Sans objet') + '</strong></p>' +
          '<p class="sub small">' + esc(m.name) + ' · ' + esc(m.email) + ' · ' + esc(m.date) + '</p>' +
          '<p style="white-space:pre-wrap">' + esc(m.body) + '</p></li>';
      }).join('') + '</ul>';
    }).catch(function (e) { box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  function loadMembers() {
    var box = $('v-members');
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      box.innerHTML = '<div class="vhead"><h1>Membres</h1><label class="search"><span class="sr">Rechercher un membre</span><input type="search" id="cm-memQ" placeholder="Nom ou e-mail"></label></div>' +
        '<div class="seg" role="group" aria-label="Type de compte" id="cm-memSeg"><button type="button" data-s="client">Clientes</button><button type="button" data-s="coiffeur">Coiffeurs</button></div><div id="cm-memList"></div>';
      var t; $('memQ').oninput = function (e) { clearTimeout(t); t = setTimeout(function () { S.memQ = e.target.value.trim(); loadMembers(); }, 300); };
      $('memSeg').querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.memRole = b.dataset.s; loadMembers(); }; });
    }
    $('memSeg').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.s === S.memRole); });
    $('memList').innerHTML = skeleton(4);
    api('members', { params: { role: S.memRole, q: S.memQ } }).then(function (d) {
      var list = $('memList'), pro = S.memRole === 'coiffeur';
      if (!d.members.length) { list.innerHTML = '<p class="empty">Aucun membre ne correspond.</p>'; return; }
      list.innerHTML = '<p class="sub small">' + plural(d.total, pro ? 'compte coiffeur' : 'compte client', pro ? 'comptes coiffeur' : 'comptes client') + ' au total</p>' +
        '<div class="rows rows--m" role="table" aria-label="Membres"><div class="rows__h" role="row"><span>Nom</span><span>E-mail</span><span>Inscription</span><span>' + (pro ? 'Profil' : 'Cheveux') + '</span><span>RDV</span></div></div>';
      var rows = list.querySelector('.rows');
      cellRoles(rows);
      d.members.forEach(function (m) {
        var r = el('<div class="rows__r" role="row"></div>');
        r.innerHTML = '<span><strong>' + esc(m.name) + '</strong></span><span>' + esc(m.email) + '</span><span>' + esc(m.registered) + '</span>' +
          '<span>' + (pro ? (m.proId ? (m.proUrl ? '<a href="' + esc(m.proUrl) + '" target="_blank" rel="noopener">' + esc(m.proName) + '</a>' : esc(m.proName)) + ' <span class="pill ' + (m.proStatus === 'publish' ? 'ok' : m.proStatus === 'pending' ? 'warn' : 'grey') + '">' + (m.proStatus === 'publish' ? 'En ligne' : m.proStatus === 'pending' ? 'À valider' : 'Hors ligne') + '</span>' : '<small>Pas encore de profil</small>') : (m.hair ? '<small>' + esc(m.hair) + '</small>' : '<small>—</small>')) + '</span>' +
          '<span>' + m.bookings + '</span>';
        rows.appendChild(r); cellRoles(r);
      });
    }).catch(function (e) { $('memList').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  /* ---------- Démarrage ---------- */
  var t0 = new URLSearchParams(location.search).get('tab');
  show(VIEWS.some(function (v) { return v[0] === t0; }) ? t0 : 'dash', false);
  // Pastilles du menu dès l'arrivée, quel que soit l'écran ouvert.
  if (t0 && t0 !== 'dash') api('overview').then(function (d) { badges(d.todo.pending, d.todo.reports); }).catch(function () {});
})();
