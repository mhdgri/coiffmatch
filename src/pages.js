// Pages du site, reprises à l'identique des modèles WordPress (thème + extension Coiff'Match).
// Chaque fonction renvoie le HTML de la page ; main.jsx l'affiche puis branche les scripts d'origine.
import { HAIR, SERVICES, SKILLS, LENGTHS, esc as e, artUrl } from './lib/util';
import { availability, nextSlot, publicData, proUrl, landUrl } from './lib/db';

import GUIDE from './static/guide.html?raw';
import PARTNER from './static/partner.html?raw';
import LEGAL from './static/legal.html?raw';
import CGU from './static/cgu.html?raw';
import PRIVACY from './static/privacy.html?raw';
import NOTFOUND from './static/404.html?raw';

export const STATIC = { guide: GUIDE, partner: PARTNER, legal: LEGAL, cgu: CGU, privacy: PRIVACY, notfound: NOTFOUND };

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#E2B864"></circle><g fill="none" stroke="#0B2A27" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14v36"></path><path d="M31 14c-5 6 5 12 0 18s5 12 0 18"></path><path d="M44 14c-5 2-5 5 0 6s5 4 0 6-5 5 0 6 5 4 0 6-5 5 0 6"></path></g></svg>';
const APP = '/trouver-un-coiffeur/';
const lower = (s) => String(s).toLowerCase();
const num1 = (n) => Number(n).toFixed(1).replace('.', ',');
export const LOGOUT = '/?deconnexion=1';

export const GUIDE_C = {
  raides: { see: 'La fibre descend droite de la racine aux pointes, sans former de vague. Le sébum glisse facilement le long du cheveu : les racines regraissent vite, les pointes peuvent rester sèches.', ask: 'Comment donner du volume à mes cheveux sans les abîmer ?' },
  ondules: { see: "Les cheveux forment des vagues en S, plus ou moins marquées, sans boucler complètement. Ils s'aplatissent vite sous des produits trop riches et frisottent avec l'humidité.", ask: 'Coupez-vous mes cheveux à sec ou mouillés, et pourquoi ?' },
  boucles: { see: "Des boucles bien dessinées, en anglaises, qui se resserrent en séchant : les cheveux paraissent plus courts secs que mouillés. Ils ont besoin de beaucoup d'hydratation pour rester définis.", ask: "Avez-vous l'habitude des coupes sur boucles, et à sec ?" },
  frises: { see: "Des spirales serrées, du diamètre d'un crayon ou moins, très volumineuses. Le cheveu se rétracte beaucoup en séchant et se dessèche vite : c'est une texture fragile.", ask: 'Comment tenez-vous compte de la rétraction pour la longueur de la coupe ?' },
  crepus: { see: "Un motif en zigzag très serré, parfois sans boucle visible, avec une forte rétraction. C'est la texture la plus fragile : elle casse facilement si on la manipule sans douceur.", ask: 'Vos tresses sont-elles réalisées sans tirer sur les tempes ?' },
};

/* ---------------- En-tête et pied de page ---------------- */
export function header(ctx) {
  const { profile: p, myPro } = ctx;
  const role = p ? p.role : '';
  const coiff = role === 'coiffeur';
  const first = p ? p.first_name || (p.email || '').split('@')[0] : '';
  const menu = '<ul class="menu"><li><a href="/trouver-un-coiffeur/">Trouver un coiffeur</a></li><li><a href="/guide-des-cheveux/">Guide des cheveux</a></li><li><a href="/contact/">Contact</a></li></ul>';
  let nav = coiff ? '' : menu;
  if (!p) {
    nav += '<a class="btn btn--small site-nav__pro" href="/devenir-coiffeur-partenaire/">Devenir partenaire</a><a class="btn btn--small site-nav__account" href="/connexion/">Se connecter</a>';
  } else if (role === 'admin') {
    nav += `<a class="btn btn--small site-nav__admin" href="/equipe/">Espace équipe</a><a class="site-nav__out" href="${LOGOUT}">Se déconnecter</a>`;
  } else if (coiff) {
    nav += '<ul class="menu"><li><a href="/espace-coiffeur/">Tableau de bord</a></li>' +
      (myPro && myPro.status === 'publish' ? `<li><a href="${e(proUrl(myPro))}" target="_blank" rel="noopener">Ma page publique</a></li>` : '') + '</ul>' +
      `<details class="acct"><summary><span class="acct__av" aria-hidden="true">${e(first.charAt(0).toUpperCase())}</span>${e(first)}</summary><ul class="acct__menu">` +
      '<li><a href="/espace-coiffeur/">Tableau de bord</a></li><li><a href="/espace-coiffeur/?tab=profil">Mon profil</a></li><li><a href="/espace-coiffeur/?tab=messages">Messages</a></li><li><a href="/mon-compte/">Mon compte</a></li>' +
      `<li class="sep"><a href="${LOGOUT}">Se déconnecter</a></li></ul></details>`;
  } else {
    nav += `<details class="acct"><summary><span class="acct__av" aria-hidden="true">${e(first.charAt(0).toUpperCase())}</span>${e(first)}</summary><ul class="acct__menu">` +
      '<li><a href="/trouver-un-coiffeur/?tab=mine">Mes rendez-vous</a></li><li><a href="/trouver-un-coiffeur/?diag=1">Ma fiche cheveux</a></li><li><a href="/trouver-un-coiffeur/?tab=inbox">Messages</a></li><li><a href="/mon-compte/">Mon compte</a></li>' +
      `<li class="sep"><a href="${LOGOUT}">Se déconnecter</a></li></ul></details>`;
  }
  const badge = coiff ? '<span class="brand__pro">Pro</span>' : role === 'admin' ? '<span class="brand__pro brand__pro--team">Équipe</span>' : '';
  return `<a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><div class="wrap site-header__inner">` +
    `<a class="brand" href="${coiff ? '/espace-coiffeur/' : '/'}" rel="home"><span class="brand__mark" aria-hidden="true">${LOGO}</span><span class="brand__name">Coiff'Match</span>${badge}</a>` +
    '<button class="site-header__toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="sr">Menu</span><span class="burger" aria-hidden="true"></span></button>' +
    `<nav id="site-nav" class="site-nav" aria-label="Navigation principale">${nav}</nav></div></header>`;
}

