/* global __VITE_API_BASE_RESOLVED__, __VITE_API_BASE_RAW__, __VITE_API_BASE_FROM_ENV__ */

/** 개발 시 `.env`에 비어 있을 때 (vite `mode === 'development'`). */
export const DEV_DEFAULT_API_BASE = 'http://localhost:5000'

/** 프로덕션 빌드 시 `.env` / CI 환경변수에 비어 있을 때. */
export const PROD_DEFAULT_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com'

function normalizeApiBase(s) {
  return String(s ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')
}

/**
 * 백엔드 루트 URL (경로 없음, `/api/...`는 각 API 모듈에서 붙임).
 * `vite.config.js`의 `loadEnv` + `define`으로 빌드/개발 서버 기동 시 고정됩니다.
 * Vercel에서는 Project → Settings → Environment Variables에
 * `VITE_API_BASE`를 넣고 **재배포**해야 번들에 반영됩니다.
 */
export const API_BASE = normalizeApiBase(__VITE_API_BASE_RESOLVED__)

/** 빌드 시점에 읽은 `VITE_API_BASE` 원문 */
export const VITE_API_BASE_RAW = __VITE_API_BASE_RAW__

/** `VITE_API_BASE`가 비어 있지 않게 설정되어 있으면 true */
export const API_BASE_FROM_ENV = __VITE_API_BASE_FROM_ENV__

/** 환자 API (`/api/patients`). */
export const PATIENTS_API_BASE = `${API_BASE}/api/patients`

export const PATIENTS_DB_INFO_URL = `${PATIENTS_API_BASE}/db-info`

export const DEPLOYED_PATIENTS_API_BASE = `${PROD_DEFAULT_API_BASE}/api/patients`

/** 인증 (절대 URL로 고정 — 배포 시 상대 경로로 Vercel에 붙는 문제 방지). */
export const AUTH_LOGIN_URL = `${API_BASE}/api/auth/login`
export const AUTH_REGISTER_URL = `${API_BASE}/api/auth/register`
