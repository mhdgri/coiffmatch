// « Serveur » de l'application : répond aux mêmes adresses que l'API WordPress coiffmatch/v1,
// avec les mêmes réponses, mais à partir de Supabase. Le script d'origine (app.js, team.js) n'a pas changé.
import {
  ApiError, availability, check, currentUser, forgetProfile, isPast, loadBusy, loadPros, loadReviews, myProfile, nextSlot, pageUrl,
  proUrl, publicData, ratingOf, sb, settings, staffOf, week, hoursFor, orderPresta,
} from './db';
import {
  HAIR, LENGTHS, MONTH_NAMES, addDays, cleanHairProfile, dateLabel, fmtDay, fmtDayTime, fmtShort, gcalUrl, hairProfileText, isoOf,
  minutes, nowMs, parisDayOf, slotMs, todayKey,
} from './util';

const API = '/__cm/';
const err = (m, status = 400, code = 'cm_error') => {
  throw new ApiError(m, status, code);
};
async function uid() {
  const u = await currentUser();
  if (!u) err('Connectez-vous pour continuer.', 401, 'cm_login');
  return u.id;
}
const firstName = (p) => (p && (p.first_name || (p.email || '').split('@')[0])) || 'Utilisateur';

/* ---------- Photos ---------- */
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
function checkImage(f) {
  if (!f || typeof f === 'string') err('Aucune photo reçue.');
  if (f.size > 6 * 1024 * 1024) err('Photo trop lourde (6 Mo maximum).');
  if (!IMG_TYPES.includes(f.type)) err('Formats acceptés : JPG, PNG ou WebP.');
}
async function upload(bucket, f, prefix = '') {
  const id = await uid();
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f.type] || 'jpg';
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const path = `${id}/${prefix}${rand}.${ext}`;
  check(await sb.storage.from(bucket).upload(path, f, { contentType: f.type, upsert: false }));
  return path;
}
const publicPhoto = (path) => sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
async function signed(paths) {
  if (!paths.length) return {};
  const r = await sb.storage.from('cheveux').createSignedUrls(paths, 3600);
  const out = {};
  (r.data || []).forEach((x) => {
    if (x.signedUrl) out[x.path] = x.signedUrl;
  });
  return out;
}

/* ---------- Rendez-vous : format envoyé à l'application ---------- */
async function formatBookings(rows, forWho) {
  if (!rows.length) return [];
  const s = await settings();
  const proIds = [...new Set(rows.map((b) => b.pro_id))];
  const pros = check(await sb.from('pros').select('id, name, mode, address, place').in('id', proIds)) || [];
  const reviewed = new Set((check(await sb.from('reviews').select('booking_id').in('booking_id', rows.map((b) => b.id))) || []).map((r) => r.booking_id));
  const urls = await signed(rows.flatMap((b) => (b.photos || []).map((x) => x.path)));
  const token = ((await sb.auth.getSession()).data.session || {}).access_token || '';
  return rows.map((b) => {
    const pro = pros.find((p) => p.id === b.pro_id);
    const past = isPast(b);
    const active = ['pending', 'confirmed'].includes(b.status);
    const mode = pro ? pro.mode : 'salon';
    const paddr = pro && mode === 'salon' ? pro.address || '' : '';
    const place = pro ? pro.place || '' : '';
    const extra = {};
    if (forWho === 'pro' && active) {
      extra.phone = b.phone;
      extra.address = b.address;
      extra.hairProfile = hairProfileText(b.hair_profile);
    }
    extra.photos = (b.photos || []).map((x) => urls[x.path]).filter(Boolean);
    if (forWho === 'client' && active && !past) {
      const where = mode === 'domicile' ? b.address : paddr || place;
      extra.gcal = gcalUrl(b.label + ' – ' + (pro ? pro.name : "Coiff'Match"), b.slot_date, b.slot_hour, b.dur, where, "Rendez-vous réservé sur Coiff'Match : " + pageUrl('trouver-un-coiffeur', { tab: 'mine' }));
      extra.ics = `/api/ics?id=${b.id}&a=${encodeURIComponent(token)}`;
    }
    const freeCancel = slotMs(b.slot_date, b.slot_hour) > nowMs() + s.cancel_hours * 36e5;
    return {
      ...extra,
      id: b.id, proId: b.pro_id, proName: pro ? pro.name : 'Coiffeur', proMode: mode, proPlace: place, proAddress: paddr,
      travel: b.travel, total: b.price + b.travel, clientId: b.client_id, firstName: b.first_name, label: b.label, staffName: b.staff_name || '',
      length: b.hair_length || '', lengthLabel: b.hair_length && LENGTHS[b.hair_length] ? 'cheveux ' + LENGTHS[b.hair_length].toLowerCase() : '',
      prestaK: b.presta_k, hair: b.hair, price: b.price, dur: b.dur, date: b.slot_date, dateLabel: dateLabel(b.slot_date), hour: b.slot_hour,
      status: b.status, past, canCancel: active && !past, freeCancel, canReview: forWho === 'client' && b.status === 'confirmed' && past && !reviewed.has(b.id),
      reviewed: reviewed.has(b.id),
    };
  });
}

