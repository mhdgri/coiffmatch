import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Version de déploiement : ajoutée aux fichiers /cm/ pour que téléphones et service worker prennent toujours la dernière version.
  define: { __CM_BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8) : Date.now().toString(36)) },
})
