// Agenda privé du coiffeur (abonnement Google Agenda, iPhone, Outlook) : /api/ical?t=LIEN_PRIVÉ
const fold = (line) => {
  const out = [];
  let s = line;
  while (Buffer.byteLength(s) > 75) {
    let n = 75;
    while (Buffer.byteLength(s.slice(0, n)) > 75) n--;
    out.push(s.slice(0, n));
    s = ' ' + s.slice(n);
  }
  out.push(s);
  return out.join('\r\n');
};
const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const local = (date, hour) => date.replace(/-/g, '') + 'T' + hour.split(':').map((x) => x.padStart(2, '0')).join('') + '00';
function plus(date, hour, min) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hour.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi + min));
  return t.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
}
export default async function handler(req, res) {
  const token = String(req.query.t || '');
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!/^[a-f0-9]{32}$/.test(token) || !url || !key) return res.status(404).send('Agenda introuvable.');
  const r = await fetch(`${url}/rest/v1/rpc/cm_ical_feed`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }) });
  const rows = r.ok ? await r.json() : [];
  if (!rows.length && !r.ok) return res.status(404).send('Agenda introuvable.');
  const host = req.headers.host || 'coiffmatch';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Coiff'Match//FR", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', "X-WR-CALNAME:Coiff'Match – " + esc(rows[0] ? rows[0].name : 'mes rendez-vous'), 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const b of rows) {
    const pending = b.status === 'pending';
    L.push('BEGIN:VEVENT', `UID:cm-${b.id}@${host}`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Paris:${local(b.slot_date, b.slot_hour)}`, `DTEND;TZID=Europe/Paris:${plus(b.slot_date, b.slot_hour, b.dur)}`,
      'SUMMARY:' + esc((pending ? '[À confirmer] ' : '') + b.label + ' – ' + b.first_name + (b.staff_name ? ' (avec ' + b.staff_name + ')' : '')),
      'DESCRIPTION:' + esc((b.phone ? 'Téléphone : ' + b.phone + '\n' : '') + (pending ? 'Demande à accepter dans votre espace coiffeur.' : 'Rendez-vous confirmé.')),
      ...(b.address ? ['LOCATION:' + esc(b.address)] : []), `STATUS:${pending ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(L.map(fold).join('\r\n') + '\r\n');
}