export function footer() {
  return '<footer class="site-footer"><div class="wrap site-footer__inner"><div><p class="site-footer__brand">Coiff\'Match</p><p class="site-footer__tag"></p></div>' +
    '<nav aria-label="Liens du pied de page"><ul class="menu"><li><a href="/guide-des-cheveux/">Guide des cheveux</a></li><li><a href="/devenir-coiffeur-partenaire/">Devenir coiffeur partenaire</a></li><li><a href="/espace-coiffeur/">Espace coiffeur</a></li><li><a href="/contact/">Contact</a></li></ul></nav></div>' +
    '<nav class="wrap site-footer__types" aria-label="Coiffeurs par type de cheveux"><p class="site-footer__h">Coiffeurs par type de cheveux</p><ul class="menu">' +
    Object.entries(HAIR).map(([k, l]) => `<li><a href="/coiffeurs/${k}/">Cheveux ${lower(l)}</a></li>`).join('') + '</ul></nav>' +
    '<nav class="wrap site-footer__legal" aria-label="Informations légales"><ul class="menu"><li><a href="/mentions-legales/">Mentions légales</a></li><li><a href="/conditions-utilisation/">Conditions d\'utilisation</a></li><li><a href="/politique-de-confidentialite/">Confidentialité</a></li><li><a href="/equipe/">Espace équipe</a></li></ul></nav>' +
    `<p class="wrap site-footer__copy">© ${new Date().getFullYear()} Coiff'Match</p></footer>`;
}

const band = (title, lead) => `<header class="band"><canvas class="hero3__strands" aria-hidden="true"></canvas><div class="wrap band__inner"><h1 class="band__title">${e(title)}</h1>${lead ? `<p class="band__lead">${e(lead)}</p>` : ''}</div></header>`;

