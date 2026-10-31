// Coiff'Match : chaque adresse affiche la même page que le site WordPress d'origine.
// React assemble la page (en-tête, contenu, pied) ; les scripts d'origine (app.js, team.js, nav.js…) font le reste.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { configured, currentUser, loadBusy, loadPros, loadReviews, myProfile, resetSessionCache, sb, settings, proUrl } from './lib/db';
import { installApi } from './lib/api';
import { HAIR, SERVICES, SKILLS, LENGTHS, DIPLOMAS, ALL_HOURS, HAIR_QUESTIONS, esc } from './lib/util';
import * as P from './pages';

const CSS = ['/cm/block-library.css', '/cm/wp-base.css', '/cm/fonts/fonts.css'];
const pathname = location.pathname.replace(/\/+$/, '') + '/';
const params = new URLSearchParams(location.search);
const go = (url) => {
  location.replace(url);
  return new Promise(() => {});
};
const notice = (msg, kind = 'err') => `<p class="cm-notice cm-notice--${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${esc(msg)}</p>`;

function css(list) {
  return Promise.all(list.map((href) => new Promise((ok) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = ok;
    l.onerror = ok;
    document.head.appendChild(l);
  })));
}
function script(src) {
  return new Promise((ok) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = ok;
    document.body.appendChild(s);
  });
}
function meta(name, content, prop = false) {
  if (!content) return;
  const m = document.createElement('meta');
  m.setAttribute(prop ? 'property' : 'name', name);
  m.content = content;
  document.head.appendChild(m);
}

/** Configuration lue par app.js (même contenu que wp_localize_script). */
function appConfig(mode, me) {
  return {
    mode, proUrl: `${location.origin}/espace-coiffeur/`, api: `${location.origin}/__cm/`, nonce: '', loggedIn: me ? '1' : '',
    accountUrl: `${location.origin}/mon-compte/`, appUrl: `${location.origin}/trouver-un-coiffeur/`, hair: HAIR, hairQuestions: HAIR_QUESTIONS,
    services: SERVICES, diplomas: DIPLOMAS, skills: SKILLS, lengths: LENGTHS, allHours: ALL_HOURS, payment: 'onsite', deposit: '10',
    cguUrl: `${location.origin}/conditions-utilisation/`, expireHours: '24', hairImg: `${location.origin}/cm/hair/`, logoutUrl: `${location.origin}${P.LOGOUT}`,
    leaflet: { js: `${location.origin}/cm/leaflet/leaflet.js`, css: `${location.origin}/cm/leaflet/leaflet.css` }, cancelHours: '24', siteName: "Coiff'Match",
  };
}

