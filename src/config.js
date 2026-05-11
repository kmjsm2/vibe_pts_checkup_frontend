/* global __PATIENTS_API_BASE_RESOLVED__, __PATIENTS_API_ENV_RAW__, __PATIENTS_API_FROM_DOTENV__ */

/** Render 배포 백엔드 (끝 슬래시 없음). `vite.config.js`의 기본값과 동일하게 유지하세요. */
export const DEPLOYED_PATIENTS_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com/api/patients'

/**
 * `vite.config.js`의 `loadEnv` + `define`으로 `.env`에서 읽은 최종 API 베이스.
 * (Vite가 `__PATIENTS_API_BASE_RESOLVED__` 식별자를 문자열 리터럴로 치환합니다.)
 */
export const PATIENTS_API_BASE = String(__PATIENTS_API_BASE_RESOLVED__)
  .trim()
  .replace(/\/$/, '')

/** `.env`의 `VITE_PATIENTS_API_BASE` 원문 (Vite `define`으로 주입). */
export const VITE_PATIENTS_API_BASE_RAW = __PATIENTS_API_ENV_RAW__

/** `.env`에 `VITE_PATIENTS_API_BASE`가 비어 있지 않게 적혀 있으면 true */
export const PATIENTS_API_FROM_DOTENV = __PATIENTS_API_FROM_DOTENV__

/** MongoDB 연결 요약 (`GET …/db-info`). */
export const PATIENTS_DB_INFO_URL = `${PATIENTS_API_BASE}/db-info`