/* ---------------- Accueil ---------------- */
export function home(d) {
  const hint = { raides: 'Lisses de la racine aux pointes', ondules: 'Des vagues en S, souples', boucles: 'Des anglaises bien dessinées', frises: 'Des spirales serrées', crepus: 'Un zigzag très serré' };
  const { pros, reviews, busy, s } = d;
  const pub = pros.map((p) => ({ p, d: publicData(p, reviews) }));
  // Prochains créneaux
  const soon = [];
  for (const { p, d: x } of pub) {
    const durs = (x.presta || []).map((y) => +y.dur);
    if (!durs.length) continue;
    const next = nextSlot(p, busy, s, Math.min(...durs));
    if (next) soon.push({ ...x, next });
  }
  soon.sort((a, b) => (a.next.date + a.next.hour.padStart(5, '0')).localeCompare(b.next.date + b.next.hour.padStart(5, '0')));
  let html = `<section class="hero3"><canvas class="hero3__strands" aria-hidden="true"></canvas><div class="wrap hero3__inner"><h1 class="hero3__title">Chaque texture a son expert.</h1>` +
    '<p class="hero3__lead">Du plus raide au plus crépu, trouvez le coiffeur qui maîtrise vos cheveux, voyez son prochain créneau et réservez, au salon ou à domicile.</p>' +
    `<form class="hero3__search" action="${APP}" method="get" role="search" aria-label="Rechercher un coiffeur"><label class="hero3__field"><span>Vos cheveux</span><select name="hair" required><option value="" disabled selected>Choisir</option>` +
    Object.entries(HAIR).map(([k, l]) => `<option value="${k}">${e(l)}</option>`).join('') +
    '<option value="tous">Tous types</option></select></label><label class="hero3__field"><span>Prestation</span><select name="service">' +
    Object.entries(SERVICES).map(([k, l]) => `<option value="${k}">${e(l)}</option>`).join('') +
    '</select></label><label class="hero3__field hero3__field--grow"><span>Où ?</span><input type="search" name="ville" placeholder="Ville ou quartier" autocomplete="address-level2"></label><button type="submit">Voir les coiffeurs</button></form>' +
    `<a class="hero3__diag" href="${APP}?diag=1">Pas sûre de votre type ? Diagnostic en 30 secondes</a></div>` +
    '<ul class="hero3__types wrap" aria-label="Choisissez votre type de cheveux">' +
    Object.entries(HAIR).map(([k, l]) => `<li><a href="${APP}?hair=${k}"><strong>${e(l)}</strong><span>${e(hint[k])}</span></a></li>`).join('') + '</ul></section>' +
    `<section class="recent-home" id="recent-home" hidden data-app="${APP}" data-tex="/cm/hair/"><div class="wrap recent-home__inner"><p class="recent-home__t">Reprendre où vous en étiez</p><div class="recent-home__row"></div></div></section>`;
  if (soon.length) {
    html += '<section class="section"><div class="wrap soon"><div><h2 class="soon__title">Les prochains créneaux</h2><p class="soon__lead">Des coiffeurs qui maîtrisent les cheveux texturés, et l\'heure à laquelle ils peuvent vous recevoir.</p>' +
      `<a class="btn btn--ghost" href="${APP}?sort=soon">Tous les coiffeurs</a></div><ul class="soon__list">` +
      soon.slice(0, 4).map((x) => {
        const hl = x.hair.map((h) => lower(HAIR[h] || h)).join(', ');
        const meta = (hl.charAt(0).toUpperCase() + hl.slice(1)) + ' · ' + (x.mode === 'domicile' ? 'à domicile, ' : '') + x.place + (x.rating.n ? ' · ★ ' + x.rating.avg.toFixed(1) : '');
        const img = x.photos.length ? `<img class="soon__ph" src="${e(x.photos[0].url)}" alt="">` : `<img class="soon__ph" src="${x.art[0]}" alt="" loading="lazy">`;
        return `<li><a href="${APP}?pro=${x.id}">${img}<span class="soon__who"><strong>${e(x.name)}</strong><span>${e(meta)}</span></span><span class="soon__slot">${e(x.next.label)}</span></a></li>`;
      }).join('') + '</ul></div></section>';
  }
  html += '<section class="section textures" aria-labelledby="textures-title"><div class="wrap"><div class="textures__head"><h2 id="textures-title">Cinq textures, cinq savoir-faire</h2><p>Chaque type de cheveux se coupe, se coiffe et s\'entretient autrement. Choisissez le vôtre.</p></div><ul class="textures__list">' +
    Object.entries(HAIR).map(([k, l], i) => {
      const n = pub.filter((x) => x.d.hair.includes(k)).length;
      return `<li><a href="/coiffeurs/${k}/"><img src="${artUrl(k, 900 + i)}" alt="" loading="lazy"><span class="textures__body"><strong>${e(l)}</strong><span class="textures__n">${n ? n + ' coiffeur' + (n > 1 ? 's' : '') : 'Bientôt'}</span><span class="textures__ask">« ${e(GUIDE_C[k].ask)} »</span></span></a></li>`;
    }).join('') + '</ul></div></section>';
  // Les coiffeurs, avec leurs mots
  const voices = pub.filter((x) => (x.p.bio || '').trim().length >= 40).sort(() => Math.random() - 0.5).slice(0, 3);
  if (voices.length >= 2) {
    const trim = (t) => {
      const w = t.trim().split(/\s+/);
      return w.length > 26 ? w.slice(0, 26).join(' ') + '…' : t.trim();
    };
    html += '<section class="section voices" aria-labelledby="voices-title"><div class="wrap"><h2 id="voices-title" class="voices__title">Les coiffeurs, avec leurs mots</h2><ul class="voices__list">' +
      voices.map(({ p, d: x }) => `<li><a href="${e(x.url)}"><blockquote>« ${e(trim(p.bio))} »</blockquote><span class="voices__who"><img src="${e(x.photos.length ? x.photos[0].url : x.art[0])}" alt="" loading="lazy"><span><strong>${e(x.name)}</strong><small>${e((x.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + x.place)}</small></span></span></a></li>`).join('') +
      '</ul></div></section>';
  }
  const c = s.cancel_hours;
  html += `<section class="section promise" id="comment-ca-marche"><div class="wrap promise__inner"><p class="promise__big">Ici, un coiffeur n'apparaît que s'il maîtrise votre texture.</p><ol class="promise__path" aria-label="Comment ça marche"><li><strong>Vos cheveux</strong><span>Type, longueur, état, objectif.</span></li><li><strong>Le bon coiffeur</strong><span>Photos, tarifs, avis de cheveux comme les vôtres.</span></li><li><strong>Le prochain créneau</strong><span>Au salon ou chez vous, annulation gratuite jusqu'à ${c} h avant.</span></li></ol><ul class="promise__proofs"><li>Votre fiche cheveux est transmise au coiffeur avant le rendez-vous.</li><li>Seules les clientes venues à un rendez-vous peuvent laisser un avis.</li><li>Le badge « Diplôme vérifié » n'est donné qu'après contrôle du justificatif.</li><li>Réservation gratuite, paiement directement au coiffeur.</li></ul></div></section>` +
    '<section class="section"><div class="wrap"><div class="pro-cta"><div><h2>Vous êtes coiffeur ?</h2><p>Recevez des clientes qui ont les cheveux que vous maîtrisez, avec leur fiche cheveux avant le rendez-vous. Agenda, fichier clientes et lien à partager sur Instagram : gratuit, sans commission.</p></div><a class="btn btn--light" href="/devenir-coiffeur-partenaire/">Découvrir l\'espace coiffeur</a></div></div></section>' +
    `<section class="section"><div class="wrap wrap--narrow faq" id="faq"><h2 class="section__title">Questions fréquentes</h2><details><summary>Je ne connais pas mon type de cheveux, comment choisir ?</summary><p>Faites le diagnostic : 4 questions sur vos cheveux et votre objectif. Il remplit la recherche pour vous, et votre fiche est transmise au coiffeur quand vous réservez. Le <a href="/guide-des-cheveux/">guide des cheveux</a> explique aussi comment reconnaître chaque type.</p></details><details><summary>Est-ce que je paie en ligne ?</summary><p>Non. Vous réglez la prestation directement au coiffeur, au salon ou chez vous. La réservation est gratuite.</p></details><details><summary>Et si je dois annuler ?</summary><p>Annulez depuis « Mes rendez-vous ». C'est gratuit jusqu'à ${c} h avant le rendez-vous, et le créneau est aussitôt libéré pour une autre cliente.</p></details><details><summary>Le coiffeur peut-il venir chez moi ?</summary><p>Oui, si vous choisissez « À domicile ». Chaque coiffeur indique les communes où il se déplace et ses éventuels frais de déplacement, affichés avant de réserver.</p></details><details><summary>Comment sont choisis les coiffeurs ?</summary><p>Chaque profil est relu par notre équipe avant sa mise en ligne. Le badge « Diplôme vérifié » est attribué après contrôle d'un justificatif. Seules les clientes qui ont eu un rendez-vous peuvent laisser un avis.</p></details></div></section>`;
  return html;
}

/* ---------------- Villes ---------------- */
export const slugify = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function citySlugs(x) {
  const out = {};
  for (const c of [x.place, ...(x.zones || [])]) {
    const s = slugify(c || '');
    if (!s) continue;
    out[s] = String(c);
    const m = s.match(/^([a-z-]+?)-\d/);
    if (m) out[m[1]] = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  }
  return out;
}
export function matching(pub, hair, city = '') {
  const list = [];
  let name = '';
  for (const x of pub) {
    if (!x.hair.includes(hair)) continue;
    if (city) {
      const cs = citySlugs(x);
      if (!cs[city]) continue;
      name = name || cs[city];
    }
    list.push(x);
  }
  return [list, name];
}
export const landTitle = (hair, city, cityName) => 'Coiffeur cheveux ' + lower(HAIR[hair]) + (city ? ' à ' + cityName : '');

