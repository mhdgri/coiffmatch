import { Link } from 'react-router-dom';
import { useTitle } from '../components';
import { HAIR } from '../lib/constants';

const HINT = { raides: 'Lisses, sans volume', ondules: 'En S, légers', boucles: 'Anglaises, ressorts', frises: 'Petites boucles serrées', crepus: 'Très serrés, en zigzag' };

export default function Home() {
  useTitle('');
  return (
    <>
      <section className="hero">
        <svg className="hero__strands" viewBox="0 0 400 400" aria-hidden="true" fill="none" stroke="#E2B864" strokeWidth="3" strokeLinecap="round">
          <path d="M60 0v400" /><path d="M140 0c-30 40 30 80 0 120s30 80 0 120 30 80 0 120" />
          <path d="M220 0c-25 12-25 30 0 36s25 24 0 36-25 30 0 36 25 24 0 36-25 30 0 36 25 24 0 36-25 30 0 36 25 24 0 36-25 30 0 36 25 24 0 36" />
          <path d="M300 0l-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14 14 14-14 14" />
        </svg>
        <div className="wrap hero__in">
          <h1>Le coiffeur qui connaît vos cheveux.</h1>
          <p className="hero__lead">Choisissez votre type de cheveux : on vous montre les coiffeurs qui le maîtrisent, leurs réalisations et les avis de clientes aux cheveux comme les vôtres. Réservez en quelques minutes.</p>
          <p className="hero__ask">Vos cheveux sont…</p>
          <ul className="spectrum">
            {Object.entries(HAIR).map(([k, label]) => (
              <li key={k}>
                <Link to={`/coiffeurs?hair=${k}`}>
                  <img src={`/hair/${k}.svg`} alt="" width="110" height="110" />
                  <strong>{label}</strong>
                  <span>{HINT[k]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0 }}>
            <Link to="/mon-compte?diag=1" style={{ color: 'var(--gold)', fontWeight: 600 }}>Je ne sais pas : faire ma fiche cheveux en 6 questions</Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Comment ça marche</h2>
          <ol className="steps">
            <li><h3>Vos cheveux</h3><p>Indiquez votre type de cheveux et la prestation souhaitée.</p></li>
            <li><h3>Votre coiffeur</h3><p>Comparez réalisations, savoir-faire, prix et avis de clientes aux mêmes cheveux.</p></li>
            <li><h3>Votre créneau</h3><p>Choisissez le jour et l'heure. Le coiffeur confirme, vous payez sur place. Annulation gratuite jusqu'à 24 h avant.</p></li>
          </ol>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <div className="cta">
            <div>
              <h2>Vous êtes coiffeur ?</h2>
              <p>Un profil gratuit, sans commission, vu par les clientes qui ont les cheveux que vous maîtrisez.</p>
            </div>
            <Link to="/devenir-partenaire" className="btn btn--gold">Devenir partenaire</Link>
          </div>
        </div>
      </section>
    </>
  );
}
