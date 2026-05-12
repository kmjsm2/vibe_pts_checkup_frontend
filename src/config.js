/** 개발 모드에서 `VITE_API_BASE`가 비었을 때 사용 (끝 슬래시 없음). */
export const DEV_DEFAULT_API_BASE = 'http://localhost:5000'

/** 프로덕션 빌드에서 `VITE_API_BASE`가 비었을 때 사용 (끝 슬래시 없음). */
export const PROD_DEFAULT_API_BASE =
  'https://vibe-pts-checkup-backend.onrender.com'

function normalizeApiBase(s) {
  return String(s ?? '')
    .trim()
    .replace(/\/$/, '')
}

const envRaw = import.meta.env.VITE_API_BASE
const fromEnv = normalizeApiBase(
  typeof envRaw === 'string' ? envRaw : '',
)

/**
 * 백엔드 루트 URL (스킴+호스트+포트, 경로 없음).
 * 우선순위: `VITE_API_BASE` → (프로덕션 빌드면 PROD 기본값 / 아니면 DEV 기본값).
 */
export const API_BASE =
  fromEnv ||
  (import.meta.env.PROD
    ? normalizeApiBase(PROD_DEFAULT_API_BASE)
    : normalizeApiBase(DEV_DEFAULT_API_BASE))

/** `.env` 등에 적힌 `VITE_API_BASE` 원문 (없으면 빈 문자열). */
export const VITE_API_BASE_RAW = typeof envRaw === 'string' ? envRaw : ''

/** `VITE_API_BASE`가 비어 있지 않게 설정되어 있으면 true */
export const API_BASE_FROM_ENV = Boolean(fromEnv)

/** 환자 API 컬렉션 베이스 (`GET/POST …/api/patients`). */
export const PATIENTS_API_BASE = `${API_BASE}/api/patients`

/** MongoDB 연결 요약 (`GET …/api/patients/db-info`). */
export const PATIENTS_DB_INFO_URL = `${PATIENTS_API_BASE}/db-info`

/** UI용: 배포 기본 호스트의 환자 API URL (env 미설정 안내 등). */
export const DEPLOYED_PATIENTS_API_BASE = `${PROD_DEFAULT_API_BASE}/api/patients`
