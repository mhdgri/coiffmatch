// Pages « coiffeur » et « type de cheveux » servies avec leurs balises de partage et de référencement.
// Le site reste le même (index.html + React) ; seules les balises du <head> sont remplies côté serveur,
// pour que WhatsApp, Instagram, Facebook et Google voient le bon titre, le bon texte et la bonne image.
import { HAIR, SITE, getPro, getPublished, matching, landTitle, proDesc, proTitle, proPath } from './_lib/data.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let INDEX = { html: '', at: 0 };

// Mêmes titres et textes que src/main.jsx.
const FIXED = {
  home: ['/', "Coiff'Match – Le coiffeur qui connaît vos cheveux", 'Du plus raide au plus crépu, trouvez le coiffeur qui maîtrise vos cheveux, voyez son prochain créneau et réservez, au salon ou à domicile.'],
  search: ['/trouver-un-coiffeur/', "Trouver un coiffeur – Coiff'Match", 'Trouvez un coiffeur qui maîtrise votre type de cheveux (raides, ondulés, bouclés, frisés, crépus), au salon ou à domicile, et réservez en ligne.'],
  guide: ['/guide-des-cheveux/', "Guide des cheveux – Coiff'Match", 'Reconnaître votre type de cheveux, raides, ondulés, bouclés, frisés ou crépus, et savoir les entretenir entre deux rendez-vous chez le coiffeur.'],
  partner: ['/devenir-coiffeur-partenaire/', "Devenir coiffeur partenaire – Coiff'Match", 'Recevez des clientes qui ont les cheveux que vous maîtrisez : profil, réservations, agenda et avis. Gratuit, sans commission.'],
};

async function indexHtml(origin) {
  if (INDEX.html && Date.now() - INDEX.at < 300000) return INDEX.html;
  const r = await fetch(`${origin}/index.html`, { headers: { 'x-cm-page': '1' } });
  if (!r.ok) throw new Error('index ' + r.status);
  INDEX = { html: await r.text(), at: Date.now() };
  return INDEX.html;
}

function head({ title, desc, url, image, noindex, type = 'website', ld }) {
  const t = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(title)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ];
  if (noindex) t.push('<meta name="robots" content="noindex" />');
  if (ld) t.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  return t.join('\n    ');
}

/** Fiche Google d'un vrai coiffeur (jamais pour un profil d'exemple). */
function proLd(p, url, image) {
  const prices = (p.presta || []).map((x) => Number(x && x.price)).filter((n) => n > 0);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: p.name,
    url,
    image,
    description: proDesc(p),
    knowsAbout: (p.hair || []).filter((h) => HAIR[h]).map((h) => 'Cheveux ' + HAIR[h].toLowerCase()),
  };
  if (p.mode === 'salon' && p.address) ld.address = { '@type': 'PostalAddress', streetAddress: p.address, addressLocality: p.place, addressCountry: 'FR' };
  else ld.areaServed = [p.place, ...(p.zones || [])].filter(Boolean);
  if (Array.isArray(p.geo) && p.geo.length === 2) ld.geo = { '@type': 'GeoCoordinates', latitude: p.geo[0], longitude: p.geo[1] };
  if (prices.length) ld.priceRange = `${Math.min(...prices)} € – ${Math.max(...prices)} €`;
  if (p.realReviewCount) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.realRating, reviewCount: p.realReviewCount, bestRating: 5, worstRating: 1 };
  return ld;
}

export default async function handler(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const q = req.query || {};
  let html;
  try {
    html = await indexHtml(origin);
  } catch {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
  let meta = null;
  try {
    if (FIXED[q.kind]) {
      const [path, title, desc] = FIXED[q.kind];
      meta = { title, desc, url: origin + path, image: `${origin}/api/og` };
    } else if (q.kind === 'pro') {
      const id = (String(q.slug || '').match(/(?:^|-)(\d+)$/) || [])[1];
      const p = id && (await getPro(id));
      if (p) {
        const url = origin + proPath(p);
        const image = `${origin}/api/og?pro=${p.id}`;
        meta = { title: `${proTitle(p)} – ${SITE}`, desc: proDesc(p), url, image, type: 'profile', noindex: p.is_example, ld: p.is_example ? null : proLd(p, url, image) };
      }
    } else if (q.kind === 'land' && HAIR[q.hair]) {
      const city = /^[a-z0-9-]+$/.test(q.city || '') ? q.city : '';
      const [list, cityName] = matching(await getPublished(), q.hair, city);
      if (!city || list.length) {
        const n = list.length;
        const t = landTitle(q.hair, city, cityName);
        meta = {
          title: `${t} – ${SITE}`,
          desc: `${t} : ${n} coiffeur${n > 1 ? 's' : ''} qui maîtrise${n > 1 ? 'nt' : ''} les cheveux ${HAIR[q.hair].toLowerCase()}, avec photos, tarifs, avis et prochain créneau. Réservez en ligne, au salon ou à domicile.`,
          url: `${origin}/coiffeurs/${q.hair}/${city ? city + '/' : ''}`,
          image: `${origin}/api/og?hair=${q.hair}${city ? '&city=' + city : ''}`,
          noindex: !list.some((x) => !x.is_example),
        };
      }
    }
  } catch {
    meta = null;
  }
  if (meta) {
    html = html
      .replace(/<title>[^<]*<\/title>/, '')
      .replace(/\s*<meta name="description"[^>]*>/, '')
      .replace(/\s*<meta property="og:(?:title|description|image|url|type)"[^>]*>/g, '')
      .replace('</head>', `    ${head(meta)}\n  </head>`);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  res.end(html);
}
