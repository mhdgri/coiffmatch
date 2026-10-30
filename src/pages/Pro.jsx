import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorNote, Loading, Stars, useTitle } from '../components';
import { api } from '../lib/api';
import { DIPLOMAS, HAIR, LENGTHS, SKILLS, fmtDur, hasPlus, minPrice } from '../lib/constants';
import { dateLabel, nextSlot } from '../lib/slots';

export default function Pro() {
  const { id } = useParams();
  const [pro, setPro] = useState(undefined);
  const [busy, setBusy] = useState([]);
  const [error, setError] = useState('');
  const [revHair, setRevHair] = useState('');
  useTitle(pro ? pro.name : 'Coiffeur');

  useEffect(() => {
    Promise.all([api.getPro(id), api.busy(id)])
      .then(([p, b]) => {
        setPro(p);
        setBusy(b);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const slot = useMemo(() => (pro ? nextSlot(pro, busy) : null), [pro, busy]);

  if (error) return <div className="wrap page"><ErrorNote error={error} /></div>;
  if (pro === undefined) return <div className="wrap page"><Loading /></div>;
  if (!pro) return <div className="wrap page"><h1>Ce coiffeur n'existe pas ou n'est plus en ligne.</h1><Link to="/coiffeurs">Voir les autres coiffeurs</Link></div>;

  const reviews = revHair ? pro.reviews.filter((r) => r.hair === revHair) : pro.reviews;
  const revHairs = [...new Set(pro.reviews.map((r) => r.hair).filter(Boolean))];
  const from = minPrice(pro.services);

  return (
    <>
      <section className="pro-head">
        <div className="wrap pro-head__in">
          <div>
            <p className="small" style={{ marginBottom: 8 }}><Link to="/coiffeurs" style={{ color: 'var(--on-ink-muted)' }}>← Tous les coiffeurs</Link></p>
            <h1>{pro.name}</h1>
            <p>{pro.mode === 'domicile' ? `À domicile · ${pro.zones || pro.city}` : `En salon · ${pro.address || pro.city}`}</p>
            <div className="pills" style={{ marginTop: 12 }}>
              {pro.verified ? <span className="pill pill--ok">Diplôme vérifié</span> : <span className="pill">Diplôme en cours de vérification</span>}
              {pro.is_example && <span className="pill">Profil d'exemple</span>}
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <Stars rating={pro.rating} count={pro.count} light />
          </div>
        </div>
      </section>

      <div className="wrap pro-body">
        <div>
          <section className="block" aria-labelledby="t-hair">
            <h2 id="t-hair">Ses cheveux de prédilection</h2>
            <div className="pills" style={{ marginBottom: 14 }}>
              {pro.hair.map((h) => <span key={h} className="pill" style={{ fontSize: 15, padding: '6px 12px' }}>{HAIR[h]}</span>)}
            </div>
            {pro.skills?.length > 0 && (
              <>
                <h3>Savoir-faire</h3>
                <ul style={{ margin: '0 0 14px', paddingLeft: '1.2em' }}>{pro.skills.map((s) => <li key={s}>{SKILLS[s]}</li>)}</ul>
              </>
            )}
            {pro.bio && <p style={{ margin: 0 }}>{pro.bio}</p>}
          </section>

          <section className="block" aria-labelledby="t-presta">
            <h2 id="t-presta">Prestations et prix</h2>
            <ul className="prestas">
              {pro.services.map((s) => (
                <li key={s.id}>
                  <span>
                    {s.label}
                    <small>{fmtDur(s.duration)}{hasPlus(s) ? ' · ' + Object.entries(s.plus).map(([k, v]) => `+${v} € cheveux ${LENGTHS[k].toLowerCase()}`).join(', ') : ''}</small>
                  </span>
                  <b>{hasPlus(s) ? `dès ${s.price} €` : `${s.price} €`}</b>
                </li>
              ))}
            </ul>
            {pro.mode === 'domicile' && pro.travel > 0 && <p className="small muted" style={{ margin: '12px 0 0' }}>Frais de déplacement : {pro.travel} €, payés sur place.</p>}
          </section>

          {pro.photos?.length > 0 && (
            <section className="block" aria-labelledby="t-photos">
              <h2 id="t-photos">Réalisations</h2>
              <div className="gallery">{pro.photos.map((u, i) => <img key={u} src={u} alt={`Réalisation ${i + 1} de ${pro.name}`} loading="lazy" />)}</div>
            </section>
          )}

          {pro.staff?.length > 0 && (
            <section className="block" aria-labelledby="t-team">
              <h2 id="t-team">L'équipe</h2>
              <ul className="prestas">
                {pro.staff.map((m) => (
                  <li key={m.k}>
                    <span>{m.name}<small>{m.services?.length ? m.services.map((sid) => pro.services.find((s) => s.id === sid)?.label).filter(Boolean).join(', ') : 'Toutes les prestations'}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="block" aria-labelledby="t-rev">
            <h2 id="t-rev">Avis</h2>
            {pro.count ? (
              <>
                <div className="score"><b>{Number(pro.rating).toFixed(1).replace('.', ',')}</b><span className="muted">sur 5 · {pro.count} avis</span></div>
                {revHairs.length > 1 && (
                  <div className="chips" style={{ margin: '14px 0' }} role="group" aria-label="Filtrer les avis par type de cheveux">
                    <label className="chip"><input type="radio" name="rh" checked={!revHair} onChange={() => setRevHair('')} /><span>Tous</span></label>
                    {revHairs.map((h) => (
                      <label key={h} className="chip"><input type="radio" name="rh" checked={revHair === h} onChange={() => setRevHair(h)} /><span>Cheveux {HAIR[h]?.toLowerCase()}</span></label>
                    ))}
                  </div>
                )}
                <ul className="reviews" style={{ marginTop: 14 }}>
                  {reviews.map((r) => (
                    <li key={r.id}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="stars" aria-label={`${r.rating} sur 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <b>{r.client_name}</b>
                        {r.hair && <span className="muted small">cheveux {HAIR[r.hair]?.toLowerCase()}</span>}
                        <span className="muted small">· {new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                        {r.is_example ? <span className="pill pill--gold">Avis d'exemple</span> : <span className="pill pill--ok">Rendez-vous vérifié</span>}
                      </div>
                      {r.body && <p>{r.body}</p>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Pas encore d'avis. Seules les clientes qui ont eu un rendez-vous peuvent en laisser un.</p>
            )}
          </section>
        </div>

        <aside className="pro-aside" aria-label="Réserver">
          {from !== null && <p style={{ margin: 0 }}><span className="muted">Prestations dès</span> <b style={{ fontSize: 22 }}>{from} €</b></p>}
          <p className="small" style={{ margin: 0 }}>{slot ? <>Prochain créneau : <b>{dateLabel(slot.date)} à {slot.h}</b></> : 'Aucun créneau libre dans les 14 prochains jours.'}</p>
          <Link to={`/reserver/${pro.id}`} className="btn btn--gold btn--block">Réserver</Link>
          <p className="small muted" style={{ margin: 0 }}>Paiement sur place. Annulation gratuite jusqu'à 24 h avant.</p>
          {pro.diploma && <p className="small muted" style={{ margin: 0 }}>Diplôme : {DIPLOMAS[pro.diploma] || pro.diploma}</p>}
        </aside>
      </div>
    </>
  );
}