/* ---------- Routes publiques ---------- */
async function routePros(q) {
  const s = await settings();
  const me = await myProfile();
  const favs = me ? (me.favs || []).map(Number) : [];
  const hair = q.get('hair') || '', service = q.get('service') || '', where = q.get('where') || '';
  const city = (q.get('city') || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const sort = q.get('sort') || '', verified = !!q.get('verified') && q.get('verified') !== 'false';
  const fav = !!q.get('fav') && q.get('fav') !== 'false', avail = q.get('avail') === 'tomorrow';
  const maxprice = +q.get('maxprice') || 0, skill = q.get('skill') || '';
  const pros = await loadPros('publish');
  const [reviews, busy] = await Promise.all([loadReviews(pros.map((p) => p.id)), loadBusy(pros.map((p) => p.id))]);
  const out = [];
  for (const p of pros) {
    const d = publicData(p, reviews);
    if (hair && !d.hair.includes(hair)) continue;
    if (skill && !d.skills.includes(skill)) continue;
    const ps = d.presta.filter((x) => !service || x.service === service);
    if (!ps.length) continue;
    if ((where === 'salon' || where === 'domicile') && d.mode !== where) continue;
    if (city) {
      const hay = [d.place, ...d.zones, d.address].join(' | ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (!hay.includes(city)) continue;
    }
    const prices = ps.map((x) => +x.price), durs = ps.map((x) => +x.dur);
    if (maxprice && Math.min(...prices) > maxprice) continue;
    const next = nextSlot(p, busy, s, Math.min(...durs));
    if (avail && (!next || next.dayIndex !== 0)) continue;
    if (verified && !d.verified) continue;
    if (fav && !favs.includes(d.id)) continue;
    const cheapest = ps.reduce((a, b) => (+b.price < +a.price ? b : a));
    d.nextPresta = cheapest.k;
    d.next = next;
    d.minPrice = Math.min(...prices);
    d.fav = favs.includes(d.id);
    delete d.presta;
    out.push(d);
  }
  out.sort((a, b) => {
    if (sort === 'price') return a.minPrice - b.minPrice;
    if (sort === 'new') return b.created.localeCompare(a.created);
    if (sort === 'soon') {
      const ka = a.next ? a.next.date + ' ' + a.next.hour.padStart(5, '0') : '9999';
      const kb = b.next ? b.next.date + ' ' + b.next.hour.padStart(5, '0') : '9999';
      return ka.localeCompare(kb);
    }
    const ra = a.rating.avg || 0, rb = b.rating.avg || 0;
    return ra !== rb ? rb - ra : b.rating.n - a.rating.n;
  });
  if (!out.length && !fav && !q.get('pre')) sb.rpc('cm_missed', { p_hair: hair, p_city: city }).then(() => {});
  return { pros: out, total: out.length };
}

export async function proFull(id, opts = {}) {
  const s = await settings();
  const p = check(await sb.from('pros').select('*').eq('id', id).maybeSingle());
  if (!p) err('Coiffeur introuvable.', 404, 'cm_404');
  const u = await currentUser();
  const me = await myProfile();
  const [reviews, busy] = await Promise.all([loadReviews([p.id]), loadBusy([p.id])]);
  if (!opts.pre) sb.rpc('cm_view', { p_pro: p.id }).then(() => {});
  const visible = reviews.filter((r) => !r.hidden);
  const d = publicData(p, reviews, {
    bio: p.bio || '',
    diploma: p.diploma || '',
    reviews: visible.slice(0, 30).map((r) => ({ id: r.id, rating: r.rating, body: r.body, reply: r.reply || '', firstName: r.first_name, hair: r.hair, photo: r.photo || '', date: fmtDay(r.created) })),
    days: availability(p, busy, s),
  });
  const staff = staffOf(p);
  if (staff.length) {
    d.staffDays = {};
    for (const m of staff) d.staffDays[m.k] = availability(p, busy, s, m.k);
  }
  d.fav = me ? (me.favs || []).map(Number).includes(p.id) : false;
  d.isMine = !!u && p.owner === u.id && !p.is_example;
  const stats = {};
  for (const r of visible) {
    if (!r.hair) continue;
    stats[r.hair] = stats[r.hair] || { n: 0, sum: 0 };
    stats[r.hair].n++;
    stats[r.hair].sum += r.rating;
  }
  d.hairStats = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { n: v.n, avg: Math.round((v.sum / v.n) * 10) / 10 }]));
  d.status = p.status;
  return d;
}

