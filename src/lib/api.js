// Choisit Supabase si les clés sont renseignées (fichier .env ou réglages Vercel), sinon le mode démo.
import { createSupabaseApi } from './supa';
import { createDemoApi } from './demo';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const api = url && key ? createSupabaseApi(url, key) : createDemoApi();