/* ---------------- Page « type de cheveux [+ ville] » ---------------- */
export function land(d) {
  const { pros, reviews, busy, s, hair, city } = d;
  const pub = pros.map((p) => publicData(p, reviews));
  const [list, cityName] = matching(pub, hair, city);
  if (city && !list.length) return null;
  const label = lower(HAIR[hair]);
  const rows = list.map((x) => {
    const p = pros.find((y) => y.id === x.id);
    const durs = (p.presta || []).map((y) => +y.dur), prices = (p.presta || []).map((y) => +y.price);
    return { ...x, next: durs.length ? nextSlot(p, busy, s, Math.min(...durs)) : null, from: prices.length ? Math.min(...prices) : 0 };
  }).sort((a, b) => (a.next ? a.next.date + a.next.hour.padStart(5, '0') : '9').localeCompare(b.next ? b.next.date + b.next.hour.padStart(5, '0') : '9'));
  const combos = {};
  for (const x of pub) for (const h of x.hair) {
    combos[h] = combos[h] || { '': '' };
    Object.assign(combos[h], citySlugs(x));
  }
  const n = rows.length;
  const search = APP + '?' + new URLSearchParams(Object.fromEntries(Object.entries({ hair, ville: city ? cityName : '' }).filter(([, v]) => v))).toString();
  const g = GUIDE_C[hair];
  let html = '<div class="cm-pub"><header class="cm-pub-band"><canvas class="hero3__strands" aria-hidden="true"></canvas><div class="cm-pub-wrap cm-pub-band__inner">' +
    `<nav class="cm-crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><a href="/coiffeurs/${hair}/">Cheveux ${e(label)}</a>${city ? `<span aria-hidden="true">/</span><span>${e(cityName)}</span>` : ''}</nav>` +
    `<h1 class="cm-pub-band__title">${e(landTitle(hair, city, cityName))}</h1><p class="cm-pub-band__lead">` +
    e(n ? `${n} coiffeur${n > 1 ? 's' : ''} qui maîtrise${n > 1 ? 'nt' : ''} les cheveux ${label}${city ? ' à ' + cityName : ''}. Photos, tarifs, avis de clientes aux cheveux comme les vôtres, et le prochain créneau libre.` : `Aucun coiffeur pour les cheveux ${label} pour l'instant. Revenez bientôt, ou élargissez la recherche.`) +
    `</p><a class="cm-pub-btn cm-pub-btn--gold" href="${e(search)}">Voir les disponibilités</a></div></header><div class="cm-pub-wrap cm-pub-land">`;
  if (rows.length) {
    html += '<ul class="cm-pub-rows">' + rows.map((x) => `<li><a href="${e(x.url)}"><img class="cm-pub-rows__ph" src="${e(x.photos.length ? x.photos[0].url : x.art[0])}" alt="" loading="lazy"><span class="cm-pub-rows__who"><strong>${e(x.name)}</strong><span>${e((x.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + x.place + (x.rating.n ? ' · ★ ' + num1(x.rating.avg) + ' (' + x.rating.n + ')' : ''))}</span>${x.tags.length ? `<span>${e(x.tags.slice(0, 3).join(' · '))}</span>` : ''}</span><span class="cm-pub-rows__end">${x.from ? `<span>dès ${x.from} €</span>` : ''}${x.next ? `<span class="cm-pub-rows__slot">${e(x.next.label)}</span>` : ''}</span></a></li>`).join('') + '</ul>';
  }
  html += `<section class="cm-pub-sec cm-pub-guide"><img src="/cm/hair/${hair}.svg" alt="" width="96" height="96"><div><h2>Les cheveux ${e(label)} en bref</h2><p>${e(g.see)}</p><p class="cm-pub-ask"><strong>La question à poser avant de réserver :</strong> « ${e(g.ask)} »</p><a href="/guide-des-cheveux/#${hair}">Lire le guide complet</a></div></section><section class="cm-pub-sec cm-pub-links">`;
  const cities = { ...(combos[hair] || {}) };
  delete cities[''];
  delete cities[city];
  if (Object.keys(cities).length) html += `<div><h2>Cheveux ${e(label)}, ailleurs</h2><ul class="cm-pub-tags">` + Object.entries(cities).map(([sl, nm]) => `<li><a href="/coiffeurs/${hair}/${sl}/">${e(nm)}</a></li>`).join('') + '</ul></div>';
  html += `<div><h2>Autres types de cheveux${city ? ' à ' + e(cityName) : ''}</h2><ul class="cm-pub-tags">` +
    Object.entries(HAIR).filter(([k]) => k !== hair && !(city && !(combos[k] || {})[city])).map(([k, h]) => `<li><a href="/coiffeurs/${k}/${city && (combos[k] || {})[city] ? city + '/' : ''}">Cheveux ${lower(h)}</a></li>`).join('') +
    '</ul></div></section></div></div>';
  return { html, title: landTitle(hair, city, cityName), desc: `${landTitle(hair, city, cityName)} : ${n} coiffeur${n > 1 ? 's' : ''} qui maîtrise${n > 1 ? 'nt' : ''} les cheveux ${label}, avec photos, tarifs, avis et prochain créneau. Réservez en ligne, au salon ou à domicile.` };
}