async function routeMe() {
  const u = await currentUser();
  if (!u) return { loggedIn: false };
  sb.rpc('cm_tick').then(() => {});
  const p = (await myProfile()) || {};
  const owned = check(await sb.from('pros').select('id, status, is_example').eq('owner', u.id)) || [];
  const mine = owned.find((x) => !x.is_example);
  const ownedIds = owned.map((x) => x.id);
  let pending = 0;
  if (ownedIds.length) {
    const r = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('pro_id', ownedIds);
    pending = r.count || 0;
  }
  const r2 = await sb.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', u.id);
  return {
    loggedIn: true, id: u.id, firstName: firstName(p), isPro: !!mine || p.role === 'coiffeur', proId: mine ? mine.id : 0, proStatus: mine ? mine.status : '',
    favs: (p.favs || []).map(Number), pending, unread: r2.count || 0, isAdmin: p.role === 'admin', role: p.role === 'admin' ? 'admin' : p.role === 'coiffeur' ? 'coiffeur' : 'client',
    phone: p.phone || '', hairProfile: cleanHairProfile(p.hair || {}), address: p.address || '',
  };
}

/* ---------- Messagerie ---------- */
async function threads() {
  const me = await uid();
  const owned = (check(await sb.from('pros').select('id').eq('owner', me)) || []).map((x) => x.id);
  const rows = check(await sb.from('messages').select('*').order('id', { ascending: false }).limit(2000)) || [];
  const seen = new Map();
  for (const m of rows) {
    const k = m.pro_id + '|' + m.client_id;
    if (!seen.has(k)) seen.set(k, { last: m, unread: 0 });
    if (m.sender_id !== me && !m.read_at) seen.get(k).unread++;
  }
  const items = [...seen.values()].slice(0, 100);
  const proNames = Object.fromEntries((check(await sb.from('pros').select('id, name').in('id', [...new Set(items.map((x) => x.last.pro_id))])) || []).map((x) => [x.id, x.name]));
  const names = await clientNames(items.map((x) => x.last.client_id), owned);
  return items.map(({ last, unread }) => {
    const asPro = owned.includes(last.pro_id) && last.client_id !== me;
    return { proId: last.pro_id, clientId: last.client_id, asPro, title: asPro ? names[last.client_id] || 'Cliente' : proNames[last.pro_id] || 'Coiffeur', last: last.body.slice(0, 80), lastMine: last.sender_id === me, unread, date: fmtShort(last.created) };
  });
}
/** Prénoms des clientes connues du coiffeur (pris sur leurs rendez-vous). */
async function clientNames(ids, owned) {
  ids = [...new Set(ids)];
  if (!ids.length || !owned.length) return {};
  const rows = check(await sb.from('bookings').select('client_id, first_name, created').in('client_id', ids).in('pro_id', owned).order('created', { ascending: false })) || [];
  const out = {};
  for (const r of rows) if (!out[r.client_id]) out[r.client_id] = r.first_name;
  return out;
}
async function thread(pro, client, mark = true) {
  const me = await uid();
  if (mark) check(await sb.rpc('cm_thread_read', { p_pro: +pro, p_client: client }));
  const p = check(await sb.from('pros').select('id, name, owner').eq('id', pro).maybeSingle());
  if (!p || !(client === me || p.owner === me)) err('Conversation introuvable.', 403, 'cm_403');
  const rows = check(await sb.from('messages').select('*').eq('pro_id', pro).eq('client_id', client).order('id').limit(300)) || [];
  const asPro = p.owner === me && client !== me;
  let title = p.name;
  if (asPro) title = (await clientNames([client], [p.id]))[client] || 'Cliente';
  return { proId: +pro, clientId: client, title, messages: rows.map((m) => ({ id: m.id, mine: m.sender_id === me, body: m.body, date: fmtShort(m.created) })) };
}

/* ---------- Espace coiffeur ---------- */
async function icalUrls(proId) {
  const r = check(await sb.from('pro_private').select('ical_token').eq('pro_id', proId).maybeSingle());
  if (!r) return null;
  const https = `${location.origin}/api/ical?t=${r.ical_token}`;
  const webcal = https.replace(/^https?:\/\//, 'webcal://');
  return { url: https, webcal, google: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal) };
}

