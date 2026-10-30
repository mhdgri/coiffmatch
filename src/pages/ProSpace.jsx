import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorNote, Loading, Status, useTitle } from '../components';
import { api } from '../lib/api';
import { ALL_HOURS, DAY_NAMES, DEFAULT_HOURS, DIPLOMAS, HAIR, LENGTHS, SERVICES, SKILLS, fmtDur, hairText } from '../lib/constants';
import { dateLabel, isoDate } from '../lib/slots';

const startOf = (b) => {
  const [y, m, d] = b.day.split('-').map(Number);
  const [h, mi] = b.hour.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
};

function blankPro(name) {
  const hours = {};
  for (let d = 0; d < 7; d++) hours[d] = d === 0 ? [] : [...DEFAULT_HOURS];
  return { id: null, name: name || '', mode: 'salon', city: '', address: '', zones: '', travel: 0, hair: [], skills: [], tags: [], diploma: '', bio: '', hours, closed: [], staff: [], photos: [], published: true };
}
const blankService = () => ({ id: null, label: '', service: 'coupe', duration: 60, price: 40, plus: {} });
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Requests({ list, onChange }) {
  const [error, setError] = useState('');
  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e.message);
    }
  };
  const now = new Date();
  const pending = list.filter((b) => b.status === 'pending' && startOf(b) > now);
  const coming = list.filter((b) => b.status === 'confirmed' && startOf(b) > now);
  const today = isoDate(now);
  const Item = ({ b, actions }) => (
    <li className="bk">
      <div className="bk__top"><b>{dateLabel(b.day, true)} à {b.hour}</b><Status s={b.status} /></div>
      <p><b style={{ color: 'var(--fg)' }}>{b.client_name}</b> · {b.label}{b.staff_name ? ` · avec ${b.staff_name}` : ''}{b.length ? ` · cheveux ${LENGTHS[b.length]?.toLowerCase()}` : ''} · {fmtDur(b.dur)} · {b.price} €</p>
      {hairText(b.hair) && <p>Ses cheveux : {hairText(b.hair)}</p>}
      {b.address && <p>Adresse : {b.address}</p>}
      {b.client_phone && <p>Téléphone : {b.client_phone}</p>}
      {b.notes && <p>« {b.notes} »</p>}
      {actions}
    </li>
  );
  return (
    <div className="stack">
      <ErrorNote error={error} />
      <div className="stat">
        <div><b>{pending.length}</b><span>Demandes à traiter</span></div>
        <div><b>{coming.filter((b) => b.day === today).length}</b><span>Rendez-vous aujourd'hui</span></div>
        <div><b>{coming.length}</b><span>Rendez-vous à venir</span></div>
      </div>
      <h2 style={{ fontSize: 26, margin: 0 }}>Demandes à traiter</h2>
      {pending.length ? (
        <ul className="bookings">
          {pending.map((b) => (
            <Item key={b.id} b={b} actions={
              <div className="row">
                <button type="button" className="btn btn--small" onClick={() => run(() => api.setStatus(b.id, 'confirmed'))}>Accepter</button>
                <button type="button" className="btn btn--danger btn--small" onClick={() => run(() => api.setStatus(b.id, 'refused'))}>Refuser</button>
              </div>
            } />
          ))}
        </ul>
      ) : <p className="muted">Aucune demande en attente.</p>}
      <h2 style={{ fontSize: 26, margin: '8px 0 0' }}>Rendez-vous confirmés</h2>
      {coming.length ? (
        <ul className="bookings">
          {coming.map((b) => (
            <Item key={b.id} b={b} actions={<div><button type="button" className="btn btn--ghost btn--small" onClick={() => run(() => api.cancel(b.id))}>Annuler ce rendez-vous</button></div>} />
          ))}
        </ul>
      ) : <p className="muted">Aucun rendez-vous à venir.</p>}
    </div>
  );
}

