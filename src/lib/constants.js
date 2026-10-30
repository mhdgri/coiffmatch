// Listes de référence (mêmes clés que dans la base Supabase).

export const HAIR = { raides: 'Raides', ondules: 'Ondulés', boucles: 'Bouclés', frises: 'Frisés', crepus: 'Crépus' };

export const SERVICES = {
  coupe: 'Coupe',
  'coupe-soin': 'Coupe + soin',
  tresses: 'Tresses / coiffure protectrice',
  couleur: 'Coloration',
  autre: 'Autre',
};

export const SKILLS = {
  crepus: 'Formé aux cheveux crépus',
  'coupe-sec': 'Coupe à sec',
  locks: 'Locks',
  tresses: 'Tresses et nattes',
  twists: 'Twists et vanilles',
  perruques: 'Perruques et tissages',
  transition: 'Transition vers le naturel',
  couleur: 'Couleur sur cheveux texturés',
  soins: 'Soins profonds',
  enfants: "Cheveux d'enfants",
};

export const LENGTHS = { court: 'Courts', 'mi-long': 'Mi-longs', long: 'Longs' };

export const DIPLOMAS = {
  '': 'Non renseigné',
  CAP: 'CAP Métiers de la coiffure',
  BP: 'BP Coiffure',
  BM: 'Brevet de maîtrise',
  Autre: 'Autre diplôme',
};

export const ALL_HOURS = ['8:00', '9:00', '10:30', '11:15', '12:00', '14:00', '15:30', '16:15', '17:00', '18:30', '19:30'];
export const DEFAULT_HOURS = ['9:00', '10:30', '14:00', '15:30', '17:00'];
export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Fiche cheveux : 6 questions.
export const HAIR_QUESTIONS = {
  type: ['Vos cheveux sont…', HAIR],
  length: ['Leur longueur', LENGTHS],
  thick: ['Leur épaisseur', { fins: 'Fins', moyens: 'Moyens', epais: 'Épais', nsp: 'Je ne sais pas' }],
  state: ['Ils sont…', { naturel: 'Naturels', colores: 'Colorés ou méchés', defrises: 'Défrisés ou lissés', abimes: 'Abîmés ou cassants', locks: 'En locks' }],
  porosity: ['Après le lavage, ils sèchent…', { vite: 'Très vite (porosité forte)', normal: 'Normalement', lent: "Lentement, l'eau perle (porosité faible)", nsp: 'Je ne sais pas' }],
  goal: ['Votre objectif', { entretien: 'Entretenir, couper les pointes', definition: 'Définir mes boucles', protection: 'Une coiffure protectrice', transition: 'Revenir au naturel', couleur: 'Changer de couleur' }],
};

/** « Bouclés, mi-longs, naturels · objectif : définir mes boucles » */
export function hairText(p) {
  if (!p || !p.type) return '';
  const parts = [];
  for (const k of ['type', 'length', 'thick', 'state']) {
    const v = p[k];
    if (v && v !== 'nsp' && HAIR_QUESTIONS[k][1][v]) parts.push(HAIR_QUESTIONS[k][1][v].toLowerCase());
  }
  if (p.porosity === 'vite') parts.push('porosité forte');
  if (p.porosity === 'lent') parts.push('porosité faible');
  let t = parts.join(', ');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (p.goal && HAIR_QUESTIONS.goal[1][p.goal]) t += ' · objectif : ' + HAIR_QUESTIONS.goal[1][p.goal].toLowerCase();
  return t;
}

export const euro = (n) => `${n} €`;
export function fmtDur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
export function minPrice(services) {
  return services && services.length ? Math.min(...services.map((s) => s.price)) : null;
}
export function hasPlus(s) {
  return s && s.plus && Object.keys(s.plus).length > 0;
}