async function proSpace() {
  const me = await uid();
  const s = await settings();
  const p = check(await sb.from('pros').select('*').eq('owner', me).eq('is_example', false).order('id').limit(1).maybeSingle());
  const data = { profile: null, requests: [], agenda: [], reviews: [], stats: { upcoming: 0, done: 0, rating: null, reviews: 0 } };
  if (!p) return data;
  data.profile = {
    id: p.id, status: p.status, name: p.name, mode: p.mode, place: p.place, bio: p.bio, hair: p.hair || [], tags: p.tags || [], skills: p.skills || [],
    staff: p.staff || [], diploma: p.diploma, verified: p.verified, refused: p.refused || '', presta: orderPresta(p.presta), week: week(p), off: p.off || [],
    photos: (p.photos || []).map((x) => ({ id: x.id, url: x.url, tag: x.tag || '' })), address: p.address, zones: p.zones || [], travel: p.travel,
    shareUrl: proUrl(p), ical: await icalUrls(p.id),
  };
  const today = todayKey();
  const all = check(await sb.from('bookings').select('*').eq('pro_id', p.id).order('slot_date').order('slot_hour')) || [];
  const byTime = (a, b) => (a.slot_date + a.slot_hour.padStart(5, '0')).localeCompare(b.slot_date + b.slot_hour.padStart(5, '0'));
  const req = all.filter((b) => b.status === 'pending' && b.slot_date >= today).sort(byTime);
  const ag = all.filter((b) => b.status === 'confirmed' && b.slot_date >= today).sort(byTime).slice(0, 50);
  data.requests = (await formatBookings(req, 'pro')).filter((b) => !b.past);
  data.agenda = (await formatBookings(ag, 'pro')).filter((b) => !b.past);
  const revs = await loadReviews([p.id]);
  data.reviews = revs.slice(0, 50).map((v) => ({ id: v.id, rating: v.rating, body: v.body, reply: v.reply || '', firstName: v.first_name, hair: v.hair, date: fmtDay(v.created) }));
  // Semaine à venir
  data.week = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    data.week.push({
      date, dow: new Date(Date.parse(date + 'T12:00:00Z')).getUTCDay(), day: +date.slice(8), label: dateLabel(date), hours: hoursFor(p, date),
      items: all.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.slot_date === date).sort(byTime)
        .map((b) => ({ id: b.id, hour: b.slot_hour, m: minutes(b.slot_hour), dur: b.dur, label: b.label, firstName: b.first_name, status: b.status })),
    });
  }
  // Chiffres du mois et fidélité
  const month = today.slice(0, 7);
  const conf = all.filter((b) => b.status === 'confirmed' && b.slot_date.startsWith(month));
  const since = addDays(today, -90);
  const recent = all.filter((b) => b.slot_date >= since && ['confirmed', 'cancelled'].includes(b.status));
  const cancelled = recent.filter((b) => b.status === 'cancelled').length;
  const clients = new Map();
  const cRows = all.filter((b) => b.client_id && ['pending', 'confirmed'].includes(b.status)).sort((a, b) => byTime(b, a));
  for (const b of cRows) {
    if (!clients.has(b.client_id)) clients.set(b.client_id, { id: b.client_id, firstName: b.first_name, hair: b.hair, hairProfile: hairProfileText(b.hair_profile), phone: b.phone, visits: 0, spent: 0, last: '', next: '', note: '' });
    const c = clients.get(b.client_id);
    const past = b.slot_date < today;
    if (b.status === 'confirmed' && past) {
      c.visits++;
      c.spent += b.price + b.travel;
      if (!c.last) c.last = dateLabel(b.slot_date);
    } else if (!past) c.next = dateLabel(b.slot_date) + ' à ' + b.slot_hour;
  }
  if (clients.size) {
    for (const n of check(await sb.from('notes').select('client_id, note').eq('pro_id', p.id)) || []) if (clients.has(n.client_id)) clients.get(n.client_id).note = n.note;
  }
  data.clients = [...clients.values()];
  const rating = ratingOf(revs, p.id);
  data.month = {
    label: MONTH_NAMES[+today.slice(5, 7) - 1], rdv: conf.length, revenue: conf.reduce((a, b) => a + b.price + b.travel, 0),
    cancelRate: recent.length ? Math.round((100 * cancelled) / recent.length) : 0, loyal: data.clients.filter((c) => c.visits >= 2).length, clients: data.clients.length,
  };
  data.stats = { upcoming: data.agenda.length, done: all.filter((b) => b.status === 'confirmed' && b.slot_date < today).length, rating: rating.avg, reviews: rating.n };
  // Fréquentation du profil
  const priv = check(await sb.from('pro_private').select('views').eq('pro_id', p.id).maybeSingle()) || { views: {} };
  const v = priv.views || {};
  const from = addDays(today, -29), prev = addDays(today, -59);
  let views = 0, pv = 0;
  for (const [d, n] of Object.entries(v)) {
    if (d >= from) views += +n;
    else if (d >= prev) pv += +n;
  }
  const reqs = all.filter((b) => parisDayOf(b.created) >= from).length;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const k = addDays(today, -i);
    days.push({ date: k, label: String(+k.slice(8)), n: +(v[k] || 0) });
  }
  data.audience = { views, prev: pv, requests: reqs, rate: views ? Math.round((100 * Math.min(reqs, views)) / views) : null, days };
  const w = await sb.from('waitlist').select('id', { count: 'exact', head: true }).eq('pro_id', p.id).gte('slot_date', today).eq('notified', false);
  data.waiting = w.count || 0;
  void s;
  return data;
}

