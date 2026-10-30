// Accès aux données avec Supabase.
import { createClient } from '@supabase/supabase-js';

const FR = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'Email not confirmed': "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail).",
  'User already registered': 'Un compte existe déjà avec cet e-mail. Connectez-vous.',
  'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 6 caractères.',
};

function fail(error) {
  if (!error) return;
  const msg = error.message || String(error);
  const known = Object.keys(FR).find((k) => msg.startsWith(k));
  throw new Error(known ? FR[known] : msg);
}

export function createSupabaseApi(url, key) {
  const sb = createClient(url, key);

  const PRO_COLS = '*, services(*)';
  const sortServices = (p) => ({ ...p, services: (p.services || []).sort((a, b) => a.position - b.position) });

  async function ratings() {
    const { data, error } = await sb.from('pro_ratings').select('*');
    fail(error);
    return Object.fromEntries((data || []).map((r) => [r.pro_id, r]));
  }

  return {
    mode: 'supabase',

    // Comptes
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => {
        // Hors du rappel : Supabase déconseille d'appeler ses fonctions directement dedans.
        setTimeout(() => cb(s ? { id: s.user.id, email: s.user.email } : null), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp({ email, password, name, role }) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name, role } } });
      fail(error);
      return { needsConfirm: !data.session };
    },
    async signIn({ email, password }) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      fail(error);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async profile() {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('id', s.session.user.id).maybeSingle();
      fail(error);
      return data ? { ...data, email: s.session.user.email } : null;
    },
    async updateProfile(patch) {
      const { data: s } = await sb.auth.getSession();
      const { error } = await sb.from('profiles').update(patch).eq('id', s.session.user.id);
      fail(error);
    },

    // Coiffeurs
    async listPros() {
      const [{ data, error }, r] = await Promise.all([sb.from('pros').select(PRO_COLS).eq('published', true), ratings()]);
      fail(error);
      return (data || []).map((p) => ({ ...sortServices(p), rating: r[p.id]?.rating ?? null, count: r[p.id]?.count ?? 0 }));
    },
    async getPro(id) {
      const [{ data, error }, rev] = await Promise.all([
        sb.from('pros').select(PRO_COLS).eq('id', id).maybeSingle(),
        sb.from('reviews').select('id, client_name, hair, rating, body, created_at, is_example').eq('pro_id', id).order('created_at', { ascending: false }),
      ]);
      fail(error);
      fail(rev.error);
      if (!data) return null;
      const reviews = rev.data || [];
      const count = reviews.length;
      const rating = count ? Math.round((reviews.reduce((a, b) => a + b.rating, 0) / count) * 10) / 10 : null;
      return { ...sortServices(data), reviews, rating, count };
    },
    async busy(proId = null) {
      const { data, error } = await sb.rpc('busy_slots', { p_pro: proId });
      fail(error);
      return data || [];
    },

    // Réservations côté cliente
    async book(b) {
      const { data, error } = await sb.rpc('book', {
        p_service: b.serviceId, p_day: b.day, p_hour: b.hour, p_staff: b.staff || '', p_length: b.length || '',
        p_phone: b.phone || '', p_address: b.address || '', p_notes: b.notes || '',
      });
      fail(error);
      return data;
    },
    async myBookings() {
      const { data: s } = await sb.auth.getSession();
      const { data, error } = await sb
        .from('bookings')
        .select('*, pro:pros(id, name, mode, city, address), review:reviews(id)')
        .eq('client_id', s.session.user.id)
        .order('day', { ascending: true });
      fail(error);
      return (data || []).map((b) => ({ ...b, reviewed: !!(b.review && (Array.isArray(b.review) ? b.review.length : b.review.id)) }));
    },
    async cancel(id) {
      fail((await sb.rpc('cancel_booking', { p_id: id })).error);
    },
    async review(bookingId, rating, body) {
      fail((await sb.rpc('leave_review', { p_booking: bookingId, p_rating: rating, p_body: body })).error);
    },

    // Espace coiffeur
    async myPro() {
      const { data: s } = await sb.auth.getSession();
      const { data, error } = await sb.from('pros').select(PRO_COLS).eq('owner', s.session.user.id).maybeSingle();
      fail(error);
      return data ? sortServices(data) : null;
    },
    async saveMyPro(pro, services) {
      const { data: s } = await sb.auth.getSession();
      const fields = (({ name, mode, city, address, zones, travel, hair, skills, tags, diploma, bio, hours, closed, staff, photos, published }) => ({
        name, mode, city, address, zones, travel, hair, skills, tags, diploma, bio, hours, closed, staff, photos, published,
      }))(pro);
      let id = pro.id;
      if (id) {
        fail((await sb.from('pros').update(fields).eq('id', id)).error);
      } else {
        const { data, error } = await sb.from('pros').insert({ ...fields, owner: s.session.user.id }).select('id').single();
        fail(error);
        id = data.id;
      }
      const { data: old } = await sb.from('services').select('id').eq('pro_id', id);
      const keep = services.filter((x) => x.id).map((x) => x.id);
      const gone = (old || []).map((x) => x.id).filter((x) => !keep.includes(x));
      if (gone.length) fail((await sb.from('services').delete().in('id', gone)).error);
      for (const [i, x] of services.entries()) {
        const row = { pro_id: id, label: x.label, service: x.service, duration: x.duration, price: x.price, plus: x.plus || {}, position: i + 1 };
        if (x.id) fail((await sb.from('services').update(row).eq('id', x.id)).error);
        else fail((await sb.from('services').insert(row)).error);
      }
      return id;
    },
    async proBookings() {
      const pro = await this.myPro();
      if (!pro) return [];
      const { data, error } = await sb.from('bookings').select('*').eq('pro_id', pro.id).order('day').order('hour');
      fail(error);
      return data || [];
    },
    async setStatus(id, status) {
      fail((await sb.rpc('set_booking_status', { p_id: id, p_status: status })).error);
    },
    async uploadPhoto(file) {
      const { data: s } = await sb.auth.getSession();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${s.session.user.id}/${crypto.randomUUID()}.${ext}`;
      fail((await sb.storage.from('photos').upload(path, file, { contentType: file.type })).error);
      return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },
    async removePhoto(url) {
      const marker = '/object/public/photos/';
      const i = url.indexOf(marker);
      if (i >= 0) await sb.storage.from('photos').remove([url.slice(i + marker.length)]);
    },
  };
}