function ProfileForm({ initial, onSaved, justSaved }) {
  const [p, setP] = useState(initial.pro);
  const [services, setServices] = useState(initial.services.length ? initial.services : [blankService()]);
  const [closedDay, setClosedDay] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(!!justSaved);
  const [busy, setBusy] = useState(false);
  const up = (patch) => {
    setP({ ...p, ...patch });
    setSaved(false);
  };
  const upS = (i, patch) => {
    setServices(services.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setSaved(false);
  };

  async function addPhotos(files) {
    setError('');
    try {
      const urls = [];
      for (const f of [...files].slice(0, 6 - p.photos.length)) {
        if (!f.type.startsWith('image/')) throw new Error('Seules les images sont acceptées.');
        if (f.size > 5e6) throw new Error('Chaque photo doit faire moins de 5 Mo.');
        urls.push(await api.uploadPhoto(f));
      }
      up({ photos: [...p.photos, ...urls] });
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!p.hair.length) return setError('Choisissez au moins un type de cheveux que vous maîtrisez.');
    if (!services.length || services.some((s) => s.label.trim().length < 2)) return setError('Chaque prestation doit avoir un nom.');
    if (p.mode === 'salon' && p.address.trim().length < 5) return setError("Indiquez l'adresse du salon.");
    setBusy(true);
    try {
      const clean = services.map((s) => ({ ...s, label: s.label.trim(), duration: Number(s.duration) || 60, price: Number(s.price) || 0, plus: Object.fromEntries(Object.entries(s.plus || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }));
      const staff = p.staff.filter((m) => m.name.trim()).map((m) => ({ ...m, name: m.name.trim() }));
      const id = await api.saveMyPro({ ...p, staff, tags: p.tags.filter(Boolean) }, clean);
      setSaved(true);
      onSaved(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save} noValidate>
      <section className="block stack">
        <h2>Votre activité</h2>
        <label className="field"><span>Nom affiché</span><input type="text" required value={p.name} onChange={(e) => up({ name: e.target.value })} placeholder="Ex. Lina coiffure ou Salon Les Boucles" /></label>
        <fieldset>
          <legend>Vous coiffez…</legend>
          <div className="chips">
            {[['salon', 'En salon'], ['domicile', 'À domicile']].map(([k, l]) => (
              <label key={k} className="chip"><input type="radio" name="mode" checked={p.mode === k} onChange={() => up({ mode: k })} /><span>{l}</span></label>
            ))}
          </div>
        </fieldset>
        <div className="grid2">
          <label className="field"><span>Ville ou arrondissement</span><input type="text" required value={p.city} onChange={(e) => up({ city: e.target.value })} placeholder="Ex. Paris 11e" /></label>
          {p.mode === 'salon' ? (
            <label className="field"><span>Adresse du salon</span><input type="text" value={p.address} onChange={(e) => up({ address: e.target.value })} /></label>
          ) : (
            <label className="field"><span>Frais de déplacement (€)</span><input type="number" min="0" max="100" value={p.travel} onChange={(e) => up({ travel: Number(e.target.value) })} /></label>
          )}
        </div>
        {p.mode === 'domicile' && <label className="field"><span>Villes où vous vous déplacez</span><input type="text" value={p.zones} onChange={(e) => up({ zones: e.target.value })} placeholder="Ex. Montreuil, Bagnolet, Paris 20e" /></label>}
        <label className="field"><span>Diplôme</span>
          <select value={p.diploma} onChange={(e) => up({ diploma: e.target.value })}>{Object.entries(DIPLOMAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <small>Le badge « Diplôme vérifié » est ajouté après contrôle par l'équipe Coiff'Match.</small>
        </label>
        <label className="field"><span>Présentation</span><textarea maxLength={1200} value={p.bio} onChange={(e) => up({ bio: e.target.value })} placeholder="Votre expérience, votre façon de travailler" /></label>
      </section>

      <section className="block stack">
        <h2>Les cheveux que vous maîtrisez</h2>
        <div className="chips" role="group" aria-label="Types de cheveux">
          {Object.entries(HAIR).map(([k, l]) => (
            <label key={k} className="chip"><input type="checkbox" checked={p.hair.includes(k)} onChange={() => up({ hair: toggle(p.hair, k) })} /><span>{l}</span></label>
          ))}
        </div>
        <fieldset>
          <legend>Savoir-faire (6 au plus)</legend>
          <div className="chips">
            {Object.entries(SKILLS).map(([k, l]) => (
              <label key={k} className="chip"><input type="checkbox" checked={p.skills.includes(k)} disabled={!p.skills.includes(k) && p.skills.length >= 6} onChange={() => up({ skills: toggle(p.skills, k) })} /><span>{l}</span></label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="block stack">
        <h2>Prestations et prix</h2>
        {services.map((s, i) => (
          <div key={s.id || `n${i}`} className="srv">
            <div className="srv__row">
              <label className="field"><span>Nom</span><input type="text" value={s.label} onChange={(e) => upS(i, { label: e.target.value })} placeholder="Ex. Coupe sur boucles" /></label>
              <label className="field"><span>Type</span><select value={s.service} onChange={(e) => upS(i, { service: e.target.value })}>{Object.entries(SERVICES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field"><span>Durée (min)</span><input type="number" min="15" max="600" step="15" value={s.duration} onChange={(e) => upS(i, { duration: e.target.value })} /></label>
              <label className="field"><span>Prix (€)</span><input type="number" min="0" max="2000" value={s.price} onChange={(e) => upS(i, { price: e.target.value })} /></label>
            </div>
            <details open={Object.keys(s.plus || {}).length > 0}>
              <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Supplément selon la longueur</summary>
              <div className="row" style={{ marginTop: 10 }}>
                {['mi-long', 'long'].map((k) => (
                  <label key={k} className="field" style={{ width: 160 }}><span>Cheveux {LENGTHS[k].toLowerCase()} (+ €)</span>
                    <input type="number" min="0" max="500" value={s.plus?.[k] || ''} onChange={(e) => upS(i, { plus: { ...s.plus, [k]: e.target.value } })} />
                  </label>
                ))}
              </div>
            </details>
            {services.length > 1 && <div><button type="button" className="link" onClick={() => setServices(services.filter((_, j) => j !== i))}>Supprimer cette prestation</button></div>}
          </div>
        ))}
        <div><button type="button" className="btn btn--ghost btn--small" onClick={() => setServices([...services, blankService()])}>+ Ajouter une prestation</button></div>
      </section>

      <section className="block stack">
        <h2>Horaires</h2>
        <p className="muted small" style={{ margin: 0 }}>Cochez les heures de début de rendez-vous que vous proposez chaque jour.</p>
        <div className="week">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="week__day">
              <b>{DAY_NAMES[d]}</b>
              <div className="chips" role="group" aria-label={DAY_NAMES[d]}>
                {ALL_HOURS.map((h) => {
                  const on = (p.hours[d] || []).includes(h);
                  return (
                    <label key={h} className="chip"><input type="checkbox" checked={on} onChange={() => up({ hours: { ...p.hours, [d]: ALL_HOURS.filter((x) => (x === h ? !on : (p.hours[d] || []).includes(x))) } })} /><span>{h}</span></label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <b>Jours de fermeture exceptionnelle</b>
          <div className="row">
            <label className="field" style={{ width: 200 }}><span className="sr">Date</span><input type="date" min={isoDate(new Date())} value={closedDay} onChange={(e) => setClosedDay(e.target.value)} /></label>
            <button type="button" className="btn btn--ghost btn--small" disabled={!closedDay} onClick={() => { up({ closed: [...new Set([...p.closed, closedDay])].sort() }); setClosedDay(''); }}>Ajouter</button>
          </div>
          {p.closed.length > 0 && (
            <div className="pills">{p.closed.map((d) => (
              <span key={d} className="pill pill--muted">{dateLabel(d)} <button type="button" className="link" style={{ minHeight: 0 }} aria-label={`Retirer le ${dateLabel(d)}`} onClick={() => up({ closed: p.closed.filter((x) => x !== d) })}>×</button></span>
            ))}</div>
          )}
        </div>
      </section>

      <section className="block stack">
        <h2>Votre équipe</h2>
        <p className="muted small" style={{ margin: 0 }}>Facultatif. Si vous travaillez à plusieurs, la cliente pourra choisir avec qui.</p>
        {p.staff.map((m, i) => {
          const setM = (patch) => up({ staff: p.staff.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={m.k} className="srv">
              <label className="field"><span>Prénom</span><input type="text" value={m.name} onChange={(e) => setM({ name: e.target.value })} /></label>
              <fieldset><legend>Jours de travail</legend>
                <div className="chips">{[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d} className="chip"><input type="checkbox" checked={m.days.includes(String(d))} onChange={() => setM({ days: toggle(m.days, String(d)) })} /><span>{DAY_NAMES[d].slice(0, 3)}.</span></label>
                ))}</div>
              </fieldset>
              {services.some((s) => s.id) && (
                <fieldset><legend>Prestations (aucune cochée = toutes)</legend>
                  <div className="chips">{services.filter((s) => s.id).map((s) => (
                    <label key={s.id} className="chip"><input type="checkbox" checked={(m.services || []).includes(s.id)} onChange={() => setM({ services: toggle(m.services || [], s.id) })} /><span>{s.label}</span></label>
                  ))}</div>
                </fieldset>
              )}
              <div><button type="button" className="link" onClick={() => up({ staff: p.staff.filter((_, j) => j !== i) })}>Retirer {m.name || 'cette personne'}</button></div>
            </div>
          );
        })}
        <div><button type="button" className="btn btn--ghost btn--small" onClick={() => up({ staff: [...p.staff, { k: `s${Date.now().toString(36)}`, name: '', services: [], days: ['2', '3', '4', '5', '6'] }] })}>+ Ajouter une personne</button></div>
      </section>

      <section className="block stack">
        <h2>Réalisations</h2>
        <p className="muted small" style={{ margin: 0 }}>Jusqu'à 6 photos de votre travail. C'est ce que les clientes regardent en premier.</p>
        {p.photos.length > 0 && (
          <div className="thumbs">{p.photos.map((u, i) => (
            <div key={u} className="thumb"><img src={u} alt={`Réalisation ${i + 1}`} /><button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => { api.removePhoto(u); up({ photos: p.photos.filter((x) => x !== u) }); }}>×</button></div>
          ))}</div>
        )}
        {p.photos.length < 6 && <label className="field"><span>Ajouter des photos</span><input type="file" accept="image/*" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} /></label>}
      </section>

      <section className="block stack">
        <label className="chip" style={{ alignSelf: 'flex-start' }}><input type="checkbox" checked={p.published} onChange={() => up({ published: !p.published })} /><span>{p.published ? 'Profil visible par les clientes' : 'Profil masqué'}</span></label>
        <ErrorNote error={error} />
        <div className="row">
          <button type="submit" className="btn btn--gold" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer mon profil'}</button>
          {saved && <span className="pill pill--ok" role="status">Profil enregistré</span>}
          {p.id && <Link to={`/coiffeur/${p.id}`}>Voir mon profil public</Link>}
        </div>
      </section>
    </form>
  );
}

export default function ProSpace() {
  useTitle('Espace coiffeur');
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState(undefined);
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(0);

  const load = async () => {
    try {
      const p = await api.myPro();
      setMine(p);
      if (p) setList(await api.proBookings());
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (profile?.role === 'pro') load();
  }, [profile]);  

  if (loading) return <div className="wrap page"><Loading /></div>;
  if (!user) return <Navigate to="/connexion?next=%2Fespace-coiffeur&role=pro" replace />;
  if (!profile) return <div className="wrap page"><Loading /></div>;
  if (profile.role !== 'pro') {
    return (
      <div className="wrap narrow page">
        <h1 style={{ fontSize: 38 }}>Espace réservé aux coiffeurs</h1>
        <p>Vous êtes connectée avec un compte cliente. Pour proposer vos prestations, créez un compte coiffeur avec une autre adresse e-mail.</p>
        <button type="button" className="btn" onClick={async () => { await api.signOut(); nav('/connexion?tab=signup&role=pro'); }}>Me déconnecter et créer un compte coiffeur</button>
      </div>
    );
  }
  if (mine === undefined) return <div className="wrap page"><Loading /></div>;

  const tab = !mine ? 'profil' : params.get('tab') || 'demandes';
  const initial = mine
    ? { pro: { ...blankPro(), ...mine }, services: mine.services }
    : { pro: blankPro(profile.name), services: [] };
  const pending = list.filter((b) => b.status === 'pending' && startOf(b) > new Date()).length;

  return (
    <div className="wrap page" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 40 }}>{mine ? mine.name : `Bienvenue ${profile.name}`}</h1>
      {!mine && <p className="note note--gold">Remplissez votre profil pour apparaître dans les résultats. Vous pourrez le modifier à tout moment.</p>}
      {mine && (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'demandes'} onClick={() => setParams({})}>Rendez-vous{pending ? ` (${pending})` : ''}</button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'profil'} onClick={() => setParams({ tab: 'profil' })}>Mon profil</button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'compte'} onClick={() => setParams({ tab: 'compte' })}>Compte</button>
        </div>
      )}
      <ErrorNote error={error} />
      {tab === 'demandes' && <Requests list={list} onChange={load} />}
      {tab === 'profil' && <ProfileForm key={`${mine?.id || 'new'}-${flash}`} initial={initial} justSaved={flash} onSaved={async () => { setFlash(Date.now()); await load(); setParams({ tab: 'profil' }); }} />}
      {tab === 'compte' && (
        <div className="block stack">
          <p style={{ margin: 0 }}>Connecté avec {profile.email}</p>
          <div><button type="button" className="btn btn--ghost" onClick={async () => { await api.signOut(); nav('/'); }}>Me déconnecter</button></div>
        </div>
      )}
    </div>
  );
}