/** Position sur la carte (Base Adresse Nationale), comme CM_Geo. */
async function geocode(q, street) {
  q = String(q || '').trim();
  if (q.length < 3) return null;
  try {
    const u = 'https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&limit=1' + (street ? '' : '&type=municipality');
    const r = await fetch(u);
    const j = await r.json();
    const c = j.features && j.features[0] && j.features[0].geometry.coordinates;
    if (c) return [Math.round(c[1] * 1e5) / 1e5, Math.round(c[0] * 1e5) / 1e5];
    if (street) return geocode(q, false);
    const m = q.normalize('NFD').replace(/[̀-ͯ]/g, '').match(/^(paris|lyon|marseille)\s+(\d{1,2})/i);
    if (m) {
      const cp = { paris: '750', lyon: '6900', marseille: '130' }[m[1].toLowerCase()] + m[2].padStart(2, '0');
      const j2 = await (await fetch('https://api-adresse.data.gouv.fr/search/?q=' + m[1] + '&postcode=' + cp + '&limit=1')).json();
      const c2 = j2.features && j2.features[0] && j2.features[0].geometry.coordinates;
      if (c2) return [Math.round(c2[1] * 1e5) / 1e5, Math.round(c2[0] * 1e5) / 1e5];
    }
  } catch {
    /* hors ligne : pas de position */
  }
  return null;
}