/* ---------------- Choix de la page ---------------- */
async function resolve(ctx) {
  const s = await settings();
  const out = { title: '', bodyClass: 'wp-embed-responsive wp-theme-coiffmatch', app: false, scripts: [] };
  const page = (cls, html, title, extra = {}) => Object.assign(out, { bodyClass: `${cls} ${out.bodyClass}`, html, title, app: true }, extra);
  const loggedClass = ctx.profile ? ' logged-in' : '';

  // Déconnexion
  if (params.get('deconnexion')) {
    await sb.auth.signOut();
    return go(params.get('vers') && params.get('vers').startsWith('/') ? params.get('vers') : '/');
  }
  // Lien de parrainage : on s'en souvient 30 jours.
  if (params.get('parrain') && !ctx.user) {
    try {
      localStorage.setItem('cm_parrain', JSON.stringify({ code: params.get('parrain').toUpperCase().slice(0, 12), t: Date.now() }));
    } catch {
      /* stockage indisponible */
    }
  }

  if (pathname === '/') {
    const pros = await loadPros('publish');
    const [reviews, busy] = await Promise.all([loadReviews(pros.map((p) => p.id)), loadBusy(pros.map((p) => p.id))]);
    return Object.assign(out, { bodyClass: 'home blog ' + out.bodyClass + loggedClass, html: P.home({ pros, reviews, busy, s }), title: "Coiff'Match – Le coiffeur qui connaît vos cheveux", desc: 'Du plus raide au plus crépu, trouvez le coiffeur qui maîtrise vos cheveux, voyez son prochain créneau et réservez, au salon ou à domicile.' });
  }
  if (pathname === '/comment-ca-marche/') return go('/#comment-ca-marche');
  if (pathname === '/trouver-un-coiffeur/') {
    return page('wp-singular page-template page-template-template-app page-template-template-app-php page' + loggedClass, P.appShell('client'), "Trouver un coiffeur – Coiff'Match", { config: appConfig('client', ctx.user), scripts: ['/cm/lightbox.js', '/cm/app.js'], desc: 'Trouvez un coiffeur qui maîtrise votre type de cheveux (raides, ondulés, bouclés, frisés, crépus), au salon ou à domicile, et réservez en ligne.' });
  }
  if (pathname === '/espace-coiffeur/') {
    if (!ctx.user) return go('/connexion/?espace=coiffeur' + (params.get('tab') ? '&redirect=' + encodeURIComponent('/espace-coiffeur/?tab=' + params.get('tab')) : ''));
    if (!['coiffeur', 'admin'].includes(ctx.profile.role)) return page('wp-singular page-template-default page' + loggedClass, P.clientInProSpace(), "Espace coiffeur – Coiff'Match");
    return page('wp-singular page-template page-template-template-app page-template-template-app-php page' + loggedClass, P.appShell('pro'), "Espace coiffeur – Coiff'Match", { config: appConfig('pro', ctx.user), scripts: ['/cm/lightbox.js', '/cm/app.js'] });
  }
  if (pathname === '/connexion/' || (pathname === '/mon-compte/' && !ctx.user)) {
    const type = params.get('espace') === 'coiffeur' ? 'coiffeur' : 'client';
    if (ctx.user) {
      return page('wp-singular page-template-default page' + loggedClass, `<header class="band"><canvas class="hero3__strands" aria-hidden="true"></canvas><div class="wrap band__inner"><h1 class="band__title">Se connecter</h1></div></header><article class="wrap page"><div class="entry"><p class="cm-notice cm-notice--ok">Vous êtes déjà connecté. <a href="${ctx.profile.role === 'coiffeur' ? '/espace-coiffeur/' : ctx.profile.role === 'admin' ? '/equipe/' : '/trouver-un-coiffeur/'}">Aller à mon espace</a></p></div></article>`, "Se connecter – Coiff'Match");
    }
    let sponsor = '';
    try {
      const ref = JSON.parse(localStorage.getItem('cm_parrain') || 'null');
      if (ref && Date.now() - ref.t < 30 * 864e5) sponsor = (await sb.rpc('cm_ref_name', { p_code: ref.code })).data || '';
    } catch {
      /* rien */
    }
    const err = params.get('cm_err');
    const n = params.get('cm_deleted') ? notice("Votre compte a bien été supprimé. Au revoir et merci d'avoir utilisé Coiff'Match.", 'ok') : err && P.AUTH_ERRORS[err] ? notice(P.AUTH_ERRORS[err]) : '';
    return page('wp-singular page-template-default page', P.door(type, { notice: n, sponsor, redirect: params.get('redirect') || '' }), "Se connecter – Coiff'Match");
  }
  if (pathname === '/mot-de-passe/') {
    const recovery = location.hash.includes('type=recovery') || params.get('nouveau');
    return page('wp-singular page-template-default page' + loggedClass, P.resetPage(recovery ? 'new' : 'lost', params.get('envoye') ? notice('Si un compte existe avec cette adresse, un e-mail vient de partir. Ouvrez le lien qu\'il contient.', 'ok') : ''), "Mot de passe – Coiff'Match");
  }
  if (pathname === '/mon-compte/') {
    const [ref, setv] = await Promise.all([ctx.profile.role === 'client' ? sb.rpc('cm_ref_stats') : { data: null }, settings()]);
    return page('wp-singular page-template-default page' + loggedClass, P.account(ctx, { ok: params.get('cm_ok'), ref: ref.data, reward: setv.ref_reward, prefs: params.get('cm_prefs'), delErr: params.get('cm_del') }), "Mon compte – Coiff'Match");
  }
  if (pathname === '/equipe/') {
    if (!ctx.user || ctx.profile.role !== 'admin') {
      return page('wp-singular page-template page-template-template-app page-template-template-app-php page' + loggedClass, P.teamLogin(ctx.user ? notice("Ce compte n'a pas accès à l'espace équipe.") : params.get('cm_err') ? notice(P.AUTH_ERRORS.login) : ''), "Espace équipe – Coiff'Match");
    }
    window.CM_TEAM = { api: `${location.origin}/__cm/`, nonce: '', firstName: ctx.profile.first_name || 'équipe', adminUrl: 'https://supabase.com/dashboard', settingsUrl: 'https://supabase.com/dashboard', launchUrl: 'https://supabase.com/dashboard', logoutUrl: P.LOGOUT, siteUrl: location.origin + '/', hair: HAIR };
    return page('wp-singular page-template page-template-template-app page-template-template-app-php page' + loggedClass, P.teamShell(), "Espace équipe – Coiff'Match", { scripts: ['/cm/team.js'] });
  }
  if (pathname === '/contact/') {
    const n = params.get('cm_sent') ? notice('Merci, votre message a bien été envoyé.', 'ok') : params.get('cm_err') ? notice(params.get('cm_err')) : '';
    return page('wp-singular page-template-default page' + loggedClass, P.contact(ctx, n), "Contact – Coiff'Match");
  }
  const STATICS = {
    '/guide-des-cheveux/': ['guide', 'Guide des cheveux', true],
    '/devenir-coiffeur-partenaire/': ['partner', 'Devenir coiffeur partenaire', false],
    '/mentions-legales/': ['legal', 'Mentions légales', true],
    '/conditions-utilisation/': ['cgu', "Conditions d'utilisation", true],
    '/politique-de-confidentialite/': ['privacy', 'Politique de confidentialité', true],
  };
  if (STATICS[pathname]) {
    const [k, t, appCss] = STATICS[pathname];
    return Object.assign(out, {
      bodyClass: (k === 'privacy' ? 'privacy-policy ' : '') + 'wp-singular page-template-default page ' + out.bodyClass + loggedClass,
      html: P.STATIC[k].replaceAll('{{ORIGIN}}', location.origin), title: `${t} – Coiff'Match`, app: appCss,
    });
  }
  let m = pathname.match(/^\/coiffeur\/(?:[^/]*-)?(\d+)\/$/);
  if (m) {
    const pros = await loadPros('publish');
    const p = pros.find((x) => x.id === +m[1]);
    if (p) {
      const canon = new URL(proUrl(p)).pathname;
      if (canon !== pathname) return go(canon);
      const [reviews, busy] = await Promise.all([loadReviews(pros.map((x) => x.id)), loadBusy([p.id])]);
      sb.rpc('cm_view', { p_pro: p.id }).then(() => {});
      const r = P.pro({ p, reviews, busy, s, pros });
      return page('cm-public cm-public--pro' + loggedClass, r.html, `${r.title} – Coiff'Match`, { desc: r.desc, scripts: ['/cm/lightbox.js'], share: true, noindex: p.is_example, ogImage: (p.photos || [])[0] ? p.photos[0].url : '' });
    }
  }
  m = pathname.match(/^\/coiffeurs\/([a-z]+)\/(?:([a-z0-9-]+)\/)?$/);
  if (m && HAIR[m[1]]) {
    const pros = await loadPros('publish');
    const [reviews, busy] = await Promise.all([loadReviews(pros.map((x) => x.id)), loadBusy(pros.map((x) => x.id))]);
    const r = P.land({ pros, reviews, busy, s, hair: m[1], city: m[2] || '' });
    if (r) return page('cm-public cm-public--land' + loggedClass, r.html, `${r.title} – Coiff'Match`, { desc: r.desc });
  }
  return Object.assign(out, { bodyClass: 'error404 ' + out.bodyClass + loggedClass, html: P.STATIC.notfound, title: "Page introuvable – Coiff'Match" });
}

