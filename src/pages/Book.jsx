import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorNote, HairDiag, Loading, useTitle } from '../components';
import { api } from '../lib/api';
import { LENGTHS, fmtDur, hairText, hasPlus } from '../lib/constants';
import { availability, dateLabel } from '../lib/slots';

export default function Book() {
  useTitle('Réserver');
  const { id } = useParams();
  const { user, profile, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [pro, setPro] = useState(undefined);
  const [busy, setBusy] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [doneId, setDoneId] = useState(null);
  const [form, setForm] = useState({ phone: '', address: '', notes: '' });
  const [diag, setDiag] = useState(false);
  const headRef = useRef(null);

  const st = {
    service: params.get('service') || '',
    staff: params.get('staff') || '',
    length: params.get('length') || '',
    day: params.get('day') || '',
    hour: params.get('hour') || '',
    step: params.get('step') || '',
  };
  const set = (patch) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p);
  };

  const load = () => Promise.all([api.getPro(id), api.busy(id)]).then(([p, b]) => { setPro(p); setBusy(b); });
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, phone: f.phone || profile.phone || '' }));
    if (profile?.hair?.length && !st.length) set({ length: profile.hair.length });
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const srv = pro?.services.find((s) => s.id === st.service);
  const teamFor = (sid) => (pro?.staff || []).filter((m) => !m.services?.length || m.services.includes(sid));
  const needs = (s) => hasPlus(s);
  const team = teamFor(st.service);
  const needLength = hasPlus(srv);
  const days = useMemo(() => (pro && srv ? availability(pro, srv, busy, st.staff) : []), [pro, srv, busy, st.staff]);
  const day = days.find((d) => d.date === st.day);
  const price = srv ? srv.price + (needLength && st.length ? srv.plus[st.length] || 0 : 0) : 0;

  // Étapes affichées
  const steps = ['service', team.length > 1 ? 'staff' : null, needLength ? 'length' : null, 'when', 'you'].filter(Boolean);
  let cur = st.step && steps.includes(st.step) ? st.step : null;
  if (!cur) {
    if (!srv) cur = 'service';
    else if (needLength && !st.length) cur = 'length';
    else if (!st.day || !st.hour) cur = 'when';
    else cur = 'you';
  }
  const idx = steps.indexOf(cur);
  const go = (step, patch = {}) => set({ ...patch, step });

  useEffect(() => {
    headRef.current?.focus();
  }, [cur, doneId]);

  if (error && !pro) return <div className="wrap page"><ErrorNote error={error} /></div>;
  if (pro === undefined) return <div className="wrap page"><Loading /></div>;
  if (!pro) return <div className="wrap page"><h1>Ce coiffeur n'existe plus.</h1><Link to="/coiffeurs">Voir les coiffeurs</Link></div>;

  if (doneId) {
    const confirmed = pro.is_example;
    return (
      <div className="wrap narrow page">
        <div className="block done">
          <div className="done__mark" aria-hidden="true">✓</div>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 38 }}>{confirmed ? "C'est réservé !" : 'Demande envoyée !'}</h1>
          <p>{srv.label} chez <b>{pro.name}</b><br />{dateLabel(st.day, true)} à {st.hour} · {price} € à régler sur place</p>
          <p className="muted">{confirmed ? "Profil d'exemple : le rendez-vous est confirmé tout de suite." : 'Le coiffeur va confirmer votre demande. Vous suivez son statut dans votre compte.'}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/mon-compte" className="btn">Voir mes rendez-vous</Link>
            <Link to="/coiffeurs" className="btn btn--ghost">Retour aux coiffeurs</Link>
          </div>
        </div>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const bid = await api.book({ serviceId: srv.id, day: st.day, hour: st.hour, staff: st.staff, length: needLength ? st.length : '', ...form });
      setDoneId(bid);
      refresh();
    } catch (err) {
      setError(err.message);
      if (/pris|passé|proposé|fermé/.test(err.message)) {
        await load();
        set({ hour: '', step: 'when' });
      }
    } finally {
      setSending(false);
    }
  }

  const LABELS = { service: 'Prestation', staff: 'Avec qui', length: 'Longueur', when: 'Jour et heure', you: 'Vos infos' };
  const here = `/reserver/${id}?${params.toString()}`;

  return (
    <div className="wrap narrow page">
      <p className="small"><Link to={`/coiffeur/${pro.id}`}>← {pro.name}</Link></p>
      <ol className="steps-bar" aria-label="Étapes de la réservation">
        {steps.map((s, i) => (
          <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} aria-current={i === idx ? 'step' : undefined}>
            {i + 1}. {LABELS[s]}
          </li>
        ))}
      </ol>
      <ErrorNote error={error} />

      {cur === 'service' && (
        <section>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 34 }}>Quelle prestation ?</h1>
          <div className="opts">
            {pro.services.map((s) => (
              <button key={s.id} type="button" className="opt" aria-pressed={st.service === s.id}
                onClick={() => go(teamFor(s.id).length > 1 ? 'staff' : '', { service: s.id, staff: '', length: needs(s) ? st.length : '', day: '', hour: '' })}>
                <span>{s.label}<small>{fmtDur(s.duration)}</small></span>
                <strong>{hasPlus(s) ? `dès ${s.price} €` : `${s.price} €`}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {cur === 'staff' && (
        <section>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 34 }}>Avec qui ?</h1>
          <div className="opts">
            <button type="button" className="opt" aria-pressed={!st.staff} onClick={() => go('', { staff: '', day: '', hour: '' })}>
              <span>Peu importe<small>Plus de créneaux disponibles</small></span>
            </button>
            {team.map((m) => (
              <button key={m.k} type="button" className="opt" aria-pressed={st.staff === m.k} onClick={() => go('', { staff: m.k, day: '', hour: '' })}>
                <span>{m.name}<small>Travaille le {m.days.map((d) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d]).join(', ')}</small></span>
              </button>
            ))}
          </div>
          <p><button type="button" className="link" onClick={() => go('service')}>← Changer de prestation</button></p>
        </section>
      )}

      {cur === 'length' && (
        <section>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 34 }}>Vos cheveux sont…</h1>
          <p className="muted">Le prix de « {srv.label} » dépend de la longueur.</p>
          <div className="opts">
            {Object.entries(LENGTHS).map(([k, l]) => (
              <button key={k} type="button" className="opt" aria-pressed={st.length === k} onClick={() => go('', { length: k })}>
                <span>{l}</span>
                <strong>{srv.price + (srv.plus[k] || 0)} €</strong>
              </button>
            ))}
          </div>
          <p><button type="button" className="link" onClick={() => go('service')}>← Changer de prestation</button></p>
        </section>
      )}

      {cur === 'when' && (
        <section>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 34 }}>Quel jour, quelle heure ?</h1>
          <p className="muted">{srv.label} · {fmtDur(srv.duration)} · {price} €{st.staff ? ` · avec ${team.find((m) => m.k === st.staff)?.name}` : ''}</p>
          <div className="days" role="group" aria-label="Jours">
            {days.map((d) => {
              const free = d.hours.filter((h) => !h.taken).length;
              const [w, n] = dateLabel(d.date).split(' ');
              return (
                <button key={d.date} type="button" className="day" aria-pressed={st.day === d.date} disabled={!free}
                  aria-label={`${dateLabel(d.date, true)} : ${free ? `${free} créneau${free > 1 ? 'x' : ''} libre${free > 1 ? 's' : ''}` : 'complet ou fermé'}`}
                  onClick={() => set({ day: d.date, hour: '', step: 'when' })}>
                  <small>{w}</small><b>{n}</b><small>{free ? `${free} libre${free > 1 ? 's' : ''}` : d.hours.length ? 'Complet' : 'Fermé'}</small>
                </button>
              );
            })}
          </div>
          {day && (
            <>
              <h2 style={{ fontSize: 22, marginTop: 20 }}>{dateLabel(day.date, true)}</h2>
              <div className="slots" role="group" aria-label="Heures">
                {day.hours.map((h) => (
                  <button key={h.h} type="button" className="slot" aria-pressed={st.hour === h.h} disabled={h.taken} aria-label={h.taken ? `${h.h}, déjà pris` : h.h}
                    onClick={() => set({ hour: h.h, step: 'you' })}>
                    {h.h}
                  </button>
                ))}
              </div>
            </>
          )}
          {!days.some((d) => d.hours.some((h) => !h.taken)) && <p className="note">Aucun créneau libre dans les 3 prochaines semaines.{team.length > 1 && st.staff ? ' Essayez « Peu importe » pour voir toute l\'équipe.' : ''}</p>}
          <p style={{ marginTop: 16 }}>
            <button type="button" className="link" onClick={() => go(steps[Math.max(0, idx - 1)])}>← Étape précédente</button>
          </p>
        </section>
      )}

      {cur === 'you' && (
        <section>
          <h1 ref={headRef} tabIndex={-1} style={{ fontSize: 34 }}>Vérifiez et confirmez</h1>
          <div className="block" style={{ marginBottom: 18 }}>
            <dl className="recap">
              <dt>Coiffeur</dt><dd>{pro.name}{st.staff ? ` · avec ${team.find((m) => m.k === st.staff)?.name}` : ''}</dd>
              <dt>Prestation</dt><dd>{srv.label} · {fmtDur(srv.duration)}</dd>
              {needLength && <><dt>Cheveux</dt><dd>{LENGTHS[st.length]}</dd></>}
              <dt>Quand</dt><dd>{dateLabel(st.day, true)} à {st.hour}</dd>
              <dt>Où</dt><dd>{pro.mode === 'domicile' ? 'Chez vous' : pro.address || pro.city}</dd>
              <dt>Prix</dt><dd>{price} €{pro.mode === 'domicile' && pro.travel ? ` + ${pro.travel} € de déplacement` : ''}, à régler sur place</dd>
            </dl>
            <p className="small" style={{ margin: '12px 0 0' }}><button type="button" className="link" onClick={() => go('when')}>Changer le jour ou l'heure</button></p>
          </div>

          {!user ? (
            <div className="block stack">
              <p style={{ margin: 0 }}><b>Dernière étape : connectez-vous</b> pour que le coiffeur sache qui vient. Votre choix est gardé.</p>
              <div className="row">
                <Link className="btn" to={`/connexion?next=${encodeURIComponent(here)}&tab=signup`}>Créer un compte</Link>
                <Link className="btn btn--ghost" to={`/connexion?next=${encodeURIComponent(here)}`}>J'ai déjà un compte</Link>
              </div>
            </div>
          ) : profile?.role === 'pro' ? (
            <p className="note note--err">Vous êtes connecté avec un compte coiffeur. Pour réserver, utilisez un compte cliente.</p>
          ) : (
            <form className="stack" onSubmit={submit}>
              <div className="block stack" style={{ gap: 10 }}>
                <b>Votre fiche cheveux</b>
                {diag ? (
                  <HairDiag value={profile.hair} onCancel={() => setDiag(false)} onDone={async (h) => { await api.updateProfile({ hair: h }); await refresh(); setDiag(false); }} />
                ) : profile?.hair?.type ? (
                  <p style={{ margin: 0 }}>{hairText(profile.hair)}. Elle est transmise au coiffeur. <button type="button" className="link" onClick={() => setDiag(true)}>Modifier</button></p>
                ) : (
                  <p style={{ margin: 0 }}>Facultatif, mais elle aide le coiffeur à préparer le rendez-vous. <button type="button" className="link" onClick={() => setDiag(true)}>Remplir (6 questions)</button></p>
                )}
              </div>
              <label className="field">
                <span>Téléphone</span>
                <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <small>Facultatif. Seul le coiffeur le voit, en cas d'imprévu.</small>
              </label>
              {pro.mode === 'domicile' && (
                <label className="field">
                  <span>Adresse du rendez-vous</span>
                  <input type="text" autoComplete="street-address" required minLength={5} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </label>
              )}
              <label className="field">
                <span>Un mot pour le coiffeur</span>
                <textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex. je veux garder de la longueur" />
              </label>
              <button type="submit" className="btn btn--gold btn--block" disabled={sending}>{sending ? 'Envoi…' : `Confirmer la réservation · ${price} €`}</button>
              <p className="small muted" style={{ margin: 0 }}>Rien à payer maintenant. Annulation gratuite jusqu'à 24 h avant.</p>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
