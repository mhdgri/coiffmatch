// Mode démo : tout est gardé dans le navigateur (localStorage). Utilisé quand Supabase n'est pas configuré.
// Les règles sont les mêmes que dans supabase/schema.sql.
import { SEED_PROS, SEED_SERVICES, SEED_REVIEWS } from './seed';
import { staffFor, isoDate } from './slots';

const KEY = 'cm-demo-v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const toMin = (h) => h.split(':').map(Number).reduce((a, b, i) => (i ? a + b : b * 60), 0);
const fail = (m) => {
  throw new Error(m);
};

function fresh() {
  return { users: [], profiles: [], pros: SEED_PROS, services: SEED_SERVICES, bookings: [], reviews: SEED_REVIEWS, session: null };
}
let mem = null;
function load() {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(KEY)) || fresh();
  } catch {
    mem = fresh();
  }
  return mem;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* stockage indisponible : les données restent le temps de la page */
  }
}

const listeners = new Set();
const emit = () => listeners.forEach((cb) => cb(load().session));
const me = () => load().session;
const need = () => me() || fail('Connectez-vous pour continuer.');
const withServices = (p) => ({ ...p, services: load().services.filter((s) => s.pro_id === p.id).sort((a, b) => a.position - b.position) });
function rate(proId) {
  const r = load().reviews.filter((x) => x.pro_id === proId);
  return { rating: r.length ? Math.round((r.reduce((a, b) => a + b.rating, 0) / r.length) * 10) / 10 : null, count: r.length };
}
const active = (b) => b.status === 'pending' || b.status === 'confirmed';
const nowParis = () => new Date();
const startOf = (b) => {
  const [y, m, d] = b.day.split('-').map(Number);
  const [h, mi] = b.hour.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
};

