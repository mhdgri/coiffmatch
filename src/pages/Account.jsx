import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorNote, HairDiag, Loading, Status, useTitle } from '../components';
import { api } from '../lib/api';
import { HAIR, LENGTHS, hairText } from '../lib/constants';
import { dateLabel } from '../lib/slots';

const startOf = (b) => {
  const [y, m, d] = b.day.split('-').map(Number);
  const [h, mi] = b.hour.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
};

function Booking({ b, onChange }) {
  const [ask, setAsk] = useState(false);
  const [rev, setRev] = useState({ open: false, rating: 0, body: '' });
  const [error, setError] = useState('');
  const past = startOf(b) < new Date();
  const canCancel = !past && ['pending', 'confirmed'].includes(b.status);
  const late = startOf(b) - new Date() < 24 * 3600e3;

  async function run(fn) {
    setError('');
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <li className="bk">
      <div className="bk__top">
        <b>{dateLabel(b.day, true)} à {b.hour}</b>
        <Status s={b.status} />
      </div>
      <p><Link to={`/coiffeur/${b.pro_id}`}>{b.pro?.name || 'Coiffeur'}</Link> · {b.label}{b.staff_name ? ` avec ${b.staff_name}` : ''}{b.length ? ` · cheveux ${LENGTHS[b.length]?.toLowerCase()}` : ''} · {b.price} €</p>
      <p>{b.pro?.mode === 'domicile' ? `À domicile : ${b.address}` : b.pro?.address || b.pro?.city}</p>
      <ErrorNote error={error} />
      {canCancel && !ask && <div><button type="button" className="btn btn--ghost btn--small" onClick={() => setAsk(true)}>Annuler ce rendez-vous</button></div>}
      {ask && (
        <div className="note stack" style={{ gap: 10 }}>
          {late ? <span>Il reste moins de 24 h : l'annulation en ligne n'est plus possible. Contactez directement le coiffeur.</span> : <span>Annuler le rendez-vous du {dateLabel(b.day)} à {b.hour} ?</span>}
          <div className="row">
            {!late && <button type="button" className="btn btn--danger btn--small" onClick={() => run(() => api.cancel(b.id))}>Oui, annuler</button>}
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setAsk(false)}>Garder le rendez-vous</button>
          </div>
        </div>
      )}
      {past && b.status === 'confirmed' && !b.reviewed && !rev.open && (
        <div><button type="button" className="btn btn--gold btn--small" onClick={() => setRev({ ...rev, open: true })}>Donner mon avis</button></div>
      )}
      {past && b.reviewed && <p className="small">Merci pour votre avis.</p>}
      {rev.open && (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); run(() => api.review(b.id, rev.rating, rev.body)); }}>
          <fieldset>
            <legend>Votre note</legend>
            <div className="rate">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={rev.rating >= n} aria-label={`${n} sur 5`} onClick={() => setRev({ ...rev, rating: n })}>★</button>
              ))}
            </div>
          </fieldset>
          <label className="field"><span>Votre avis</span><textarea maxLength={800} value={rev.body} onChange={(e) => setRev({ ...rev, body: e.target.value })} placeholder="Le résultat, l'écoute, le respect de vos cheveux…" /></label>
          <div className="row">
            <button type="submit" className="btn btn--small" disabled={!rev.rating}>Publier mon avis</button>
            <button type="button" className="link" onClick={() => setRev({ open: false, rating: 0, body: '' })}>Annuler</button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function Account() {
  useTitle('Mon compte');
  const { user, profile, refresh, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const tab = params.get('diag') ? 'hair' : params.get('tab') || 'rdv';

  const load = () => api.myBookings().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    if (user && profile?.role === 'client') load();
    if (profile) setName(profile.name);
  }, [user, profile]);  

  // Fiche cheveux sans compte : on cherche directement les coiffeurs.
  if (!loading && !user && params.get('diag')) {
    return (
      <div className="wrap narrow page">
        <h1 style={{ fontSize: 40 }}>Ma fiche cheveux</h1>
        <p className="muted">6 questions pour trouver les coiffeurs qui maîtrisent vos cheveux.</p>
        <HairDiag onCancel={() => nav('/')} onDone={(h) => nav(`/coiffeurs?hair=${h.type}${h.goal === 'protection' ? '&service=tresses' : h.goal === 'couleur' ? '&service=couleur' : ''}`)} />
      </div>
    );
  }
  if (loading) return <div className="wrap page"><Loading /></div>;
  if (!user) return <Navigate to={`/connexion?next=${encodeURIComponent('/mon-compte')}`} replace />;
  if (!profile) return <div className="wrap page"><Loading /></div>;
  if (profile.role === 'pro') return <Navigate to="/espace-coiffeur" replace />;

  const upcoming = (list || []).filter((b) => startOf(b) >= new Date() && ['pending', 'confirmed'].includes(b.status));
  const others = (list || []).filter((b) => !upcoming.includes(b)).reverse();
  const setTab = (t) => setParams(t === 'rdv' ? {} : { tab: t });

  return (
    <div className="wrap narrow page">
      <h1 style={{ fontSize: 40 }}>Bonjour {profile.name}</h1>
      <div className="tabs" role="tablist">
        {[['rdv', 'Mes rendez-vous'], ['hair', 'Ma fiche cheveux'], ['me', 'Mon profil']].map(([k, l]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <ErrorNote error={error} />

      {tab === 'rdv' && (
        <section className="stack" aria-label="Mes rendez-vous">
          {!list ? <Loading /> : (
            <>
              <h2 style={{ fontSize: 26, margin: 0 }}>À venir</h2>
              {upcoming.length ? <ul className="bookings">{upcoming.map((b) => <Booking key={b.id} b={b} onChange={load} />)}</ul> : (
                <div className="empty"><p>Aucun rendez-vous à venir.</p><Link to={profile.hair?.type ? `/coiffeurs?hair=${profile.hair.type}` : '/coiffeurs'} className="btn">Trouver un coiffeur</Link></div>
              )}
              {others.length > 0 && (
                <>
                  <h2 style={{ fontSize: 26, margin: '12px 0 0' }}>Passés et annulés</h2>
                  <ul className="bookings">{others.map((b) => <Booking key={b.id} b={b} onChange={load} />)}</ul>
                </>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'hair' && (
        <section className="stack">
          {params.get('diag') || !profile.hair?.type ? (
            <HairDiag value={profile.hair} onCancel={profile.hair?.type ? () => setParams({ tab: 'hair' }) : undefined}
              onDone={async (h) => { await api.updateProfile({ hair: h }); await refresh(); setParams({ tab: 'hair' }); }} />
          ) : (
            <div className="block stack" style={{ gap: 10 }}>
              <div className="row"><img src={`/hair/${profile.hair.type}.svg`} alt="" width="64" height="64" /><b style={{ fontSize: 20 }}>{hairText(profile.hair)}</b></div>
              <p className="muted" style={{ margin: 0 }}>Votre fiche est transmise au coiffeur quand vous réservez.</p>
              <div className="row">
                <Link className="btn" to={`/coiffeurs?hair=${profile.hair.type}`}>Coiffeurs pour cheveux {HAIR[profile.hair.type].toLowerCase()}</Link>
                <button type="button" className="btn btn--ghost" onClick={() => setParams({ tab: 'hair', diag: '1' })}>Refaire ma fiche</button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'me' && (
        <section className="stack">
          <form className="block stack" onSubmit={async (e) => { e.preventDefault(); try { await api.updateProfile({ name: name.trim() }); await refresh(); setSaved('Enregistré.'); } catch (err) { setError(err.message); } }}>
            <label className="field"><span>Prénom</span><input type="text" required minLength={2} value={name} onChange={(e) => { setName(e.target.value); setSaved(''); }} /></label>
            <p className="muted small" style={{ margin: 0 }}>E-mail : {profile.email}</p>
            <div className="row"><button type="submit" className="btn">Enregistrer</button>{saved && <span role="status" className="pill pill--ok">{saved}</span>}</div>
          </form>
          <div><button type="button" className="btn btn--ghost" onClick={async () => { await api.signOut(); nav('/'); }}>Me déconnecter</button></div>
        </section>
      )}
    </div>
  );
}