/* ---------------- Page publique d'un coiffeur ---------------- */
const fmtDurPub = (m) => {
  const h = Math.floor(m / 60), r = m % 60;
  return h ? h + ' h' + (r ? ' ' + r : '') : r + ' min';
};
export function pro(d) {
  const { p, reviews, busy, s, pros } = d;
  const x = publicData(p, reviews, { bio: p.bio || '', diploma: p.diploma || '' });
  const visible = reviews.filter((r) => r.pro_id === p.id && !r.hidden);
  const book = `${APP}?pro=${x.id}`;
  const durs = x.presta.map((y) => +y.dur), prices = x.presta.map((y) => +y.price);
  const next = durs.length ? nextSlot(p, busy, s, Math.min(...durs)) : null;
  const city = slugify(x.place);
  const before = x.photos.find((ph) => ph.tag === 'avant'), after = x.photos.find((ph) => ph.tag === 'apres');
  const fmtDay = (ts) => {
    const dd = new Date(ts);
    const M = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${dd.getDate()} ${M[dd.getMonth()]} ${dd.getFullYear()}`;
  };
  let html = '<div class="cm-pub"><header class="cm-pub-band"><canvas class="hero3__strands" aria-hidden="true"></canvas><div class="cm-pub-wrap cm-pub-band__inner"><nav class="cm-crumbs" aria-label="Fil d\'Ariane"><a href="/">Accueil</a>' +
    (x.hair.length ? `<span aria-hidden="true">/</span><a href="/coiffeurs/${x.hair[0]}/">Cheveux ${lower(HAIR[x.hair[0]])}</a><span aria-hidden="true">/</span><a href="/coiffeurs/${x.hair[0]}/${city}/">${e(x.place)}</a>` : '') + '</nav>' +
    `<h1 class="cm-pub-band__title">${e(x.name)}</h1><p class="cm-pub-band__meta">${e((x.mode === 'domicile' ? 'Coiffure à domicile' : 'Coiffure en salon') + ' · ' + x.place)}` +
    (x.rating.n ? ` · <strong>★ ${num1(x.rating.avg)}</strong> (${x.rating.n} avis)` : '') + '</p><p class="cm-pub-badges">' +
    (x.verified ? '<span class="cm-pub-badge cm-pub-badge--ok">✓ Diplôme vérifié</span>' : '') + (x.example ? '<span class="cm-pub-badge">Profil d\'exemple</span>' : '') +
    x.hair.map((h) => `<span class="cm-pub-badge">${e(HAIR[h])}</span>`).join('') + '</p></div></header><div class="cm-pub-wrap cm-pub-grid"><div class="cm-pub-main"><section class="cm-pub-gallery" aria-label="Réalisations" data-lb>';
  if (x.photos.length) {
    html += x.photos.slice(0, 6).map((ph, i) => `<figure class="cm-pub-ph${i === 0 ? ' cm-pub-ph--big' : ''}"><img src="${e(ph.url)}" alt="Réalisation de ${e(x.name)}" loading="${i ? 'lazy' : 'eager'}">${ph.tag ? `<figcaption>${ph.tag === 'avant' ? 'Avant' : 'Après'}</figcaption>` : ''}</figure>`).join('');
  } else {
    html += x.art.slice(0, 3).map((a, i) => `<figure class="cm-pub-ph${i === 0 ? ' cm-pub-ph--big' : ''}"><img src="${a}" alt="" loading="lazy"></figure>`).join('') + '<p class="cm-pub-note">Les photos des réalisations arrivent bientôt.</p>';
  }
  html += '</section>';
  if (before && after) html += `<section class="cm-pub-sec"><h2>Avant / après</h2><div class="cm-pub-ba" data-lb><figure><img src="${e(before.url)}" alt="Avant" loading="lazy"><figcaption>Avant</figcaption></figure><figure><img src="${e(after.url)}" alt="Après" loading="lazy"><figcaption>Après</figcaption></figure></div></section>`;
  if (x.bio || x.tags.length || x.skills.length || x.staff.length) {
    html += '<section class="cm-pub-sec"><h2>À propos</h2>' + (x.bio ? `<p class="cm-pub-bio">${e(x.bio)}</p>` : '') +
      (x.skills.length ? '<h3 class="cm-pub-h3">Savoir-faire</h3><ul class="cm-pub-skills">' + x.skills.map((k) => `<li>${e(SKILLS[k] || k)}</li>`).join('') + '</ul>' : '') +
      (x.tags.length ? '<ul class="cm-pub-tags">' + x.tags.map((t) => `<li>${e(t)}</li>`).join('') + '</ul>' : '') +
      (x.staff.length ? `<p class="cm-pub-team"><strong>L'équipe :</strong> ${e(x.staff.map((m) => m.name).join(', '))}. Vous choisissez avec qui au moment de réserver.</p>` : '') + '</section>';
  }
  html += '<section class="cm-pub-sec"><h2>Prestations et tarifs</h2><ul class="cm-pub-presta">' + x.presta.map((y) => {
    const plus = y.plus && Object.keys(y.plus).length ? ' · cheveux courts, ' + Object.entries(y.plus).map(([len, v]) => '+' + v + ' € ' + lower(LENGTHS[len])).join(', ') : '';
    return `<li><span class="cm-pub-presta__name">${e(y.label)}<small>${e(fmtDurPub(+y.dur) + plus)}</small></span><span class="cm-pub-presta__price">${plus ? 'dès ' : ''}${+y.price} €</span><a class="cm-pub-btn cm-pub-btn--small" href="${book}&amp;presta=${e(y.k)}">Choisir</a></li>`;
  }).join('') + '</ul>' + (x.mode === 'domicile' && x.travel ? `<p class="cm-pub-note">Frais de déplacement : ${x.travel} €, ajoutés au total.</p>` : '') + '</section>';
  html += `<section class="cm-pub-sec" id="avis"><h2>Avis${x.rating.n ? ' · ★ ' + num1(x.rating.avg) : ''}</h2>`;
  html += visible.length ? '<ul class="cm-pub-reviews">' + visible.slice(0, 8).map((rv) => `<li><p class="cm-pub-reviews__who"><strong>${e(rv.first_name)}</strong>${rv.hair && HAIR[rv.hair] ? ' · cheveux ' + lower(HAIR[rv.hair]) : ''} · <span aria-label="${rv.rating} sur 5">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span> · ${fmtDay(rv.created)}</p><p>${e(rv.body)}</p>${rv.photo ? `<img class="cm-pub-reviews__ph" data-lb src="${e(rv.photo)}" alt="Photo de la cliente après le rendez-vous" loading="lazy">` : ''}${rv.reply ? `<p class="cm-pub-reviews__reply"><strong>Réponse du coiffeur :</strong> ${e(rv.reply)}</p>` : ''}</li>`).join('') + '</ul>'
    : '<p class="cm-pub-note">Pas encore d\'avis. Seules les clientes qui ont eu un rendez-vous peuvent en laisser un.</p>';
  html += `</section><section class="cm-pub-sec"><h2>${x.mode === 'domicile' ? 'Se déplace à' : 'Adresse'}</h2>`;
  if (x.mode === 'salon' && x.address) html += `<p>${e(x.address)} · <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(x.address)}" target="_blank" rel="noopener">Voir sur la carte</a></p>`;
  else if (x.zones.length) html += '<ul class="cm-pub-tags">' + x.zones.map((z) => `<li>${e(z)}</li>`).join('') + '</ul>';
  else html += `<p>${e(x.place)}</p>`;
  html += '</section></div><aside class="cm-pub-side"><div class="cm-pub-card">' + (prices.length ? `<p class="cm-pub-card__from">À partir de <strong>${Math.min(...prices)} €</strong></p>` : '') +
    `<p class="cm-pub-card__next">${next ? 'Prochain créneau : <strong>' + e(next.label) + '</strong>' : 'Aucun créneau libre pour l\'instant'}</p><a class="cm-pub-btn" href="${book}">Réserver</a>` +
    `<p class="cm-pub-card__fine">Gratuit, paiement au coiffeur. Annulation sans frais jusqu'à ${s.cancel_hours} h avant.</p><button type="button" class="cm-pub-share" data-url="${e(proUrl(p))}">Partager ce profil</button></div></aside></div>`;
  if (x.hair.length) {
    const pub = pros.map((y) => publicData(y, reviews));
    const [same] = matching(pub, x.hair[0], city);
    const others = same.filter((o) => o.id !== x.id).slice(0, 3);
    if (others.length) html += `<section class="cm-pub-wrap cm-pub-sec cm-pub-others"><h2>Aussi à ${e(x.place)}</h2><ul class="cm-pub-list">` + others.map((o) => `<li><a href="${e(o.url)}"><strong>${e(o.name)}</strong><span>${e((o.mode === 'domicile' ? 'À domicile · ' : 'Salon · ') + o.place)}</span></a></li>`).join('') + '</ul></section>';
  }
  html += '</div>';
  const lab = x.hair.map((h) => lower(HAIR[h]));
  const words = x.bio.trim().split(/\s+/);
  const desc = ((x.bio ? (words.length > 24 ? words.slice(0, 24).join(' ') + '…' : x.bio) + ' ' : '') + (lab.length ? 'Cheveux ' + lab.join(', ') + '. ' : '') + (x.mode === 'domicile' ? 'À domicile, ' : 'Au salon, ') + x.place + '. Réservez en ligne.').trim();
  return { html, title: x.name + ' – coiffure ' + (x.mode === 'domicile' ? 'à domicile' : 'en salon') + ', ' + x.place, desc };
}
void availability;
void landUrl;

