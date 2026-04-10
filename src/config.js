/**
 * 환자 API 베이스 URL (끝 슬래시 없음).
 */
export const PATIENTS_API_BASE = (
  import.meta.env.VITE_PATIENTS_API_BASE?.replace(/\/$/, '') ||
  'https://vibe-pts-checkup-backend.onrender.com/api/patients'
)
