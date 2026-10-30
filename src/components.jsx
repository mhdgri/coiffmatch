import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './lib/api';
import { HAIR, HAIR_QUESTIONS, hairText, SKILLS, minPrice } from './lib/constants';
import { dateLabel } from './lib/slots';

export function useTitle(t) {
  useEffect(() => {
    document.title = t ? `${t} – Coiff'Match` : "Coiff'Match – le coiffeur qui connaît vos cheveux";
  }, [t]);
}

export function Header() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  const isPro = profile?.role === 'pro';
  return (
    <>
      <a className="skip" href="#main">Aller au contenu</a>
      {api.mode === 'demo' && (
        <aside className="demo-bar" aria-label="Mode démo">
          Mode démo : les comptes et réservations sont gardés dans ce navigateur seulement.{' '}
          <button type="button" className="link" onClick={() => { api.reset(); window.location.href = '/'; }}>Remettre à zéro</button>
        </aside>
      )}
      <header className="header">
        <div className="wrap header__in">
          <Link to="/" className="brand" aria-label="Coiff'Match, accueil">
            <img src="/logo.svg" alt="" width="34" height="34" />
            <b>Coiff'Match</b>
          </Link>
          <button type="button" className="burger" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            <span aria-hidden="true">☰</span>
            <span className="sr">Menu</span>
          </button>
          <nav id="nav" className={`nav${open ? ' is-open' : ''}`} aria-label="Menu principal">
            <NavLink to="/coiffeurs">Trouver un coiffeur</NavLink>
            <NavLink to="/comment-ca-marche">Comment ça marche</NavLink>
            {!isPro && <NavLink to="/devenir-partenaire" className="nav__pro">Devenir partenaire</NavLink>}
            {user ? (
              <NavLink to={isPro ? '/espace-coiffeur' : '/mon-compte'} className="nav__account">
                {isPro ? 'Mon espace coiffeur' : 'Mon compte'}
              </NavLink>
            ) : (
              <NavLink to="/connexion" className="nav__account">Se connecter</NavLink>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__in">
        <div>
          <p className="footer__brand">Coiff'Match</p>
          <p>Le coiffeur qui connaît vos cheveux.</p>
        </div>
        <ul>
          <li><Link to="/coiffeurs">Trouver un coiffeur</Link></li>
          <li><Link to="/comment-ca-marche">Comment ça marche</Link></li>
          <li><Link to="/devenir-partenaire">Devenir partenaire</Link></li>
          <li><Link to="/confidentialite">Confidentialité</Link></li>
        </ul>
      </div>
      <div className="wrap"><p className="small" style={{ marginTop: 24, marginBottom: 0 }}>Projet de formation · profils et avis d'exemple signalés comme tels.</p></div>
    </footer>
  );
}

export function Stars({ rating, count, light }) {
  if (!count) return <span className={light ? '' : 'muted'}>Nouveau · pas encore d'avis</span>;
  return (
    <span className="stars" style={light ? { color: 'var(--gold)' } : undefined}>
      <span aria-hidden="true">★ </span>
      {Number(rating).toFixed(1).replace('.', ',')}
      <span className="sr"> sur 5</span> · {count} avis
    </span>
  );
}

export function ProPic({ pro }) {
  if (pro.photos && pro.photos[0]) return <img src={pro.photos[0]} alt="" loading="lazy" />;
  const h = pro.hair && pro.hair[0];
  return h ? <img className="illu" src={`/hair/${h}.svg`} alt="" /> : null;
}

export function ProCard({ pro, slot }) {
  const from = minPrice(pro.services);
  return (
    <li>
      <Link className="card" to={`/coiffeur/${pro.id}`}>
        <div className="card__pic"><ProPic pro={pro} /></div>
        <div className="card__body">
          <h2>{pro.name}</h2>
          <p className="card__meta">
            {pro.mode === 'domicile' ? 'À domicile' : 'En salon'} · {pro.city}
            {pro.mode === 'domicile' && pro.travel ? ` · déplacement ${pro.travel} €` : ''}
          </p>
          <div className="pills">
            {pro.verified && <span className="pill pill--ok">Diplôme vérifié</span>}
            {(pro.hair || []).map((h) => <span key={h} className="pill">{HAIR[h]}</span>)}
          </div>
          {pro.skills?.length > 0 && <p className="card__meta">{pro.skills.slice(0, 3).map((s) => SKILLS[s]).join(' · ')}</p>}
        </div>
        <div className="card__side">
          <Stars rating={pro.rating} count={pro.count} />
          {from !== null && <span className="card__price">dès {from} €</span>}
          <span className="card__slot">{slot ? `Prochain créneau : ${dateLabel(slot.date)}, ${slot.h}` : 'Pas de créneau sous 14 jours'}</span>
        </div>
      </Link>
    </li>
  );
}

/** Fiche cheveux : 6 questions, une à la fois. */
export function HairDiag({ value, onDone, onCancel }) {
  const keys = Object.keys(HAIR_QUESTIONS);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(value || {});
  const k = keys[step];
  const [q, opts] = HAIR_QUESTIONS[k];
  const pick = (v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    if (step < keys.length - 1) setStep(step + 1);
    else onDone(next);
  };
  return (
    <div className="block" role="group" aria-labelledby="diag-q">
      <p className="small muted" style={{ margin: 0 }}>Question {step + 1} sur {keys.length}</p>
      <h2 id="diag-q" style={{ fontSize: 26 }}>{q}</h2>
      <div className="opts">
        {Object.entries(opts).map(([v, label]) => (
          <button key={v} type="button" className="opt" aria-pressed={draft[k] === v} onClick={() => pick(v)}>
            {k === 'type' && <img src={`/hair/${v}.svg`} alt="" width="40" height="40" />}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        {step > 0 ? <button type="button" className="link" onClick={() => setStep(step - 1)}>← Question précédente</button> : <span />}
        {onCancel && <button type="button" className="link" onClick={onCancel}>Annuler</button>}
      </div>
      {draft.type && step === keys.length - 1 && <p className="small muted">Votre fiche : {hairText(draft)}</p>}
    </div>
  );
}

export function Loading() {
  return <p className="muted" role="status">Chargement…</p>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="note note--err" role="alert">{error}</p>;
}

export const STATUS = {
  pending: ['En attente de confirmation', 'pill--warn'],
  confirmed: ['Confirmé', 'pill--ok'],
  refused: ['Refusé', 'pill--err'],
  cancelled: ['Annulé', 'pill--muted'],
};
export function Status({ s }) {
  const [label, cls] = STATUS[s] || [s, ''];
  return <span className={`pill ${cls}`}>{label}</span>;
}
