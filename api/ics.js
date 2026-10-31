// Fichier « .ics » d'un rendez-vous, pour l'ajouter à son agenda. Lu avec la session de la cliente (jeton dans ?a=).
export default async function handler(req, res) {
  const id = String(req.query.id || ''), tok = String(req.query.a || '');
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!/^\d+$/.test(id) || !tok || !url) return res.status(404).send('Rendez-vous introuvable.');
  const h = { apikey: key, Authorization: `Bearer ${tok}` };
  const r = await fetch(`${url}/rest/v1/bookings?id=eq.${id}&select=*,pros(name,mode,address,place)`, { headers: h });
  const [b] = r.ok ? await r.json() : [];
  if (!b) return res.status(404).send('Rendez-vous introuvable.');
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const [y, m, d] = b.slot_date.split('-').map(Number), [hh, mi] = b.slot_hour.split(':').map(Number);
  const f = (t) => t.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
  const p = b.pros || {};
  const where = p.mode === 'domicile' ? b.address : p.address || p.place;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Coiff'Match//FR", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:cm-${b.id}@${req.headers.host}`,
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), 'DTSTART;TZID=Europe/Paris:' + f(new Date(Date.UTC(y, m - 1, d, hh, mi))),
    'DTEND;TZID=Europe/Paris:' + f(new Date(Date.UTC(y, m - 1, d, hh, mi + b.dur))), 'SUMMARY:' + esc(b.label + ' – ' + (p.name || "Coiff'Match")), 'LOCATION:' + esc(where),
    'DESCRIPTION:' + esc(`Rendez-vous réservé sur Coiff'Match. Pour annuler : https://${req.headers.host}/trouver-un-coiffeur/?tab=mine`),
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous coiffure dans 2 heures', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rendez-vous-coiffure-${b.slot_date}.ics"`);
  res.status(200).send(lines.join('\r\n') + '\r\n');
}