/* ---------------- Formulaires (connexion, inscription, compte, contact) ---------------- */
function bindForms(ctx) {
  const target = (type, redirect) => {
    if (redirect && redirect.startsWith(location.origin)) redirect = redirect.slice(location.origin.length);
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) return redirect;
    return type === 'coiffeur' ? '/espace-coiffeur/' : type === 'team' ? '/equipe/' : '/trouver-un-coiffeur/';
  };
  const fail = (code) => {
    const u = new URL(location.href);
    u.searchParams.set('cm_err', code);
    u.searchParams.delete('cm_deleted');
    return go(u.pathname + u.search);
  };
  document.querySelectorAll('form[data-cm-login]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.log.value.trim(), password: f.pwd.value });
    if (error) return fail('login');
    resetSessionCache();
    const prof = await myProfile();
    const role = prof ? prof.role : 'client';
    go(target(f.dataset.type === 'team' ? 'team' : role === 'admin' ? 'team' : role, f.redirect ? f.redirect.value : ''));
  }));
  document.querySelectorAll('form[data-cm-register]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (f.website.value) return;
    const first = f.first_name.value.trim(), email = f.email.value.trim(), pw = f.password.value;
    if (!first || !email || !pw) return fail('fields');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('email');
    if (pw.length < 8) return fail('pass');
    if (!f.terms.checked) return fail('terms');
    f.querySelector('button[type=submit]').disabled = true;
    let ref = '';
    try {
      const r = JSON.parse(localStorage.getItem('cm_parrain') || 'null');
      if (r && Date.now() - r.t < 30 * 864e5) ref = r.code;
    } catch {
      /* rien */
    }
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { first_name: first, role: f.dataset.type, ref }, emailRedirectTo: location.origin + '/mon-compte/?cm_ok=1' } });
    if (error) {
      const msg = /already/i.test(error.message) ? `Un compte existe déjà avec cet e-mail. Connectez-vous, ou utilisez une autre adresse pour un compte ${f.dataset.type === 'coiffeur' ? 'coiffeur' : 'client'}.` : /password/i.test(error.message) ? P.AUTH_ERRORS.pass : P.AUTH_ERRORS.error;
      const box = f.closest('.cm-account');
      box.querySelectorAll('.cm-notice').forEach((n) => n.remove());
      box.querySelector('.cm-account__grid').insertAdjacentHTML('beforebegin', notice(msg));
      f.querySelector('button[type=submit]').disabled = false;
      return;
    }
    try {
      localStorage.removeItem('cm_parrain');
    } catch {
      /* rien */
    }
    if (!data.session) {
      const box = f.closest('.cm-account');
      box.querySelectorAll('.cm-notice').forEach((n) => n.remove());
      box.querySelector('.cm-account__grid').insertAdjacentHTML('beforebegin', notice(`Compte créé. Ouvrez l'e-mail envoyé à ${email} et cliquez sur le lien pour l'activer.`, 'ok'));
      return;
    }
    const back = f.redirect ? f.redirect.value : '';
    go(back ? target(f.dataset.type, back) : f.dataset.type === 'coiffeur' ? '/espace-coiffeur/' : '/mon-compte/?cm_ok=1');
  }));
  document.querySelectorAll('form[data-cm-lost]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + '/mot-de-passe/?nouveau=1' });
    go('/mot-de-passe/?envoye=1');
  }));
  document.querySelectorAll('form[data-cm-newpass]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (f.password.value.length < 8) return alertIn(f, P.AUTH_ERRORS.pass);
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    if (error) return alertIn(f, "Le lien a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ».");
    go('/mon-compte/');
  }));
  document.querySelectorAll('form[data-cm-prefs]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await sb.from('profiles').update({ followup: f.followup.checked }).eq('id', ctx.user.id);
    go('/mon-compte/?cm_prefs=1#rappels');
  }));
  document.querySelectorAll('form[data-cm-delete]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!f.confirm.checked) return go('/mon-compte/?cm_del=confirm');
    const { error } = await sb.auth.signInWithPassword({ email: ctx.profile.email, password: f.password.value });
    if (error) return go('/mon-compte/?cm_del=pass');
    const r = await sb.rpc('cm_delete_account');
    if (r.error) return go('/mon-compte/?cm_del=' + encodeURIComponent(r.error.message));
    await sb.auth.signOut();
    go('/connexion/?cm_deleted=1');
  }));
  document.querySelectorAll('form[data-cm-contact]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (f.website.value) return go('/contact/?cm_sent=1');
    const r = await sb.rpc('cm_contact', { p_name: f.name.value, p_email: f.email.value, p_subject: '', p_body: f.message.value });
    if (r.error) return go('/contact/?cm_err=' + encodeURIComponent(r.error.message));
    go('/contact/?cm_sent=1');
  }));
  document.querySelectorAll('[data-cm-copy]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.cmCopy;
    const done = () => {
      b.textContent = 'Lien copié';
      setTimeout(() => (b.textContent = 'Copier le lien'), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => b.previousElementSibling.select());
    else b.previousElementSibling.select();
  }));
  document.querySelectorAll('.cm-pub-share').forEach((b) => b.addEventListener('click', () => {
    const url = b.getAttribute('data-url');
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => (b.textContent = 'Lien copié'), () => window.prompt('Copiez ce lien :', url));
  }));
}
function alertIn(f, msg) {
  f.querySelectorAll('.cm-notice').forEach((n) => n.remove());
  f.insertAdjacentHTML('afterbegin', notice(msg));
}

