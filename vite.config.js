import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const DEPLOYED_PATIENTS_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com/api/patients'

function trimApiBase(s) {
  if (typeof s !== 'string') return ''
  return s.trim().replace(/\/$/, '')
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const raw = env.VITE_PATIENTS_API_BASE ?? ''
  const resolved = trimApiBase(raw) || DEPLOYED_PATIENTS_API_BASE
  const useLocalProxy = env.VITE_DEV_PROXY_LOCAL === 'true'

  return {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [react()],
    /** `.env`를 Node에서 직접 읽어 번들에 넣음 (cwd/envDir 이슈 방지) */
    define: {
      __PATIENTS_API_BASE_RESOLVED__: JSON.stringify(resolved),
      __PATIENTS_API_ENV_RAW__: JSON.stringify(raw),
      __PATIENTS_API_FROM_DOTENV__: JSON.stringify(Boolean(trimApiBase(raw))),
    },
    server: {
      ...(useLocalProxy
        ? {
            proxy: {
              '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  }
})
