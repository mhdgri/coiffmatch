// Lecture publique des données (clé « anon », mêmes droits qu'un visiteur), pour les fonctions serveur.
import { HAIR } from '../../src/lib/util.js';

export { HAIR };
export const SITE = "Coiff'Match";

const env = () => ({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY });

export async function rest(path) {
  const { url, key } = env();
  if (!url || !key) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const PRO_COLS = 'id,name,slug,mode,place,zones,hair,bio,photos,verified,is_example,address,geo,presta';

/** Un coiffeur publié, par son numéro, avec la synthèse de ses avis visibles. */
export async function getPro(id) {
  if (!/^\d+$/.test(String(id))) return null;
  const rows = await rest(`pros?select=${PRO_COLS}&status=eq.publish&id=eq.${id}`);
  const p = rows && rows[0];
  if (!p) return null;
  const rv = (await rest(`reviews?select=rating,is_example&hidden=eq.false&pro_id=eq.${id}`)) || [];
  const real = rv.filter((r) => !r.is_example);
  const all = p.is_example ? rv : real;
  p.reviewCount = all.length;
  p.rating = all.length ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10 : 0;
  p.realReviewCount = real.length;
  p.realRating = real.length ? Math.round((real.reduce((s, r) => s + r.rating, 0) / real.length) * 10) / 10 : 0;
  return p;
}

export async function getPublished() {
  return (await rest(`pros?select=id,name,slug,place,zones,hair,is_example,created_at&status=eq.publish&order=id`)) || [];
}

/* Mêmes règles que src/pages.js (slugify, citySlugs, matching, landTitle), pour que les pages restent identiques. */
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
    if (!(x.hair || []).includes(hair)) continue;
    if (city) {
      const cs = citySlugs(x);
      if (!cs[city]) continue;
      name = name || cs[city];
    }
    list.push(x);
  }
  return [list, name];
}
const lower = (t) => String(t || '').toLowerCase();
export const landTitle = (hair, city, cityName) => 'Coiffeur cheveux ' + lower(HAIR[hair]) + (city ? ' à ' + cityName : '');
export const hairList = (p) => (p.hair || []).filter((h) => HAIR[h]).map((h) => HAIR[h]);

export function proDesc(x) {
  const lab = (x.hair || []).filter((h) => HAIR[h]).map((h) => lower(HAIR[h]));
  const words = String(x.bio || '').trim().split(/\s+/);
  return ((x.bio ? (words.length > 24 ? words.slice(0, 24).join(' ') + '…' : x.bio) + ' ' : '') + (lab.length ? 'Cheveux ' + lab.join(', ') + '. ' : '') + (x.mode === 'domicile' ? 'À domicile, ' : 'Au salon, ') + x.place + '. Réservez en ligne.').trim();
}
export const proTitle = (x) => x.name + ' – coiffure ' + (x.mode === 'domicile' ? 'à domicile' : 'en salon') + ', ' + x.place;
export const proPath = (x) => `/coiffeur/${x.slug || x.id}/`;
export const fr = (n) => Number(n).toFixed(1).replace('.', ',');