/* ---------------- Connexion / inscription ---------------- */
export const AUTH_ERRORS = {
  login: 'E-mail ou mot de passe incorrect.',
  limit: "Trop d'inscriptions depuis votre connexion. Réessayez plus tard.",
  fields: 'Remplissez tous les champs.',
  email: "Cette adresse e-mail n'est pas valide.",
  pass: 'Le mot de passe doit faire au moins 8 caractères.',
  terms: "Vous devez accepter les conditions d'utilisation.",
  error: "Le compte n'a pas pu être créé. Réessayez.",
};
export function door(type, { notice = '', sponsor = '', redirect = '' } = {}) {
  const pro = type === 'coiffeur';
  const r = redirect ? `<input type="hidden" name="redirect" value="${e(redirect)}">` : '';
  return band('Se connecter', 'Clientes et coiffeurs ont chacun leur espace. Choisissez le vôtre.') +
    '<article class="wrap page type-page status-publish hentry"><div class="entry"><div class="cm-door"><nav class="cm-door__tabs" aria-label="Type de compte">' +
    `<a href="/connexion/"${pro ? '' : ' aria-current="page"'}>Je réserve</a><a href="/connexion/?espace=coiffeur"${pro ? ' aria-current="page"' : ''}>Je suis coiffeur</a></nav>` +
    '<div class="cm-account cm-account--guest">' +
    (pro ? '<div class="cm-pro-intro"><h2>Gratuit, sans commission</h2><p>Créez votre profil gratuitement : vos réalisations en photos, vos prestations et vos horaires. Recevez des demandes de clientes qui ont les cheveux que vous maîtrisez, acceptez-les en un clic.</p></div>' : '') +
    (sponsor && !pro ? `<p class="cm-notice cm-notice--ok">${e(sponsor)} vous invite sur Coiff'Match. Créez votre compte client pour trouver le coiffeur qui connaît vos cheveux.</p>` : '') +
    notice +
    '<div class="cm-account__grid"><section class="cm-card" aria-labelledby="cm-login-title"><h2 id="cm-login-title">J\'ai déjà un compte</h2>' +
    `<form method="post" class="cm-form" data-cm-login data-type="${type}">${r}<label>E-mail<input type="text" inputmode="email" name="log" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>Mot de passe<input type="password" name="pwd" autocomplete="current-password" required></label><label class="cm-check"><input type="checkbox" name="rememberme" value="forever"> <span>Rester connecté</span></label><button type="submit" class="cm-btn">Se connecter</button><a href="/mot-de-passe/">Mot de passe oublié ?</a></form></section>` +
    `<section class="cm-card" aria-labelledby="cm-register-title"><h2 id="cm-register-title">${pro ? 'Créer mon compte coiffeur' : 'Créer un compte client'}</h2>` +
    `<form method="post" class="cm-form" data-cm-register data-type="${type}">${r}<label>Prénom<input type="text" name="first_name" autocomplete="given-name" maxlength="40" required></label><label>${pro ? 'E-mail professionnel' : 'E-mail'}<input type="email" name="email" autocomplete="email" required></label><label>Mot de passe (8 caractères minimum)<input type="password" name="password" autocomplete="new-password" minlength="8" required></label><label class="cm-hp" aria-hidden="true">Ne pas remplir<input type="text" name="website" tabindex="-1" autocomplete="off"></label><label class="cm-check"><input type="checkbox" name="terms" value="1" required> <span>J'accepte les <a href="/conditions-utilisation/" target="_blank">conditions d'utilisation</a> et j'ai lu la <a href="/politique-de-confidentialite/" target="_blank">politique de confidentialité</a>.</span></label><button type="submit" class="cm-btn">Créer mon compte</button></form></section></div>` +
    `<p class="cm-account__switch cm-door__hide">${pro ? 'Vous cherchez un coiffeur ? <a href="/mon-compte/">Espace client</a>' : 'Vous êtes coiffeur ? <a href="/espace-coiffeur/">Espace coiffeur</a>'}</p></div>` +
    '<p class="cm-door__team">Vous faites partie de l\'équipe Coiff\'Match ? <a href="/equipe/">Connexion équipe</a></p></div></div></article>';
}

