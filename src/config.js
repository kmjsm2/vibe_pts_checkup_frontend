/** Render 배포 백엔드 (끝 슬래시 없음). */
export const DEPLOYED_PATIENTS_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com/api/patients'

/**
 * 환자 API 베이스 URL (끝 슬래시 없음).
 * `.env`의 `VITE_PATIENTS_API_BASE`로 덮어쓸 수 있습니다. (예: 로컬 백엔드 `http://localhost:5000/api/patients`)
 */
export const PATIENTS_API_BASE = (() => {
  const fromEnv = import.meta.env.VITE_PATIENTS_API_BASE?.replace(/\/$/, '')
  return fromEnv || DEPLOYED_PATIENTS_API_BASE
})()

/** MongoDB 연결 요약 (`GET …/db-info`). */
export const PATIENTS_DB_INFO_URL = `${PATIENTS_API_BASE}/db-info`