export function createDemoApi() {
  return {
    mode: 'demo',

    async session() {
      return me();
    },
    onAuth(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp({ email, password, name, role }) {
      const db = load();
      email = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('Adresse e-mail invalide.');
      if (String(password).length < 6) fail('Le mot de passe doit faire au moins 6 caractères.');
      if (db.users.find((u) => u.email === email)) fail('Un compte existe déjà avec cet e-mail. Connectez-vous.');
      const id = uid();
      db.users.push({ id, email, password });
      db.profiles.push({ id, name: String(name || '').slice(0, 60), role: role === 'pro' ? 'pro' : 'client', phone: '', hair: {} });
      db.session = { id, email };
      save();
      emit();
      return { needsConfirm: false };
    },
    async signIn({ email, password }) {
      const db = load();
      const u = db.users.find((x) => x.email === String(email).trim().toLowerCase() && x.password === password);
      if (!u) fail('E-mail ou mot de passe incorrect.');
      db.session = { id: u.id, email: u.email };
      save();
      emit();
    },
    async signOut() {
      load().session = null;
      save();
      emit();
    },
    async profile() {
      const s = me();
      if (!s) return null;
      const p = load().profiles.find((x) => x.id === s.id);
      return p ? { ...p, email: s.email } : null;
    },
    async updateProfile(patch) {
      const p = load().profiles.find((x) => x.id === need().id);
      for (const k of ['name', 'phone', 'hair']) if (k in patch) p[k] = patch[k];
      save();
    },

    async listPros() {
      return load().pros.filter((p) => p.published).map((p) => ({ ...withServices(p), ...rate(p.id) }));
    },
    async getPro(id) {
      const p = load().pros.find((x) => x.id === id && (x.published || x.owner === me()?.id));
      if (!p) return null;
      const reviews = load().reviews.filter((r) => r.pro_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { ...withServices(p), reviews, ...rate(id) };
    },
    async busy(proId = null) {
      const today = isoDate(new Date());
      return load().bookings
        .filter((b) => active(b) && b.day >= today && (!proId || b.pro_id === proId))
        .map(({ pro_id, day, hour, dur, staff }) => ({ pro_id, day, hour, dur, staff }));
    },

    async book({ serviceId, day, hour, staff = '', length = '', phone = '', address = '', notes = '' }) {
      const db = load();
      const s = need();
      const prof = db.profiles.find((x) => x.id === s.id);
      if (prof.role === 'pro') fail('Un compte coiffeur ne peut pas réserver. Créez un compte cliente.');
      const srv = db.services.find((x) => x.id === serviceId) || fail("Cette prestation n'existe plus.");
      const pro = db.pros.find((x) => x.id === srv.pro_id && x.published) || fail("Ce coiffeur n'est plus disponible.");
      const start = startOf({ day, hour });
      const dow = String(start.getDay());
      if (start <= nowParis()) fail('Ce créneau est déjà passé.');
      if ((pro.closed || []).includes(day)) fail('Le coiffeur est fermé ce jour-là.');
      if (!(pro.hours[dow] || []).includes(hour)) fail("Ce créneau n'est pas proposé.");
      let price = srv.price;
      if (srv.plus && Object.keys(srv.plus).length) {
        if (!['court', 'mi-long', 'long'].includes(length)) fail('Indiquez la longueur de vos cheveux.');
        price += srv.plus[length] || 0;
      }
      if (pro.mode === 'domicile' && String(address).trim().length < 5) fail("Indiquez l'adresse du rendez-vous.");
      const clash = (k) =>
        db.bookings.some(
          (b) => b.pro_id === pro.id && b.day === day && active(b) && (k === null || b.staff === k) &&
            toMin(b.hour) < toMin(hour) + srv.duration && toMin(hour) < toMin(b.hour) + b.dur,
        );
      let staffKey = '', staffName = '';
      if ((pro.staff || []).length) {
        const cands = staffFor(pro, srv.id, dow).filter((m) => !staff || m.k === staff);
        if (!cands.length) fail('Cette personne ne travaille pas ce jour-là ou ne fait pas cette prestation.');
        const m = cands.find((c) => !clash(c.k)) || fail("Ce créneau vient d'être pris. Choisissez-en un autre.");
        staffKey = m.k;
        staffName = m.name;
      } else if (clash(null)) fail("Ce créneau vient d'être pris. Choisissez-en un autre.");
      const b = {
        id: uid(), pro_id: pro.id, service_id: srv.id, client_id: s.id, client_name: prof.name || 'Cliente', client_phone: String(phone).slice(0, 30),
        address: String(address).slice(0, 200), hair: prof.hair || {}, label: srv.label, day, hour, dur: srv.duration, staff: staffKey,
        staff_name: staffName, length, price, notes: String(notes).slice(0, 500), status: pro.is_example ? 'confirmed' : 'pending', created_at: new Date().toISOString(),
      };
      db.bookings.push(b);
      if (phone) prof.phone = String(phone).slice(0, 30);
      save();
      return b.id;
    },
    async myBookings() {
      const db = load();
      const s = need();
      return db.bookings
        .filter((b) => b.client_id === s.id)
        .map((b) => {
          const p = db.pros.find((x) => x.id === b.pro_id);
          return { ...b, pro: p && { id: p.id, name: p.name, mode: p.mode, city: p.city, address: p.address }, reviewed: db.reviews.some((r) => r.booking_id === b.id) };
        })
        .sort((a, b) => (a.day + a.hour.padStart(5, '0')).localeCompare(b.day + b.hour.padStart(5, '0')));
    },
    async cancel(id) {
      const db = load();
      const s = need();
      const b = db.bookings.find((x) => x.id === id) || fail('Rendez-vous introuvable.');
      const owner = db.pros.find((p) => p.id === b.pro_id)?.owner;
      if (!active(b)) fail('Ce rendez-vous est déjà clos.');
      if (s.id === owner) {
        /* le coiffeur peut annuler à tout moment */
      } else if (s.id === b.client_id) {
        if (startOf(b) - nowParis() < 24 * 3600e3) fail("L'annulation en ligne est possible jusqu'à 24 h avant. Contactez le coiffeur.");
      } else fail('Vous ne pouvez pas annuler ce rendez-vous.');
      b.status = 'cancelled';
      save();
    },
    async review(bookingId, rating, body) {
      const db = load();
      const s = need();
      const b = db.bookings.find((x) => x.id === bookingId && x.client_id === s.id) || fail('Rendez-vous introuvable.');
      if (b.status !== 'confirmed') fail('Seul un rendez-vous confirmé peut recevoir un avis.');
      if (startOf(b) > nowParis()) fail('Vous pourrez donner votre avis après le rendez-vous.');
      if (!(rating >= 1 && rating <= 5)) fail('Choisissez une note de 1 à 5.');
      if (db.reviews.some((r) => r.booking_id === bookingId)) fail('Vous avez déjà donné votre avis.');
      db.reviews.push({ id: uid(), booking_id: bookingId, pro_id: b.pro_id, client_id: s.id, client_name: b.client_name.split(' ')[0], hair: b.hair?.type || '', rating, body: String(body || '').slice(0, 800), is_example: false, created_at: new Date().toISOString() });
      save();
    },

    async myPro() {
      const s = need();
      const p = load().pros.find((x) => x.owner === s.id);
      return p ? withServices(p) : null;
    },
    async saveMyPro(pro, services) {
      const db = load();
      const s = need();
      if (db.profiles.find((x) => x.id === s.id)?.role !== 'pro') fail('Seul un compte coiffeur peut créer une fiche.');
      let p = pro.id && db.pros.find((x) => x.id === pro.id && x.owner === s.id);
      const fields = ['name', 'mode', 'city', 'address', 'zones', 'travel', 'hair', 'skills', 'tags', 'diploma', 'bio', 'hours', 'closed', 'staff', 'photos', 'published'];
      if (!p) {
        p = { id: uid(), owner: s.id, verified: false, is_example: false, lat: null, lng: null, created_at: new Date().toISOString() };
        db.pros.push(p);
      }
      for (const k of fields) p[k] = pro[k];
      db.services = db.services.filter((x) => x.pro_id !== p.id || services.some((n) => n.id === x.id));
      services.forEach((x, i) => {
        const row = { id: x.id || uid(), pro_id: p.id, label: x.label, service: x.service, duration: x.duration, price: x.price, plus: x.plus || {}, position: i + 1 };
        const j = db.services.findIndex((y) => y.id === row.id);
        if (j >= 0) db.services[j] = row;
        else db.services.push(row);
      });
      save();
      return p.id;
    },
    async proBookings() {
      const p = await this.myPro();
      if (!p) return [];
      return load().bookings.filter((b) => b.pro_id === p.id).sort((a, b) => (a.day + a.hour.padStart(5, '0')).localeCompare(b.day + b.hour.padStart(5, '0')));
    },
    async setStatus(id, status) {
      const db = load();
      const s = need();
      const b = db.bookings.find((x) => x.id === id && db.pros.find((p) => p.id === x.pro_id)?.owner === s.id) || fail('Rendez-vous introuvable.');
      if (!['confirmed', 'refused'].includes(status)) fail('Statut invalide.');
      if (b.status !== 'pending') fail('Cette demande a déjà reçu une réponse.');
      b.status = status;
      save();
    },
    async uploadPhoto(file) {
      if (file.size > 1.5e6) fail('En mode démo, chaque photo doit faire moins de 1,5 Mo.');
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('Lecture de la photo impossible.'));
        r.readAsDataURL(file);
      });
    },
    async removePhoto() {},
    reset() {
      mem = fresh();
      save();
      emit();
    },
  };
}
