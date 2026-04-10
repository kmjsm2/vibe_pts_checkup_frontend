/**
 * 환자 API 베이스 URL (끝 슬래시 없음).
 * 개발: Vite 프록시로 /api → localhost:5000
 * 백엔드가 /patients 만 쓰는 경우 .env에 VITE_PATIENTS_API_BASE=http://localhost:5000/patients
 */
export const PATIENTS_API_BASE = (
  import.meta.env.VITE_PATIENTS_API_BASE?.replace(/\/$/, '') ||
  (import.meta.env.DEV
    ? '/api/patients'
    : 'http://localhost:5000/api/patients')
)
