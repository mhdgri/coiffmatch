import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorNote, Loading, ProCard, useTitle } from '../components';
import { api } from '../lib/api';
import { HAIR, SERVICES, SKILLS, minPrice } from '../lib/constants';
import { nextSlot } from '../lib/slots';

export default function Search() {
  useTitle('Trouver un coiffeur');
  const [params, setParams] = useSearchParams();
  const [pros, setPros] = useState(null);
  const [busy, setBusy] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const f = {
    hair: params.get('hair') || '',
    service: params.get('service') || '',
    mode: params.get('mode') || '',
    skill: params.get('skill') || '',
    q: params.get('q') || '',
    sort: params.get('sort') || 'slot',
  };
  const set = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    Promise.all([api.listPros(), api.busy(null)])
      .then(([p, b]) => {
        setPros(p);
        setBusy(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  const list = useMemo(() => {
    if (!pros) return [];
    const q = f.q.trim().toLowerCase();
    return pros
      .filter((p) => !f.hair || p.hair.includes(f.hair))
      .filter((p) => !f.service || p.services.some((s) => s.service === f.service))
      .filter((p) => !f.mode || p.mode === f.mode)
      .filter((p) => !f.skill || (p.skills || []).includes(f.skill))
      .filter((p) => !q || [p.city, p.zones, p.address, p.name].join(' ').toLowerCase().includes(q))
      .map((p) => ({ p, slot: nextSlot(p, busy.filter((b) => b.pro_id === p.id)) }))
      .sort((a, b) => {
        if (f.sort === 'price') return (minPrice(a.p.services) ?? 1e9) - (minPrice(b.p.services) ?? 1e9);
        if (f.sort === 'rating') return (b.p.rating ?? 0) - (a.p.rating ?? 0) || b.p.count - a.p.count;
        const ka = a.slot ? a.slot.date + a.slot.h.padStart(5, '0') : 'z';
        const kb = b.slot ? b.slot.date + b.slot.h.padStart(5, '0') : 'z';
        return ka.localeCompare(kb);
      });
  }, [pros, busy, f.hair, f.service, f.mode, f.skill, f.q, f.sort]);

  const active = ['hair', 'service', 'mode', 'skill', 'q'].filter((k) => f[k]).length;

  return (
    <div className="wrap search">
      <button type="button" className="btn btn--ghost filters__toggle" aria-expanded={open} aria-controls="filters" onClick={() => setOpen(!open)}>
        {open ? 'Masquer les filtres' : `Filtres${active ? ` (${active})` : ''}`}
      </button>
      <form id="filters" className={`filters${open ? ' is-open' : ''}`} onSubmit={(e) => e.preventDefault()} aria-label="Filtres">
        <fieldset>
          <legend>Type de cheveux</legend>
          <div className="chips">
            {Object.entries(HAIR).map(([k, l]) => (
              <label key={k} className="chip">
                <input type="radio" name="hair" checked={f.hair === k} onChange={() => set('hair', k)} />
                <span>{l}</span>
              </label>
            ))}
            {f.hair && <button type="button" className="link" onClick={() => set('hair', '')}>Tous</button>}
          </div>
        </fieldset>
        <label className="field">
          <span>Prestation</span>
          <select value={f.service} onChange={(e) => set('service', e.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(SERVICES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Où</legend>
          <div className="chips">
            {[['', 'Peu importe'], ['salon', 'En salon'], ['domicile', 'À domicile']].map(([k, l]) => (
              <label key={k} className="chip">
                <input type="radio" name="mode" checked={f.mode === k} onChange={() => set('mode', k)} />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Ville ou arrondissement</span>
          <input type="search" value={f.q} placeholder="Ex. Paris 11e, Montreuil" onChange={(e) => set('q', e.target.value)} />
        </label>
        <label className="field">
          <span>Savoir-faire</span>
          <select value={f.skill} onChange={(e) => set('skill', e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(SKILLS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {active > 0 && <button type="button" className="btn btn--ghost btn--small" onClick={() => setParams({}, { replace: true })}>Effacer les filtres</button>}
      </form>

      <section aria-labelledby="res-title">
        <div className="results__head">
          <h1 id="res-title">{f.hair ? `Coiffeurs pour cheveux ${HAIR[f.hair].toLowerCase()}` : 'Tous les coiffeurs'}</h1>
          <label className="row small">
            <span>Trier par</span>
            <select value={f.sort} onChange={(e) => set('sort', e.target.value === 'slot' ? '' : e.target.value)} style={{ width: 'auto', minHeight: 44 }}>
              <option value="slot">Créneau le plus proche</option>
              <option value="rating">Mieux notés</option>
              <option value="price">Prix le plus bas</option>
            </select>
          </label>
        </div>
        <ErrorNote error={error} />
        {!pros && !error && <Loading />}
        {pros && (
          <>
            <p className="muted small" role="status">{list.length} {list.length > 1 ? 'coiffeurs' : 'coiffeur'}</p>
            {list.length ? (
              <ul className="cards">{list.map(({ p, slot }) => <ProCard key={p.id} pro={p} slot={slot} />)}</ul>
            ) : (
              <div className="empty">
                <p><b>Aucun coiffeur ne correspond à tous ces filtres.</b></p>
                <button type="button" className="btn btn--ghost" onClick={() => setParams(f.hair ? { hair: f.hair } : {}, { replace: true })}>Garder seulement le type de cheveux</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
