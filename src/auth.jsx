import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './lib/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement, null = déconnecté
  const [profile, setProfile] = useState(null);

  const refresh = useCallback(async () => {
    const s = await api.session();
    setUser(s);
    setProfile(s ? await api.profile() : null);
  }, []);

  useEffect(() => {
    refresh();
    return api.onAuth(() => refresh());
  }, [refresh]);

  return <Ctx.Provider value={{ user, profile, refresh, loading: user === undefined }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
