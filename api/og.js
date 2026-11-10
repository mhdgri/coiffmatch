// Image d'aperçu des liens partagés (WhatsApp, Instagram, Facebook, Google) : 1200 × 630.
//   /api/og?pro=12              → la fiche d'un coiffeur
//   /api/og?hair=crepus&city=x  → une page « coiffeur cheveux crépus à … »
//   /api/og                     → le site
import { readFileSync } from 'node:fs';
import { ImageResponse } from '@vercel/og';
import { artSvg } from '../src/lib/util.js';
import { HAIR, getPro, getPublished, matching, landTitle, hairList, fr } from './_lib/data.js';

const font = (f) => readFileSync(new URL(`./_fonts/${f}`, import.meta.url));
const FONTS = [
  { name: 'Gloock', data: font('gloock-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'DM Sans', data: font('dm-sans-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'DM Sans', data: font('dm-sans-latin-700-normal.woff'), weight: 700, style: 'normal' },
];

const C = { dark: '#0B2A27', light: '#F0F2EE', soft: '#BFD8D5', gold: '#E4B65F' };
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== '') } });
const img = (src, style) => ({ type: 'img', props: { src, width: style.width, height: style.height, style: { objectFit: 'cover', ...style } } });
const svgUri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const chip = (t) => h('div', { border: `2px solid ${C.gold}`, color: C.gold, borderRadius: 999, padding: '6px 20px', fontSize: 26, fontWeight: 700 }, t);

/** Une vraie photo du coiffeur (png ou jpeg), sinon rien. */
async function photo(p) {
  const url = (p.photos || []).map((x) => x && x.url).find(Boolean);
  if (!url || !/^https:\/\//.test(url)) return '';
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(png|jpeg)$/.test(type)) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length < 4e6 ? `data:${type};base64,${buf.toString('base64')}` : '';
  } catch {
    return '';
  }
}

function card({ eyebrow, title, lines, chips, footer, picture }) {
  return h('div', { width: 1200, height: 630, background: C.dark, fontFamily: 'DM Sans' },
    h('div', { flexDirection: 'column', justifyContent: 'space-between', width: 730, padding: '56px 56px 52px 64px' },
      h('div', { flexDirection: 'column' },
        h('div', { color: C.gold, fontSize: 30, fontWeight: 700, letterSpacing: 1 }, eyebrow),
        h('div', { fontFamily: 'Gloock', color: C.light, fontSize: title.length > 26 ? 62 : 78, lineHeight: 1.05, marginTop: 28 }, title),
        ...lines.map((l) => h('div', { color: C.soft, fontSize: 32, marginTop: 18, lineHeight: 1.3 }, l)),
        chips.length ? h('div', { flexWrap: 'wrap', gap: 12, marginTop: 30 }, ...chips.map(chip)) : null),
      h('div', { color: C.light, fontSize: 28, fontWeight: 700 }, footer)),
    img(picture, { width: 470, height: 630 }));
}

export default async function handler(req, res) {
  const q = req.query || {};
  let el;
  try {
    if (q.pro) {
      const p = await getPro(q.pro);
      if (!p) throw new Error('absent');
      const pic = (await photo(p)) || svgUri(artSvg(p.hair[0] || 'boucles', p.id));
      const note = p.reviewCount ? `${fr(p.rating)} / 5 · ${p.reviewCount} avis` : 'Nouveau sur Coiff’Match';
      el = card({
        eyebrow: p.is_example ? 'Coiff’Match · profil d’exemple' : 'Coiff’Match',
        title: p.name,
        lines: [(p.mode === 'domicile' ? 'Coiffure à domicile' : 'Coiffure en salon') + ' · ' + p.place, note + (p.verified ? ' · Diplôme vérifié' : '')],
        chips: hairList(p).slice(0, 5),
        footer: 'Réservez en ligne, au salon ou à domicile',
        picture: pic,
      });
    } else if (q.hair && HAIR[q.hair]) {
      const pub = await getPublished();
      const city = /^[a-z0-9-]+$/.test(q.city || '') ? q.city : '';
      const [list, cityName] = matching(pub, q.hair, city);
      const n = list.length;
      el = card({
        eyebrow: 'Coiff’Match',
        title: landTitle(q.hair, city, cityName || city),
        lines: [n ? `${n} coiffeur${n > 1 ? 's' : ''} qui maîtrise${n > 1 ? 'nt' : ''} les cheveux ${HAIR[q.hair].toLowerCase()}` : `Des coiffeurs qui maîtrisent les cheveux ${HAIR[q.hair].toLowerCase()}`, 'Photos, tarifs, avis et prochain créneau'],
        chips: [],
        footer: 'Réservez en ligne, au salon ou à domicile',
        picture: svgUri(artSvg(q.hair, 7)),
      });
    } else throw new Error('site');
  } catch {
    el = card({
      eyebrow: 'Coiff’Match',
      title: 'Chaque texture a son expert.',
      lines: ['Trouvez le coiffeur qui maîtrise vos cheveux, du plus raide au plus crépu.'],
      chips: ['Raides', 'Ondulés', 'Bouclés', 'Frisés', 'Crépus'],
      footer: 'Réservez en ligne, au salon ou à domicile',
      picture: svgUri(artSvg('boucles', 3)),
    });
  }
  const out = new ImageResponse(el, { width: 1200, height: 630, fonts: FONTS });
  const buf = Buffer.from(await out.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400');
  res.end(buf);
}