export function teamLogin(notice = '') {
  return '<div class="wrap app-page"><div class="cm-teamlogin"><div class="cm-card"><p class="cm-teamlogin__tag">Espace équipe</p><h1>Connexion de l\'équipe</h1><p class="cm-teamlogin__lead">Validez les coiffeurs, traitez les signalements et suivez l\'activité de la plateforme.</p>' + notice +
    '<form method="post" class="cm-form" data-cm-login data-type="team"><input type="hidden" name="redirect" value="/equipe/"><label>Identifiant ou e-mail<input type="text" name="log" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>Mot de passe<input type="password" name="pwd" autocomplete="current-password" required></label><label class="cm-check"><input type="checkbox" name="rememberme" value="forever"> <span>Rester connecté</span></label><button type="submit" class="cm-btn">Se connecter</button><a href="/mot-de-passe/">Mot de passe oublié ?</a></form></div></div></div>';
}

export function resetPage(mode, notice = '') {
  const body = mode === 'new'
    ? '<form class="cm-form cm-card" data-cm-newpass><h2>Nouveau mot de passe</h2><label>Nouveau mot de passe (8 caractères minimum)<input type="password" name="password" autocomplete="new-password" minlength="8" required></label><button type="submit" class="cm-btn">Enregistrer</button></form>'
    : '<form class="cm-form cm-card" data-cm-lost><h2>Mot de passe oublié</h2><p>Indiquez l\'adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p><label>E-mail<input type="email" name="email" autocomplete="email" required></label><button type="submit" class="cm-btn">Recevoir le lien</button></form>';
  return band('Mot de passe', '') + `<article class="wrap page"><div class="entry"><div class="cm-account" style="max-width:520px">${notice}${body}</div></div></article>`;
}

