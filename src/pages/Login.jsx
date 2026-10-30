import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorNote, useTitle } from '../components';
import { api } from '../lib/api';

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user, profile, refresh } = useAuth();
  const [tab, setTab] = useState(params.get('tab') === 'signup' ? 'signup' : 'login');
  const [role, setRole] = useState(params.get('role') === 'pro' ? 'pro' : 'client');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  useTitle(tab === 'signup' ? 'Créer un compte' : 'Se connecter');

  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  useEffect(() => {
    if (user && profile) nav(safeNext || (profile.role === 'pro' ? '/espace-coiffeur' : '/mon-compte'), { replace: true });
  }, [user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSending(true);
    try {
      if (tab === 'signup') {
        if (f.name.trim().length < 2) throw new Error('Indiquez votre prénom.');
        const r = await api.signUp({ ...f, name: f.name.trim(), role });
        if (r.needsConfirm) {
          setInfo(`Compte créé. Ouvrez l'e-mail envoyé à ${f.email} et cliquez sur le lien pour l'activer, puis connectez-vous.`);
          setTab('login');
        }
      } else {
        await api.signIn(f);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="wrap page">
      <div className="auth">
        <h1 style={{ fontSize: 40 }}>{tab === 'signup' ? 'Créer un compte' : 'Se connecter'}</h1>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'login'} onClick={() => setTab('login')}>J'ai un compte</button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>Créer un compte</button>
        </div>
        {info && <p className="note note--ok" role="status">{info}</p>}
        <ErrorNote error={error} />
        <form className="stack" onSubmit={submit}>
          {tab === 'signup' && (
            <>
              <fieldset>
                <legend>Je suis…</legend>
                <div className="role">
                  <button type="button" className="opt" aria-pressed={role === 'client'} onClick={() => setRole('client')}><span>Cliente ou client<small>Je cherche un coiffeur</small></span></button>
                  <button type="button" className="opt" aria-pressed={role === 'pro'} onClick={() => setRole('pro')}><span>Coiffeur ou salon<small>Je propose mes prestations</small></span></button>
                </div>
              </fieldset>
              <label className="field">
                <span>{role === 'pro' ? 'Votre prénom' : 'Prénom'}</span>
                <input type="text" autoComplete="given-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </label>
            </>
          )}
          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input type="password" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            {tab === 'signup' && <small>Au moins 6 caractères.</small>}
          </label>
          <button type="submit" className="btn btn--block" disabled={sending}>{sending ? 'Un instant…' : tab === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button>
        </form>
        {api.mode === 'demo' && <p className="small muted" style={{ marginTop: 16 }}>Mode démo : utilisez une adresse inventée, par exemple test@exemple.test.</p>}
      </div>
    </div>
  );
}
