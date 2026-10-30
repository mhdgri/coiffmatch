// Mêmes profils d'exemple que supabase/schema.sql et supabase/exemples-avis.sql (utilisés en mode démo).

const H = (map) => map;
const week = (h, sat) => H({ 0: [], 1: h, 2: h, 3: h, 4: h, 5: h, 6: sat || h });
const P1 = '00000000-0000-4000-a000-000000000001';
const P2 = '00000000-0000-4000-a000-000000000002';
const P3 = '00000000-0000-4000-a000-000000000003';
const P4 = '00000000-0000-4000-a000-000000000004';
const S = (n) => `00000000-0000-4000-b000-0000000000${n}`;

const base = { owner: null, travel: 0, address: '', zones: '', closed: [], staff: [], photos: [], published: true, is_example: true, created_at: '2026-10-01T10:00:00Z' };

export const SEED_PROS = [
  {
    ...base, id: P1, name: 'Nadia K. (exemple)', mode: 'domicile', city: 'Paris 18e', zones: 'Paris 17e, Paris 18e, Paris 19e, Saint-Ouen', travel: 10,
    hair: ['boucles', 'frises', 'crepus'], skills: ['coupe-sec', 'transition', 'soins'], tags: ['Coupe à sec', 'Soins sans sulfates'], diploma: 'CAP', verified: true,
    bio: 'Spécialiste des cheveux bouclés et frisés depuis 8 ans. Je coupe à sec, boucle par boucle, pour respecter votre texture.',
    lat: 48.8925, lng: 2.3444, hours: week(['9:00', '10:30', '14:00', '15:30', '17:00'], ['9:00', '10:30', '14:00']),
  },
  {
    ...base, id: P2, name: 'Salon Les Boucles (exemple)', mode: 'salon', city: 'Paris 11e', address: '12 rue Oberkampf, 75011 Paris',
    hair: ['ondules', 'boucles', 'frises'], skills: ['coupe-sec', 'couleur', 'enfants'], tags: ['Méthode curly', 'Diagnostic offert'], diploma: 'BP', verified: true,
    bio: 'Salon dédié aux cheveux texturés : diagnostic, coupe adaptée et routine personnalisée à refaire chez vous.',
    lat: 48.865, lng: 2.379,
    hours: { ...week(['9:00', '10:30', '11:15', '14:00', '15:30', '17:00'], ['9:00', '10:30', '11:15', '14:00', '15:30']), 1: [], 5: ['9:00', '10:30', '11:15', '14:00', '15:30', '17:00', '18:30'] },
    staff: [
      { k: 's1', name: 'Inès', services: [], days: ['1', '2', '3', '4', '5', '6'] },
      { k: 's2', name: 'Maëlle', services: [S(21), S(22)], days: ['3', '4', '5', '6'] },
    ],
  },
  {
    ...base, id: P3, name: 'Karim B. (exemple)', mode: 'salon', city: 'Saint-Denis', address: '5 rue de la République, 93200 Saint-Denis',
    hair: ['raides', 'ondules', 'crepus'], skills: ['crepus'], tags: ['Dégradés', 'Barbe'], diploma: 'CAP', verified: true,
    bio: 'Barbier-coiffeur, dégradés précis et coupes homme et femme.',
    lat: 48.9362, lng: 2.3574, hours: week(['10:30', '11:15', '14:00', '15:30', '16:15', '17:00', '18:30'], ['9:00', '10:30', '11:15', '14:00', '15:30']),
  },
  {
    ...base, id: P4, name: 'Awa D. (exemple)', mode: 'domicile', city: 'Montreuil', zones: 'Montreuil, Bagnolet, Vincennes, Paris 20e', travel: 10,
    hair: ['frises', 'crepus'], skills: ['crepus', 'tresses', 'twists', 'locks'], tags: ['Box braids', 'Nattes collées'], diploma: 'CAP', verified: false,
    bio: 'Tresses et coiffures protectrices à domicile, mèches fournies sur demande.',
    lat: 48.8611, lng: 2.443, hours: week(['9:00', '14:00']),
  },
];

const sv = (id, pro_id, label, service, duration, price, plus, position) => ({ id: S(id), pro_id, label, service, duration, price, plus, position });
export const SEED_SERVICES = [
  sv(11, P1, 'Coupe sur boucles', 'coupe', 60, 45, {}, 1),
  sv(12, P1, 'Coupe + soin hydratant', 'coupe-soin', 90, 65, {}, 2),
  sv(13, P1, 'Vanilles / twists', 'tresses', 150, 80, { 'mi-long': 15, long: 30 }, 3),
  sv(21, P2, 'Coupe curly', 'coupe', 75, 55, { long: 10 }, 1),
  sv(22, P2, 'Coupe + soin profond', 'coupe-soin', 105, 78, {}, 2),
  sv(23, P2, 'Balayage sur boucles', 'couleur', 180, 140, { 'mi-long': 20, long: 40 }, 3),
  sv(31, P3, 'Coupe dégradé', 'coupe', 45, 25, {}, 1),
  sv(32, P3, 'Coupe + soin du cuir chevelu', 'coupe-soin', 60, 38, {}, 2),
  sv(33, P3, 'Taille de barbe', 'autre', 30, 15, {}, 3),
  sv(41, P4, 'Box braids mi-longues', 'tresses', 240, 120, { long: 30 }, 1),
  sv(42, P4, 'Nattes collées', 'tresses', 120, 60, { long: 15 }, 2),
  sv(43, P4, 'Coupe pointes + soin', 'coupe-soin', 60, 40, {}, 3),
];

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const rv = (n, pro_id, hair, rating, body, d) => ({ id: `ex-${n}`, pro_id, is_example: true, client_name: 'Exemple', hair, rating, body: `${body} (avis d'exemple)`, created_at: ago(d) });
export const SEED_REVIEWS = [
  rv(1, P2, 'boucles', 5, 'Diagnostic précis et coupe qui respecte mes boucles.', 12),
  rv(2, P2, 'ondules', 5, "On m'a expliqué la routine à refaire chez moi, très clair.", 25),
  rv(3, P2, 'frises', 4, "Très bon résultat, un peu d'attente à l'accueil.", 40),
  rv(4, P1, 'frises', 5, "Coupe à sec, boucle par boucle : enfin quelqu'un qui sait faire.", 8),
  rv(5, P1, 'boucles', 4, 'Ponctuelle et de bons conseils produits.', 30),
  rv(6, P4, 'crepus', 5, 'Tresses nettes et qui tiennent, sans tirer.', 15),
  rv(7, P4, 'crepus', 5, 'Très douce avec ma fille, je recommande.', 50),
  rv(8, P3, 'raides', 4, 'Dégradé propre, rapide et efficace.', 20),
];
