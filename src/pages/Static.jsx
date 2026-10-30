import { Link } from 'react-router-dom';
import { useTitle } from '../components';

export function How() {
  useTitle('Comment ça marche');
  return (
    <div className="wrap page prose">
      <h1>Comment ça marche</h1>
      <p className="muted" style={{ fontSize: 19 }}>De vos cheveux au bon coiffeur, en trois étapes.</p>
      <h2>1. Vos cheveux</h2>
      <p>Indiquez votre type de cheveux (raides, ondulés, bouclés, frisés ou crépus). Si vous hésitez, la fiche cheveux vous guide en 6 questions.</p>
      <h2>2. Votre coiffeur</h2>
      <p>Comparez les profils : réalisations en photos, savoir-faire, tarifs et avis. Les avis viennent seulement de clientes qui ont eu un rendez-vous, et indiquent leur type de cheveux.</p>
      <h2>3. Votre créneau</h2>
      <p>Choisissez un jour et une heure, au salon ou à domicile. Le coiffeur confirme votre demande. Vous payez sur place, et l'annulation est gratuite jusqu'à 24 h avant.</p>
      <p><Link to="/coiffeurs" className="btn">Trouver un coiffeur</Link></p>
    </div>
  );
}

export function Partner() {
  useTitle('Devenir partenaire');
  return (
    <div className="wrap page prose">
      <h1>Devenir coiffeur partenaire</h1>
      <p className="muted" style={{ fontSize: 19 }}>Un profil gratuit, sans commission, vu par les clientes qui ont les cheveux que vous maîtrisez.</p>
      <ul>
        <li>Un profil centré sur vos réalisations et les types de cheveux que vous maîtrisez</li>
        <li>Vos horaires, votre équipe et vos jours de fermeture, gérés par vous</li>
        <li>Les demandes de rendez-vous à accepter ou refuser, avec la fiche cheveux de la cliente</li>
        <li>Des prix clairs, avec un supplément possible selon la longueur des cheveux</li>
      </ul>
      <p>La loi impose un diplôme pour exercer la coiffure en France (au minimum un CAP pour la coiffure à domicile). Le badge « Diplôme vérifié » est attribué après contrôle.</p>
      <p><Link to="/connexion?tab=signup&role=pro" className="btn btn--gold">Créer mon compte coiffeur</Link></p>
      <p className="small">Déjà inscrit ? <Link to="/connexion?next=%2Fespace-coiffeur">Connexion à l'espace coiffeur</Link></p>
    </div>
  );
}

export function Privacy() {
  useTitle('Confidentialité');
  return (
    <div className="wrap page prose">
      <h1>Confidentialité</h1>
      <p>Coiff'Match est un projet de formation. Les données servent seulement à faire fonctionner le service :</p>
      <ul>
        <li><b>Compte</b> : prénom, e-mail et mot de passe (chiffré, jamais visible).</li>
        <li><b>Fiche cheveux</b> : facultative, transmise au coiffeur choisi quand vous réservez.</li>
        <li><b>Rendez-vous</b> : visibles par vous et par le coiffeur concerné seulement. Les autres clientes voient uniquement qu'un créneau est pris.</li>
        <li><b>Téléphone et adresse</b> : facultatifs, transmis au seul coiffeur du rendez-vous.</li>
      </ul>
      <p>Aucune donnée n'est vendue ni utilisée pour de la publicité. Pour supprimer votre compte, écrivez à l'adresse indiquée par l'éditeur du site.</p>
    </div>
  );
}

export function NotFound() {
  useTitle('Page introuvable');
  return (
    <div className="wrap page">
      <h1>Cette page n'existe pas.</h1>
      <p><Link to="/">Retour à l'accueil</Link> ou <Link to="/coiffeurs">trouver un coiffeur</Link>.</p>
    </div>
  );
}
