// Outils communs : dates (fuseau de Paris), libellés, visuels de texture.

export const HAIR = { raides: 'Raides', ondules: 'Ondulés', boucles: 'Bouclés', frises: 'Frisés', crepus: 'Crépus' };
export const SERVICES = { coupe: 'Coupe', 'coupe-soin': 'Coupe + soin', tresses: 'Tresses / coiffure protectrice', couleur: 'Coloration', autre: 'Autre' };
export const SKILLS = {
  crepus: 'Formé aux cheveux crépus', 'coupe-sec': 'Coupe à sec', locks: 'Locks', tresses: 'Tresses et nattes', twists: 'Twists et vanilles',
  perruques: 'Perruques et tissages', transition: 'Transition vers le naturel', couleur: 'Couleur sur cheveux texturés', soins: 'Soins profonds', enfants: "Cheveux d'enfants",
};
export const LENGTHS = { court: 'Courts', 'mi-long': 'Mi-longs', long: 'Longs' };
export const DIPLOMAS = { '': 'Non renseigné', CAP: 'CAP Métiers de la coiffure', BP: 'BP Coiffure', BM: 'Brevet de maîtrise', Autre: 'Autre diplôme' };
export const ALL_HOURS = ['8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:15', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:15', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];
export const DEFAULT_HOURS = ['9:00', '10:30', '11:15', '14:00', '15:30', '16:15', '17:00', '18:30'];
export const HAIR_QUESTIONS = {
  type: ['Vos cheveux sont…', HAIR],
  length: ['Leur longueur', LENGTHS],
  thick: ['Leur épaisseur', { fins: 'Fins', moyens: 'Moyens', epais: 'Épais', nsp: 'Je ne sais pas' }],
  state: ['Ils sont…', { naturel: 'Naturels', colores: 'Colorés ou méchés', defrises: 'Défrisés ou lissés', abimes: 'Abîmés ou cassants', locks: 'En locks' }],
  porosity: ['Après le lavage, ils sèchent…', { vite: 'Très vite (porosité forte)', normal: 'Normalement', lent: "Lentement, l'eau perle (porosité faible)", nsp: 'Je ne sais pas' }],
  goal: ['Votre objectif', { entretien: 'Entretenir, couper les pointes', definition: 'Définir mes boucles', protection: 'Une coiffure protectrice', transition: 'Revenir au naturel', couleur: 'Changer de couleur' }],
};
export const FOLLOWUP_WEEKS = { coupe: 8, 'coupe-soin': 8, tresses: 6, couleur: 8, autre: 0 };

export function cleanHairProfile(inp) {
  const out = {};
  for (const [k, q] of Object.entries(HAIR_QUESTIONS)) {
    const v = inp && typeof inp[k] === 'string' ? inp[k] : '';
    if (q[1][v]) out[k] = v;
  }
  return out;
}

export function hairProfileText(p) {
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      p = null;
    }
  }
  if (!p || typeof p !== 'object') return '';
  const parts = [];
  for (const k of ['type', 'length', 'thick', 'state']) {
    if (p[k] && p[k] !== 'nsp' && HAIR_QUESTIONS[k][1][p[k]]) parts.push(HAIR_QUESTIONS[k][1][p[k]].toLowerCase());
  }
  if (p.porosity === 'vite' || p.porosity === 'lent') parts.push(p.porosity === 'vite' ? 'porosité forte' : 'porosité faible');
  let t = parts.length ? parts.join(', ') : '';
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  if (p.goal && HAIR_QUESTIONS.goal[1][p.goal]) t += (t ? ' · ' : '') + 'objectif : ' + HAIR_QUESTIONS.goal[1][p.goal].toLowerCase();
  return t;
}

