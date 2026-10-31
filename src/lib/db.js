// Connexion à Supabase et lecture des données communes à toutes les pages.
import { createClient } from '@supabase/supabase-js';
import { HAIR, addDays, artUrl, dateLabel, dow, isoOf, minutes, nowMs, slotMs, todayKey, DEFAULT_HOURS } from './util';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = !!(URL && KEY);
export const sb = configured ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export class ApiError extends Error {
  constructor(message, status = 400, code = 'cm_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Erreur Supabase → message en français pour la cliente. */
export function check(res) {
  if (res && res.error) {
    const m = res.error.message || 'Une erreur est survenue. Réessayez.';
    const status = /pris|chevauche/.test(m) ? 409 : /Connectez-vous/.test(m) ? 401 : /introuvable/i.test(m) ? 404 : 400;
    throw new ApiError(m, status, /pris|chevauche/.test(m) ? 'cm_taken' : 'cm_error');
  }
  return res ? res.data : null;
}

let settingsCache = null;
export async function settings() {
  if (!settingsCache) settingsCache = check(await sb.from('settings').select('*').eq('id', 1).maybeSingle()) || {};
  return { payment: 'onsite', deposit: 10, cancel_hours: 24, booking_days: 14, ref_reward: '', ...settingsCache };
}

let sessionCache;
export async function currentUser() {
  if (sessionCache !== undefined) return sessionCache;
  const { data } = await sb.auth.getSession();
  sessionCache = data.session ? data.session.user : null;
  return sessionCache;
}
export function resetSessionCache() {
  sessionCache = undefined;
  profileCache = undefined;
}
let profileCache;
export async function myProfile() {
  if (profileCache !== undefined) return profileCache;
  const u = await currentUser();
  profileCache = u ? check(await sb.from('profiles').select('*').eq('id', u.id).maybeSingle()) : null;
  return profileCache;
}
export function forgetProfile() {
  profileCache = undefined;
}

/* ---------- Coiffeurs ---------- */
export const proUrl = (p) => `${location.origin}/coiffeur/${p.slug || p.id}/`;
export const landUrl = (hair) => `${location.origin}/coiffeurs/${hair}/`;
export const pageUrl = (slug, args) => `${location.origin}/${slug}/` + (args ? '?' + new URLSearchParams(args).toString() : '');

export const week = (p) => (Array.isArray(p.week) && p.week.length === 7 ? p.week : [[], ...Array(6).fill(DEFAULT_HOURS)]);
export const staffOf = (p) => (p.mode === 'domicile' ? [] : Array.isArray(p.staff) ? p.staff : []);

export function hoursFor(p, date, staff = '') {
  if ((p.off || []).includes(date)) return [];
  const d = dow(date);
  if (staff) {
    const m = staffOf(p).find((x) => x.k === staff);
    if (!m || !(m.days || []).map(Number).includes(d)) return [];
  }
  return week(p)[d] || [];
}

/** Disponibilités (de demain jusqu'à « booking_days » jours), comme CM_Pros::availability. */
export function availability(p, busyRows, s, staff = '') {
  const start = addDays(todayKey(), 1);
  const out = [];
  const rows = busyRows.filter((b) => b.pro_id === p.id && (staff ? b.staff === staff : true));
  for (let i = 0; i < s.booking_days; i++) {
    const date = addDays(start, i);
    const b = rows.filter((r) => r.slot_date === date).map((r) => [minutes(r.slot_hour), minutes(r.slot_hour) + Math.max(15, r.dur)]);
    const hours = hoursFor(p, date, staff).map((h) => {
      const m = minutes(h);
      return { h, m, taken: b.some((iv) => m >= iv[0] && m < iv[1]) };
    });
    out.push({ date, label: dateLabel(date), dow: dow(date), day: +date.slice(8), hours, busy: b });
  }
  return out;
}
export const fits = (day, hour, dur) => {
  const m = minutes(hour);
  return !day.busy.some((iv) => m < iv[1] && iv[0] < m + dur);
};

export function nextSlot(p, busyRows, s, dur) {
  const staff = staffOf(p);
  let best = null;
  for (const k of staff.length ? staff.map((m) => m.k) : ['']) {
    const days = availability(p, busyRows, s, k);
    for (let i = 0; i < days.length; i++) {
      if (best && i > best.dayIndex) break;
      const day = days[i];
      for (const h of day.hours) {
        if (fits(day, h.h, dur)) {
          if (!best || i < best.dayIndex || (i === best.dayIndex && h.m < best.m)) {
            const label = i === 0 ? 'demain' : i === 1 ? 'après-demain' : day.label;
            best = { date: day.date, hour: h.h, label: label + ' ' + h.h, dayIndex: i, m: h.m, staff: k };
          }
          break;
        }
      }
    }
  }
  if (best) delete best.m;
  return best;
}

export function ratingOf(reviews, proId) {
  const r = reviews.filter((v) => v.pro_id === proId && !v.hidden);
  return { n: r.length, avg: r.length ? Math.round((r.reduce((a, b) => a + b.rating, 0) / r.length) * 10) / 10 : null };
}

/** Prestations avec le supplément dans l'ordre « mi-longs » puis « longs » (la base range les clés autrement). */
export const orderPresta = (list) => (list || []).map((x) => {
  if (!x.plus) return x;
  const plus = {};
  for (const k of ['mi-long', 'long']) if (x.plus[k] != null) plus[k] = x.plus[k];
  return { ...x, plus };
});

/** Données publiques d'un coiffeur, au format de CM_Pros::public_data. */
export function publicData(p, reviews, extra = {}) {
  const hair = p.hair || [];
  return {
    id: p.id,
    name: p.name,
    mode: p.mode || 'salon',
    place: p.place || '',
    hair,
    tags: p.tags || [],
    skills: p.skills || [],
    staff: staffOf(p).map((m) => ({ k: m.k, name: m.name, presta: m.presta || [] })),
    verified: !!p.verified,
    example: !!p.is_example,
    presta: orderPresta(p.presta),
    rating: ratingOf(reviews, p.id),
    photos: (p.photos || []).map((x) => ({ id: x.id, url: x.url, tag: x.tag || '' })),
    created: isoOf(Date.parse(p.created_at)),
    owner: p.owner,
    zones: p.zones || [],
    travel: p.travel || 0,
    address: (p.mode || 'salon') === 'salon' ? p.address || '' : '',
    geo: Array.isArray(p.geo) && p.geo.length === 2 ? p.geo.map(Number) : null,
    art: [0, 1, 2, 3, 4, 5].map((i) => artUrl(hair.length ? hair[i % hair.length] : 'boucles', p.id * 10 + i)),
    url: proUrl(p),
    ...extra,
  };
}

export async function loadPros(filter = 'publish') {
  let q = sb.from('pros').select('*');
  if (filter) q = q.eq('status', filter);
  return check(await q.order('id')) || [];
}
export async function loadReviews(proIds) {
  let q = sb.from('reviews').select('id, pro_id, booking_id, client_id, rating, body, reply, first_name, hair, photo, hidden, is_example, created');
  if (proIds) q = q.in('pro_id', proIds);
  return check(await q.order('created', { ascending: false })) || [];
}
export async function loadBusy(proIds) {
  return check(await sb.rpc('cm_busy', { p_pros: proIds || null })) || [];
}

export const isPast = (b) => slotMs(b.slot_date, b.slot_hour) <= nowMs();
export { HAIR };
