// Calcul des créneaux libres à partir des horaires du coiffeur et des créneaux occupés.

export const BOOKING_DAYS = 21;

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const toMin = (h) => {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
};

export function dateLabel(iso, long = false) {
  return parseDate(iso).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Membres de l'équipe qui font cette prestation ce jour-là. */
export function staffFor(pro, serviceId, dow) {
  return (pro.staff || []).filter(
    (m) => (m.days || []).map(String).includes(String(dow)) && (!m.services || !m.services.length || m.services.includes(serviceId)),
  );
}

function overlaps(busy, day, hour, dur, staffKey) {
  const s = toMin(hour), e = s + dur;
  return busy.some((b) => b.day === day && (staffKey === null || b.staff === staffKey) && toMin(b.hour) < e && s < toMin(b.hour) + b.dur);
}

/**
 * Jours à venir : [{ date, dow, hours: [{ h, taken }] }].
 * staffKey : '' = peu importe, 'sX' = une personne précise.
 */
export function availability(pro, service, busy, staffKey = '', now = new Date(), days = BOOKING_DAYS) {
  const out = [];
  const dur = service ? service.duration : 60;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hasTeam = (pro.staff || []).length > 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = isoDate(d), dow = d.getDay();
    let hours = (pro.hours && pro.hours[String(dow)]) || [];
    if ((pro.closed || []).includes(date)) hours = [];
    let team = null;
    if (hasTeam) {
      team = staffFor(pro, service && service.id, dow).filter((m) => !staffKey || m.k === staffKey);
      if (!team.length) hours = [];
    }
    const list = hours.map((h) => {
      let taken = i === 0 && toMin(h) <= nowMin + 30;
      if (!taken) {
        if (hasTeam) taken = team.every((m) => overlaps(busy, date, h, dur, m.k));
        else taken = overlaps(busy, date, h, dur, null);
      }
      return { h, taken };
    });
    out.push({ date, dow, hours: list });
  }
  return out;
}

/** Premier créneau libre, toutes prestations confondues (pour la liste). */
export function nextSlot(pro, busy, now = new Date()) {
  const services = pro.services || [];
  if (!services.length) return null;
  const shortest = services.reduce((a, b) => (a.duration <= b.duration ? a : b));
  for (const day of availability(pro, shortest, busy, '', now, 14)) {
    const free = day.hours.find((x) => !x.taken);
    if (free) return { date: day.date, h: free.h };
  }
  return null;
}