/* ---------- Espace équipe ---------- */
async function team(path, method, q, body) {
  const me = await myProfile();
  if (!me || me.role !== 'admin') err("Réservé à l'équipe.", 403, 'cm_team');
  const today = todayKey();
  if (path === 'overview') {
    const since = Date.now() - 30 * 864e5, prev = Date.now() - 60 * 864e5;
    const bks = check(await sb.from('bookings').select('*').gte('created', new Date(prev).toISOString()).order('created', { ascending: false })) || [];
    const cur = bks.filter((b) => Date.parse(b.created) >= since);
    const by = {};
    cur.forEach((b) => (by[b.status] = (by[b.status] || 0) + 1));
    const pros = check(await sb.from('pros').select('id, name, status, diploma, verified, is_example')) || [];
    const profiles = check(await sb.from('profiles').select('id, first_name, role, created_at').order('created_at', { ascending: false })) || [];
    const reports = await sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const k = addDays(today, -i);
      days.push({ date: k, label: String(+k.slice(8)), n: cur.filter((b) => parisDayOf(b.created) === k).length });
    }
    const name = (id) => (pros.find((p) => p.id === id) || {}).name || 'Coiffeur';
    const recent = [
      ...bks.slice(0, 6).map((b) => ({ type: 'booking', when: fmtShort(b.created), text: `${b.first_name} a réservé chez ${name(b.pro_id)} (${b.label})`, status: b.status, ts: Date.parse(b.created) })),
      ...profiles.filter((p) => p.role !== 'admin').slice(0, 6).map((u) => ({ type: u.role === 'coiffeur' ? 'coiffeur' : 'client', when: fmtShort(u.created_at), text: `${u.first_name || 'Quelqu’un'} a créé un compte ${u.role === 'coiffeur' ? 'coiffeur' : 'client'}`, ts: Date.parse(u.created_at) })),
    ].sort((a, b) => b.ts - a.ts);
    const missed = check(await sb.from('missed_searches').select('*').gte('last', new Date(since).toISOString()).order('n', { ascending: false }).limit(8)) || [];
    const value = cur.filter((b) => b.status === 'confirmed').reduce((a, b) => a + b.price + b.travel, 0);
    const total = cur.length;
    return {
      todo: {
        pending: pros.filter((p) => p.status === 'pending').length, reports: reports.count || 0,
        toVerify: pros.filter((p) => p.status === 'publish' && p.diploma && !p.verified && !p.is_example).length,
      },
      kpi: {
        bookings: total, bookingsPrev: bks.length - total, confirmed: by.confirmed || 0, cancelRate: total ? Math.round((100 * ((by.cancelled || 0) + (by.expired || 0))) / total) : 0,
        value, clients: profiles.filter((p) => p.role === 'client').length, clientsNew: profiles.filter((p) => p.role === 'client' && Date.parse(p.created_at) >= since).length,
        pros: pros.filter((p) => p.status === 'publish').length, prosNew: profiles.filter((p) => p.role === 'coiffeur' && Date.parse(p.created_at) >= since).length,
      },
      days,
      missed: missed.map((m) => ({ hair: HAIR[m.hair] || 'Tous types', city: m.city ? m.city.charAt(0).toUpperCase() + m.city.slice(1) : 'Toutes villes', n: m.n })),
      referrals: check(await sb.rpc('cm_ref_top', { n: 8 })) || [],
      reward: (await settings()).ref_reward || '',
      recent: recent.slice(0, 8),
    };
  }
  if (path === 'pros' && method === 'GET') {
    const status = ['pending', 'publish', 'draft'].includes(q.get('status')) ? q.get('status') : 'pending';
    const qq = (q.get('q') || '').toLowerCase();
    const all = check(await sb.from('pros').select('*').order('created_at', { ascending: status === 'pending' })) || [];
    const owners = check(await sb.from('profiles').select('id, email')) || [];
    const reviews = await loadReviews(all.map((p) => p.id));
    const list = all.filter((p) => p.status === status && (!qq || (p.name + ' ' + p.place + ' ' + p.bio).toLowerCase().includes(qq))).slice(0, 100).map((p) => {
      const d = publicData(p, reviews);
      d.bio = p.bio || '';
      d.diploma = p.diploma || '';
      d.email = (owners.find((o) => o.id === p.owner) || {}).email || '';
      d.submitted = fmtDay(p.created_at);
      d.status = p.status;
      d.refused = p.refused || '';
      d.presta = p.presta || [];
      d.checks = { photos: d.photos.length >= 3, presta: d.presta.length >= 1, bio: d.bio.length >= 40, diploma: d.diploma !== '', address: d.mode === 'domicile' ? d.zones.length > 0 : d.address !== '' };
      return d;
    });
    const c = (st) => all.filter((p) => p.status === st).length;
    return { pros: list, counts: { pending: c('pending'), publish: c('publish'), draft: c('draft') } };
  }
  let m;
  if ((m = path.match(/^pros\/(\d+)$/))) return { ok: true, message: check(await sb.rpc('cm_team_pro', { p_id: +m[1], p_do: body.do || '', p_reason: body.reason || '' })) };
  if (path === 'reports' && method === 'GET') {
    const status = q.get('status') === 'done' ? 'done' : 'open';
    const rows = check(await sb.from('reports').select('*').eq('status', status).order('created', { ascending: false }).limit(100)) || [];
    const pros = check(await sb.from('pros').select('id, name, slug')) || [];
    const people = check(await sb.from('profiles').select('id, first_name, email')) || [];
    const revs = rows.some((x) => x.type === 'review') ? check(await sb.from('reviews').select('*').in('id', rows.filter((x) => x.type === 'review').map((x) => x.target_id))) || [] : [];
    const open = await sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    return {
      reports: rows.map((x) => {
        const by = people.find((u) => u.id === x.reporter_id);
        const p = pros.find((y) => y.id === x.pro_id) || {};
        const item = { id: x.id, type: x.type, reason: x.reason, date: fmtDayTime(x.created), by: by ? `${by.first_name} (${by.email})` : '—', proId: x.pro_id, proName: p.name || '', proUrl: p.id ? proUrl(p) : '' };
        if (x.type === 'review') {
          const rv = revs.find((v) => v.id === x.target_id);
          item.review = rv ? { id: rv.id, rating: rv.rating, body: rv.body, firstName: rv.first_name, hidden: rv.hidden } : null;
        }
        return item;
      }),
      open: open.count || 0,
    };
  }
  if ((m = path.match(/^reports\/(\d+)$/))) return { ok: true, message: check(await sb.rpc('cm_team_report', { p_id: +m[1], p_do: body.do || '' })) };
  if (path === 'bookings') {
    const st = q.get('status') || '', qq = (q.get('q') || '').toLowerCase();
    let qy = sb.from('bookings').select('*').order('slot_date', { ascending: false }).order('slot_hour', { ascending: false }).limit(200);
    if (['pending', 'confirmed', 'refused', 'cancelled', 'expired'].includes(st)) qy = qy.eq('status', st);
    const rows = check(await qy) || [];
    const pros = check(await sb.from('pros').select('id, name')) || [];
    const people = check(await sb.from('profiles').select('id, email')) || [];
    const out = rows.map((b) => ({
      id: b.id, date: dateLabel(b.slot_date), day: b.slot_date, hour: b.slot_hour, client: b.first_name, email: (people.find((u) => u.id === b.client_id) || {}).email || '',
      phone: b.phone, pro: (pros.find((p) => p.id === b.pro_id) || {}).name || '', proId: b.pro_id, label: b.label, total: b.price + b.travel, status: b.status, past: isPast(b), created: fmtDayTime(b.created),
    })).filter((i) => !qq || (i.client + ' ' + i.email + ' ' + i.pro + ' ' + i.phone).toLowerCase().includes(qq));
    return { bookings: out.slice(0, 100) };
  }
  if ((m = path.match(/^bookings\/(\d+)\/cancel$/))) return { ok: true, message: check(await sb.rpc('cm_team_cancel', { p_id: +m[1] })) };
  if (path === 'members') {
    const role = q.get('role') === 'coiffeur' ? 'coiffeur' : 'client';
    const rows = check(await sb.rpc('cm_team_members', { p_role: role, p_q: q.get('q') || '' })) || [];
    const bks = check(await sb.from('bookings').select('pro_id, client_id')) || [];
    const pros = check(await sb.from('pros').select('id, name, status, slug, owner').eq('is_example', false)) || [];
    const all = check(await sb.rpc('cm_team_members', { p_role: role, p_q: '' })) || [];
    return {
      members: rows.map((u) => {
        const item = { id: u.id, name: u.first_name || u.email, email: u.email, registered: fmtDay(u.created_at) };
        if (role === 'coiffeur') {
          const p = pros.find((x) => x.owner === u.id);
          Object.assign(item, { proId: p ? p.id : 0, proName: p ? p.name : '', proStatus: p ? p.status : '', proUrl: p && p.status === 'publish' ? proUrl(p) : '', bookings: p ? bks.filter((b) => b.pro_id === p.id).length : 0 });
        } else Object.assign(item, { bookings: bks.filter((b) => b.client_id === u.id).length, hair: hairProfileText(u.hair) });
        return item;
      }),
      total: all.length,
    };
  }
  err('Adresse inconnue.', 404, 'cm_404');
}

