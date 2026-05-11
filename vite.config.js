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

/** 상대 경로(`/api/...`)는 브라우저가 현재 페이지 호스트(localhost:5173)에 붙입니다. 프록시를 쓸 때만 허용. */
function resolvePatientsApiBase(raw, useLocalProxy) {
  const trimmed = trimApiBase(raw)
  if (!trimmed) return DEPLOYED_PATIENTS_API_BASE
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (useLocalProxy && trimmed.startsWith('/')) return trimmed
  console.warn(
    '[vite] VITE_PATIENTS_API_BASE는 http(s):// 전체 URL이어야 합니다. (상대 경로만 있으면 요청이 localhost:5173으로 갑니다.) 받은 값:',
    JSON.stringify(trimmed),
    '→ 배포 기본값 사용:',
    DEPLOYED_PATIENTS_API_BASE,
  )
  return DEPLOYED_PATIENTS_API_BASE
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const raw = env.VITE_PATIENTS_API_BASE ?? ''
  const trimmedFromFile = trimApiBase(raw)
  const useLocalProxy = env.VITE_DEV_PROXY_LOCAL === 'true'
  const resolved = resolvePatientsApiBase(raw, useLocalProxy)

  return {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [react()],
    /** `.env`를 Node에서 직접 읽어 번들에 넣음 (cwd/envDir 이슈 방지) */
    define: {
      __PATIENTS_API_BASE_RESOLVED__: JSON.stringify(resolved),
      __PATIENTS_API_ENV_RAW__: JSON.stringify(raw),
      __PATIENTS_API_FROM_DOTENV__: JSON.stringify(
        Boolean(trimmedFromFile) &&
          (/^https?:\/\//i.test(trimmedFromFile) ||
            (useLocalProxy && trimmedFromFile.startsWith('/'))),
      ),
      __VITE_DEV_PROXY_LOCAL__: JSON.stringify(useLocalProxy),
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
