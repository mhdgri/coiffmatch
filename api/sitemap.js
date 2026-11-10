// Plan du site pour Google : /sitemap.xml
// Pages fixes, vrais coiffeurs publiés, et pages « type de cheveux » et « type de cheveux + ville »
// qui comptent au moins un vrai coiffeur. Les profils d'exemple n'y figurent jamais.
import { HAIR, getPublished, citySlugs, proPath } from './_lib/data.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export default async function handler(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const real = (await getPublished()).filter((p) => !p.is_example);
  const urls = [
    ['/', '1.0'],
    ['/trouver-un-coiffeur/', '0.9'],
    ['/guide-des-cheveux/', '0.7'],
    ['/devenir-coiffeur-partenaire/', '0.7'],
    ['/contact/', '0.3'],
    ['/mentions-legales/', '0.1'],
    ['/conditions-utilisation/', '0.1'],
    ['/politique-de-confidentialite/', '0.1'],
  ].map(([path, prio]) => ({ loc: origin + path, prio }));
  const lands = new Set();
  for (const p of real) {
    urls.push({ loc: origin + proPath(p), prio: '0.8', mod: String(p.created_at || '').slice(0, 10) });
    for (const h of p.hair || []) {
      if (!HAIR[h]) continue;
      lands.add(`/coiffeurs/${h}/`);
      for (const c of Object.keys(citySlugs(p))) lands.add(`/coiffeurs/${h}/${c}/`);
    }
  }
  for (const path of [...lands].sort()) urls.push({ loc: origin + path, prio: path.split('/').length > 4 ? '0.6' : '0.7' });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.prio}</priority></url>`).join('\n') +
    '\n</urlset>\n';
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.end(xml);
}