/* ---------- Routeur ---------- */
async function handle(path, method, q, body) {
  let m;
  if (path.startsWith('team/')) return team(path.slice(5), method, q, body || {});
  if (path === 'pros') return routePros(q);
  if ((m = path.match(/^pros\/(\d+)\/view$/))) {
    await sb.rpc('cm_view', { p_pro: +m[1] });
    return { ok: true };
  }
  if ((m = path.match(/^pros\/(\d+)$/))) return proFull(+m[1], { pre: !!q.get('pre') });
  if (path === 'me') return routeMe();
  if (path === 'me/bookings') {
    const me = await uid();
    const rows = check(await sb.from('bookings').select('*').eq('client_id', me).neq('status', 'cancelled').order('slot_date', { ascending: false }).order('slot_hour', { ascending: false }).limit(100)) || [];
    return formatBookings(rows, 'client');
  }
  if (path === 'me/hair') {
    await uid();
    const p = cleanHairProfile(body || {});
    const u = await currentUser();
    check(await sb.from('profiles').update({ hair: p }).eq('id', u.id));
    forgetProfile();
    return { hairProfile: p, text: hairProfileText(p) };
  }
  if ((m = path.match(/^pro\/clients\/([0-9a-f-]+)\/note$/))) return { ok: true, note: check(await sb.rpc('cm_note', { p_client: m[1], p_note: (body && body.note) || '' })) };
  if (path === 'bookings' && method === 'POST') {
    const id = check(await sb.rpc('cm_book', { p: { ...body, photos: (body.photos || []).map((x) => ({ path: String(x) })) } }));
    const row = check(await sb.from('bookings').select('*').eq('id', id).single());
    return (await formatBookings([row], 'client'))[0];
  }
  if (path === 'booking-photos' && method === 'POST') {
    const f = body.get('file');
    checkImage(f);
    const pth = await upload('cheveux', f, 'cheveux-');
    const urls = await signed([pth]);
    return { id: pth, path: pth, url: urls[pth] || '' };
  }
  if ((m = path.match(/^booking-photos\/(.+)$/)) && method === 'DELETE') {
    const pth = decodeURIComponent(m[1]);
    const u = await currentUser();
    if (!u || !pth.startsWith(u.id + '/')) err('Photo introuvable.', 404, 'cm_404');
    await sb.storage.from('cheveux').remove([pth]);
    return { ok: true };
  }
  if ((m = path.match(/^bookings\/(\d+)\/cancel$/))) return check(await sb.rpc('cm_cancel', { p_id: +m[1] }));
  if (path === 'reviews' && method === 'POST') {
    await uid();
    const f = body.get('photo');
    let url = '';
    if (f && typeof f !== 'string' && f.size) {
      checkImage(f);
      url = publicPhoto(await upload('photos', f, 'avis-'));
    }
    check(await sb.rpc('cm_review', { p_booking: +body.get('booking_id'), p_rating: +body.get('rating'), p_body: String(body.get('body') || ''), p_photo: url }));
    return { ok: true };
  }
  if ((m = path.match(/^favs\/(\d+)$/))) {
    const r = check(await sb.rpc('cm_toggle_fav', { p_pro: +m[1] }));
    forgetProfile();
    return { fav: r.fav, favs: (r.favs || []).map(Number) };
  }
  if (path === 'threads') return threads();
  if ((m = path.match(/^threads\/(\d+)\/([0-9a-f-]+)$/))) {
    if (method === 'POST') {
      check(await sb.rpc('cm_send_message', { p_pro: +m[1], p_client: m[2], p_body: (body && body.body) || '' }));
      return thread(m[1], m[2], false);
    }
    return thread(m[1], m[2]);
  }
  if (path === 'reports') {
    check(await sb.rpc('cm_report', { p_type: body.type, p_target: +body.target_id, p_reason: body.reason || '' }));
    return { ok: true };
  }
  if (path === 'pro' && method === 'GET') return proSpace();
  if (path === 'pro' && method === 'POST') {
    const mode = body.mode === 'domicile' ? 'domicile' : 'salon';
    const query = mode === 'salon' && String(body.address || '').trim() ? body.address : body.place;
    const geo = await geocode(query, mode === 'salon' && query !== body.place);
    check(await sb.rpc('cm_pro_save', { p: { ...body, geo } }));
    forgetProfile();
    return proSpace();
  }
  if (path === 'pro/withdraw') {
    check(await sb.rpc('cm_pro_withdraw'));
    return proSpace();
  }
  if (path === 'pro/ical') {
    const me = await uid();
    check(await sb.rpc('cm_ical_reset'));
    const p = check(await sb.from('pros').select('id').eq('owner', me).eq('is_example', false).limit(1).maybeSingle());
    return { ical: await icalUrls(p.id) };
  }
  if (path === 'pro/photos' && method === 'POST') {
    const f = body.get('file');
    checkImage(f);
    const mine = check(await sb.from('pros').select('id, photos').eq('owner', (await currentUser()).id).eq('is_example', false).limit(1).maybeSingle());
    if (!mine) err("Enregistrez d'abord votre profil, puis ajoutez vos photos.");
    if ((mine.photos || []).length >= 12) err('Vous avez atteint le maximum de 12 photos.');
    const pth = await upload('photos', f);
    return { photos: (check(await sb.rpc('cm_pro_photos', { p_action: 'add', p_value: { path: pth, url: publicPhoto(pth) } })) || []).map((x) => ({ id: x.id, url: x.url, tag: x.tag || '' })) };
  }
  if ((m = path.match(/^pro\/photos\/(\d+)\/tag$/))) {
    return { photos: (check(await sb.rpc('cm_pro_photos', { p_action: 'tag', p_value: { id: +m[1], tag: body.tag || '' } })) || []).map((x) => ({ id: x.id, url: x.url, tag: x.tag || '' })) };
  }
  if ((m = path.match(/^pro\/photos\/(\d+)$/)) && method === 'DELETE') {
    const mine = check(await sb.from('pros').select('photos').eq('owner', (await currentUser()).id).eq('is_example', false).limit(1).maybeSingle());
    const ph = mine && (mine.photos || []).find((x) => +x.id === +m[1]);
    const photos = check(await sb.rpc('cm_pro_photos', { p_action: 'delete', p_value: { id: +m[1] } })) || [];
    if (ph && ph.path) sb.storage.from('photos').remove([ph.path]).then(() => {});
    return { photos: photos.map((x) => ({ id: x.id, url: x.url, tag: x.tag || '' })) };
  }
  if ((m = path.match(/^pro\/bookings\/(\d+)$/))) {
    check(await sb.rpc('cm_pro_status', { p_id: +m[1], p_status: (body && body.status) || '' }));
    return proSpace();
  }
  if ((m = path.match(/^pro\/reviews\/(\d+)\/reply$/))) {
    check(await sb.rpc('cm_review_reply', { p_id: +m[1], p_reply: (body && body.reply) || '' }));
    return proSpace();
  }
  if (path === 'waitlist' && method === 'GET') {
    const me = await uid();
    const rows = check(await sb.from('waitlist').select('*, pros(name)').eq('client_id', me).gte('slot_date', todayKey()).order('slot_date')) || [];
    return { items: rows.map((w) => ({ id: w.id, proId: w.pro_id, proName: w.pros ? w.pros.name : '', date: w.slot_date, dateLabel: dateLabel(w.slot_date), notified: w.notified })) };
  }
  if (path === 'waitlist' && method === 'POST') {
    return { ok: true, message: check(await sb.rpc('cm_waitlist_add', { p_pro: +body.pro, p_date: body.date, p_presta: body.presta || '' })) };
  }
  if ((m = path.match(/^waitlist\/(\d+)$/))) {
    check(await sb.rpc('cm_waitlist_remove', { p_id: +m[1] }));
    return { ok: true };
  }
  err('Adresse inconnue.', 404, 'cm_404');
}

/** Intercepte les appels « fetch » de app.js et team.js vers /__cm/… */
export function installApi() {
  if (window.__cmApi) return;
  window.__cmApi = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.href);
    if (u.origin !== location.origin || !u.pathname.startsWith(API)) return real(input, init);
    const path = decodeURI(u.pathname.slice(API.length)).replace(/\/$/, '');
    const method = (init.method || 'GET').toUpperCase();
    let body = init.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    try {
      const data = await handle(path, method, u.searchParams, body);
      return new Response(JSON.stringify(data === undefined ? {} : data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      const status = e.status || 500;
      if (!(e instanceof ApiError)) console.error(e);
      return new Response(JSON.stringify({ code: e.code || 'cm_error', message: e instanceof ApiError || e.message ? e.message : 'Une erreur est survenue. Réessayez.' }), {
        status, headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
export { API };
void isoOf;