/* ---------------- Page ---------------- */
function Page({ ctx, r }) {
  useEffect(() => {
    bindForms(ctx);
    (async () => {
      if (r.config) window.CM_CONFIG = r.config;
      for (const src of r.scripts) await script(src);
      await script('/cm/strands.js');
      await script('/cm/nav.js');
      window.CM_PWA = { sw: '/sw.js' };
      await script('/cm/pwa.js');
      if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: P.header(ctx) }} style={{ display: 'contents' }} />
      <main id="contenu" className="site-main" dangerouslySetInnerHTML={{ __html: r.html }} />
      <div dangerouslySetInnerHTML={{ __html: P.footer() }} style={{ display: 'contents' }} />
    </>
  );
}

async function boot() {
  const root = document.getElementById('root');
  if (!configured) {
    root.innerHTML = '<div style="font:16px system-ui;padding:40px;max-width:640px">Le site n\'est pas encore relié à Supabase : ajoutez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans les réglages Vercel (Environment Variables), puis redéployez.</div>';
    return;
  }
  installApi();
  const user = await currentUser();
  const profile = user ? await myProfile() : null;
  let myPro = null;
  if (profile && profile.role === 'coiffeur') myPro = (await sb.from('pros').select('id, status, slug').eq('owner', user.id).eq('is_example', false).limit(1).maybeSingle()).data;
  const ctx = { user, profile: user ? profile || { role: 'client', email: user.email, first_name: '' } : null, myPro };
  let r;
  try {
    r = await resolve(ctx);
  } catch (e) {
    console.error(e);
    r = { bodyClass: 'error404', html: `<header class="band"><div class="wrap band__inner"><h1 class="band__title">Un souci technique</h1><p class="band__lead">${esc(e.message || 'Réessayez dans un instant.')}</p></div></header>`, title: "Coiff'Match", scripts: [] };
  }
  await css([...CSS, ...(r.app ? ['/cm/app.css'] : []), '/cm/theme.css']);
  document.body.className = r.bodyClass;
  document.title = r.title || "Coiff'Match";
  meta('description', r.desc);
  meta('og:description', r.desc, true);
  meta('og:title', document.title, true);
  if (r.ogImage) meta('og:image', r.ogImage, true);
  if (r.noindex) meta('robots', 'noindex');
  r.scripts = r.scripts || [];
  root.remove();
  const holder = document.createElement('div');
  holder.style.display = 'contents';
  document.body.prepend(holder);
  // Sans StrictMode : les scripts d'origine ne doivent être chargés qu'une fois.
  createRoot(holder).render(<Page ctx={ctx} r={r} />);
}
boot();