/* ---------- Dates (heure de Paris) ---------- */
const PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** Heure de Paris sous forme de « millisecondes locales » (comparable avec slotMs). */
export function nowMs() {
  const p = Object.fromEntries(PARIS.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
export const todayKey = () => isoOf(nowMs());
export function isoOf(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const dayMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (iso, n) => isoOf(dayMs(iso) + n * 864e5);
export const dow = (iso) => new Date(dayMs(iso)).getUTCDay();
export const minutes = (h) => {
  const [a, b] = String(h).split(':');
  return (+a || 0) * 60 + (+b || 0);
};
export const slotMs = (date, hour) => dayMs(date) + minutes(hour) * 6e4;
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MONTH_NAMES = MONTHS_LONG;
/** « mardi 28 oct. » */
export function dateLabel(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso);
  const d = new Date(dayMs(iso));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** Date d'une colonne « timestamptz » en heure de Paris, au format de WordPress mysql2date. */
function parisParts(ts) {
  const p = Object.fromEntries(PARIS.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: p.hour, i: p.minute };
}
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
/** « 5 Oct, 14:03 » (format « j M, H:i » de WordPress en français). */
export const fmtShort = (ts) => {
  const p = parisParts(ts);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]}, ${p.h}:${p.i}`;
};
/** « 5 Oct 2026 » (format « j M Y »). */
export const fmtDay = (ts) => {
  const p = parisParts(ts);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
};
export const fmtDayTime = (ts) => {
  const p = parisParts(ts);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}, ${p.h}:${p.i}`;
};
export const parisDayOf = (ts) => {
  const p = parisParts(ts);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

/** Lien « Ajouter à Google Agenda ». */
export function gcalUrl(title, date, hour, dur, location, details) {
  const start = new Date(slotMs(date, hour));
  // Les « ms locales » de Paris sont converties en UTC avec le décalage du jour.
  const off = parisOffsetMin(date);
  const fmt = (ms) => new Date(ms - off * 6e4).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const a = start.getTime();
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + fmt(a) + '/' + fmt(a + dur * 6e4) +
    '&location=' + encodeURIComponent(location || '') + '&details=' + encodeURIComponent(details || '');
}
/** Décalage de Paris par rapport à UTC (en minutes) pour une date. */
export function parisOffsetMin(iso) {
  const t = new Date(dayMs(iso) + 12 * 36e5);
  const p = Object.fromEntries(PARIS.formatToParts(t).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t.getTime()) / 6e4;
}

export function cleanPhone(p) {
  const s = String(p || '').replace(/[^0-9+]/g, '');
  return /^0[1-9][0-9]{8}$/.test(s) || /^\+[1-9][0-9]{7,14}$/.test(s) ? s : '';
}

/* ---------- Visuels de texture (mêmes images que le site WordPress) ---------- */
const PALETTES = [
  ['#0B2A27', '#F0F2EE', '#E2B864'], ['#DCE5DF', '#0B2A27', '#0E5754'], ['#C98F6B', '#FFF4EA', '#0B2A27'], ['#E2B864', '#0B2A27', '#FFFFFF'],
  ['#123A36', '#E2B864', '#A9BAB5'], ['#F3E9D2', '#7A5714', '#0E5754'], ['#2B1D18', '#E9C7A7', '#E2B864'],
];
let CRC;
function crc32(str) {
  if (!CRC) {
    CRC = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  const b = new TextEncoder().encode(str);
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Multiplication 32 bits exacte (comme PHP 64 bits puis & 0xFFFFFFFF).
const mul32 = (a, b) => Number((BigInt(a) * BigInt(b)) & 0xffffffffn);
function rng(seed) {
  let s = Number(((BigInt(seed) * 7919n) ^ 0x5deece6n) & 0xffffffffn);
  return () => {
    s = (mul32(1664525, s) + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const fmtNum = (x) => {
  // Même écriture des nombres que PHP (pas de « .0 »).
  const s = String(x);
  return s === '-0' ? '0' : s;
};
const ART_CACHE = new Map();
export function artSvg(hair, seed) {
  hair = HAIR[hair] ? hair : 'boucles';
  const r = rng(seed + crc32(hair));
  const [bg, fg, ac] = PALETTES[Math.floor(r() * PALETTES.length)];
  const W = 600, H = 600;
  const shape = { raides: [0.005, 10], ondules: [0.016, 26], boucles: [0.04, 22], frises: [0.075, 14], crepus: [0.13, 9] }[hair];
  const n = 9 + Math.floor(r() * 6);
  const tilt = (r() - 0.5) * 0.5;
  const gap = W / (n - 1);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg}"/>`;
  const cx = Math.round(150 + r() * 300), cy = Math.round(150 + r() * 300);
  out += `<defs><radialGradient id="g" cx="${fmtNum(r2(cx / W))}" cy="${fmtNum(r2(cy / H))}" r=".7"><stop offset="0" stop-color="${fg}" stop-opacity=".16"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
  const accent = Math.floor(r() * n);
  for (let i = 0; i < n; i++) {
    const x0 = -40 + i * (gap + 80 / n);
    const ph = r() * 6.28, amp = shape[1] * (0.7 + r() * 0.6), fq = shape[0] * (0.85 + r() * 0.3), top = -10 + r() * 60;
    const pts = [];
    for (let y = top; y <= H + 10; y += 6) {
      let x = x0 + tilt * y + Math.sin(y * fq + ph) * amp;
      if (hair === 'crepus') x += (Math.floor(y / 6) % 2 ? 1 : -1) * 4;
      pts.push(fmtNum(r1(x)) + ' ' + fmtNum(r1(y)));
    }
    const isAc = i === accent || i === (accent + 5) % n;
    const w = isAc ? 7 : 4 + r() * 4, op = isAc ? 1 : 0.45 + r() * 0.45;
    out += `<path d="M${pts.join(' L')}" fill="none" stroke="${isAc ? ac : fg}" stroke-width="${fmtNum(r1(w))}" stroke-opacity="${fmtNum(r2(op))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return out + '</svg>';
}
/** Adresse de l'image (data:) d'un visuel de texture. */
export function artUrl(hair, seed) {
  const key = hair + '.' + seed;
  if (!ART_CACHE.has(key)) ART_CACHE.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSvg(hair, seed)));
  return ART_CACHE.get(key);
}

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
