import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const DEV_DEFAULT_API_BASE = 'http://localhost:5000'
const PROD_DEFAULT_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com'

function trimTrailingSlashes(s) {
  return String(s ?? '')
    .trim()
    .replace(/\/+$/, '')
}

/** 호스트 루트만 쓰도록 `.../api` 접미사 제거 */
function stripApiPathSuffix(s) {
  return trimTrailingSlashes(s).replace(/\/api$/i, '')
}

/**
 * VITE_API_BASE 정규화. 스킴 없으면 빈 문자열(→ 모드 기본값 사용).
 */
function normalizeUserApiBase(raw) {
  const t = trimTrailingSlashes(raw)
  if (!t) return ''
  const withoutApi = stripApiPathSuffix(t)
  if (!/^https?:\/\//i.test(withoutApi)) {
    console.warn(
      '[vite] VITE_API_BASE는 http:// 또는 https:// 로 시작하는 전체 URL이어야 합니다. 받은 값:',
      JSON.stringify(t),
    )
    return ''
  }
  return withoutApi
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const raw = env.VITE_API_BASE ?? ''
  const fromEnv = normalizeUserApiBase(raw)
  const resolved =
    fromEnv ||
    (mode === 'production'
      ? stripApiPathSuffix(PROD_DEFAULT_API_BASE)
      : stripApiPathSuffix(DEV_DEFAULT_API_BASE))

  const useLocalProxy = env.VITE_DEV_PROXY_LOCAL === 'true'

  return {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [react()],
    /** Vercel 등 CI 빌드에서도 `import.meta.env` 누락 없이 동일한 API 호스트를 쓰도록 주입 */
    define: {
      __VITE_API_BASE_RESOLVED__: JSON.stringify(resolved),
      __VITE_API_BASE_RAW__: JSON.stringify(raw),
      __VITE_API_BASE_FROM_ENV__: JSON.stringify(Boolean(fromEnv)),
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