/* ---------------- Mon compte ---------------- */
export function account(ctx, extra) {
  const { profile: p, myPro } = ctx;
  const role = p.role;
  const first = p.first_name || p.email.split('@')[0];
  const coiff = role === 'coiffeur', team = role === 'admin';
  let h = `<div class="cm-account">${extra.ok ? '<p class="cm-notice cm-notice--ok">Votre compte est créé. Bienvenue sur Coiff\'Match !</p>' : ''}<h2>Bonjour ${e(first)}</h2><p>Connecté avec ${e(p.email)} · ${coiff ? 'compte coiffeur' : team ? 'compte administrateur' : 'compte client'}</p>`;
  if (coiff) {
    h += '<p>Votre compte est un compte coiffeur : tout se passe dans votre espace.</p><ul class="cm-account__links"><li><a class="cm-btn" href="/espace-coiffeur/">Mon espace coiffeur</a></li></ul>';
  } else {
    h += `<ul class="cm-account__links"><li><a class="cm-btn" href="${APP}">Trouver un coiffeur</a></li><li><a class="cm-btn cm-btn--ghost" href="${APP}?tab=mine">Mes rendez-vous</a></li><li><a class="cm-btn cm-btn--ghost" href="${APP}?diag=1">Ma fiche cheveux</a></li><li><a class="cm-btn cm-btn--ghost" href="${APP}?tab=inbox">Mes messages</a></li>` +
      (team ? '<li><a class="cm-btn cm-btn--ghost" href="/espace-coiffeur/">Espace coiffeur</a></li><li><a class="cm-btn cm-btn--ghost" href="/equipe/">Administration</a></li>' : '') + '</ul>' +
      (team ? '' : '<p class="cm-form__note">Vous êtes coiffeur ? Les comptes sont séparés : créez votre compte professionnel sur l\'<a href="/espace-coiffeur/">Espace coiffeur</a> avec une autre adresse e-mail.</p>');
  }
  if (!coiff) {
    const link = `${location.origin}/?parrain=${p.ref_code || ''}`;
    const msg = "Je trouve mes coiffeurs sur Coiff'Match : des pros qui connaissent vraiment nos cheveux. Essaie : " + link;
    const st = extra.ref || { signups: 0, booked: 0 };
    h += '<div class="cm-install" data-cm-install hidden></div>' +
      `<section class="cm-card cm-ref" id="parrainage"><h3>Invitez vos amies</h3><p>${e(extra.reward || 'Partagez votre lien : vos amies trouvent elles aussi le coiffeur qui connaît leurs cheveux.')}</p><div class="cm-ref__row"><input type="text" readonly value="${e(link)}" aria-label="Votre lien de parrainage" onfocus="this.select()"><button type="button" class="cm-btn" data-cm-copy="${e(link)}">Copier le lien</button></div><p><a class="cm-btn cm-btn--ghost" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Envoyer sur WhatsApp</a></p>` +
      `<p class="cm-form__note">${st.signups} amie${st.signups > 1 ? 's' : ''} inscrite${st.signups > 1 ? 's' : ''} grâce à vous${st.signups ? ', dont ' + st.booked + ' venue' + (st.booked > 1 ? 's' : '') + ' à un rendez-vous' : ''}.</p></section>` +
      `<div id="rappels"><form method="post" class="cm-card cm-form cm-prefs" data-cm-prefs><h3>Mes rappels</h3>${extra.prefs ? '<p class="cm-notice cm-notice--ok" role="status">Préférence enregistrée.</p>' : ''}<label class="cm-check"><input type="checkbox" name="followup" value="1"${p.followup ? ' checked' : ''}> <span>M'écrire quand c'est le moment de mon prochain entretien (par exemple 6 semaines après des tresses, 8 après une coupe)</span></label><button type="submit" class="cm-btn cm-btn--ghost">Enregistrer</button></form></div>`;
  }
  h += `<p><a href="${LOGOUT}">Se déconnecter</a></p>`;
  if (!team) {
    h += `<details class="cm-card cm-delete"${extra.delErr ? ' open' : ''}><summary>Supprimer mon compte</summary>` +
      (extra.delErr === 'pass' ? '<p class="cm-notice cm-notice--err" role="alert">Mot de passe incorrect.</p>' : extra.delErr === 'confirm' ? '<p class="cm-notice cm-notice--err" role="alert">Cochez la case pour confirmer.</p>' : extra.delErr ? `<p class="cm-notice cm-notice--err" role="alert">${e(extra.delErr)}</p>` : '') +
      `<p>Votre compte, vos messages, vos favoris${myPro ? ', votre profil coiffeur et ses photos' : ''} seront supprimés. Vos rendez-vous à venir seront annulés et la personne concernée prévenue. Vos avis et rendez-vous passés sont gardés sans votre prénom. <strong>C'est définitif.</strong></p>` +
      '<form method="post" class="cm-form" data-cm-delete><label>Votre mot de passe<input type="password" name="password" autocomplete="current-password" required></label><label class="cm-check"><input type="checkbox" name="confirm" value="1" required> <span>Je veux supprimer définitivement mon compte</span></label><button type="submit" class="cm-btn cm-btn--danger">Supprimer mon compte</button></form></details>';
  }
  h += '</div>';
  return band('Mon compte', '') + `<article class="wrap page type-page status-publish hentry"><div class="entry">${h}</div></article>`;
}

/* ---------------- Contact ---------------- */
export function contact(ctx, notice = '') {
  const p = ctx.profile;
  return band('Contact', 'Clientes, coiffeurs, partenaires : écrivez-nous.') +
    '<div class="wrap contact2"><aside class="contact2__info"><div><h2>Réponse sous 48 h</h2><p>Du lundi au vendredi. Pour un rendez-vous déjà pris, écrivez directement au coiffeur depuis « Mes rendez-vous » : c\'est plus rapide.</p></div><div><h3>Vous êtes coiffeur ?</h3><p>Créez votre profil gratuit ou retrouvez votre espace.</p><p><a href="/devenir-coiffeur-partenaire/">Devenir coiffeur partenaire</a></p></div><div><h3>Une question rapide ?</h3><p>Paiement, annulation, déplacement à domicile : <a href="/#faq">les réponses sont ici</a>.</p></div></aside>' +
    `<div class="contact2__form">${notice}<form method="post" class="cm-form cm-card" data-cm-contact><label>Votre nom<input type="text" name="name" maxlength="60" required value="${e(p ? p.first_name : '')}"></label><label>Votre e-mail<input type="email" name="email" required value="${e(p ? p.email : '')}"></label><label>Message<textarea name="message" rows="6" maxlength="2000" required></textarea></label><label class="cm-hp" aria-hidden="true">Ne pas remplir<input type="text" name="website" tabindex="-1" autocomplete="off"></label><p class="cm-form__note">Vos coordonnées servent uniquement à vous répondre. <a href="/politique-de-confidentialite/">Politique de confidentialité</a></p><button type="submit" class="cm-btn">Envoyer</button></form></div></div>`;
}

/* ---------------- Espace coiffeur pour un compte client ---------------- */
export const clientInProSpace = () =>
  band('Espace coiffeur', '') + '<article class="wrap page"><div class="entry"><div class="cm-account"><div class="cm-card"><h2>Ce compte est un compte client</h2><p>Les comptes client et coiffeur sont séparés. Pour proposer vos services, déconnectez-vous puis créez un compte coiffeur avec une autre adresse e-mail.</p><ul class="cm-account__links"><li><a class="cm-btn" href="/?deconnexion=1&amp;vers=%2Fconnexion%2F%3Fespace%3Dcoiffeur">Me déconnecter et créer un compte coiffeur</a></li><li><a class="cm-btn cm-btn--ghost" href="/trouver-un-coiffeur/">Retour à mes rendez-vous</a></li></ul></div></div></div></article>';

export const appShell = (mode) => `<div class="wrap app-page"><div id="cm-app" class="cm-app cm-app--${mode}" aria-live="polite"><p class="cm-loading">Chargement de Coiff'Match…</p></div></div>`;
export const teamShell = () => '<div class="wrap app-page"><div id="cm-app" class="cm-app cm-app--pro cm-app--team" aria-live="polite"><p class="cm-loading">Chargement de l\'espace équipe…</p></div></div>';
