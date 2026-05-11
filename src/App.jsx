import { useEffect, useState } from 'react'
import { fetchPatientsDbInfo } from './api/patients.js'
import {
  DEPLOYED_PATIENTS_API_BASE,
  PATIENTS_API_BASE,
  PATIENTS_API_FROM_DOTENV,
  PATIENTS_DB_INFO_URL,
  VITE_PATIENTS_API_BASE_RAW,
} from './config.js'
import { PatientCheckupApp } from './components/PatientCheckupApp.jsx'
import './App.css'

export {
  DEPLOYED_PATIENTS_API_BASE,
  PATIENTS_API_BASE,
  PATIENTS_API_FROM_DOTENV,
  PATIENTS_DB_INFO_URL,
  VITE_PATIENTS_API_BASE_RAW,
} from './config.js'

/**
 * `.env`의 값은 Vite가 빌드/개발 서버 기동 시 `import.meta.env`에만 넣습니다.
 * 그래서 소스에는 URL 문자열이 직접 보이지 않고, `config.js`의 `VITE_PATIENTS_API_BASE_RAW`와
 * `PatientCheckupApp` props로 화면에 표시합니다. `.env` 수정 후에는 dev 서버를 한 번 재시작하세요.
 */
function App() {
  const [dbInfo, setDbInfo] = useState(null)
  const [dbInfoError, setDbInfoError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchPatientsDbInfo()
        if (!cancelled) {
          setDbInfo(data)
          setDbInfoError('')
        }
      } catch (e) {
        if (!cancelled) {
          setDbInfo(null)
          setDbInfoError(e.message || 'DB 정보를 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PatientCheckupApp
      apiBase={PATIENTS_API_BASE}
      dbInfoUrl={PATIENTS_DB_INFO_URL}
      dbInfo={dbInfo}
      dbInfoError={dbInfoError}
      apiEnvRaw={VITE_PATIENTS_API_BASE_RAW}
      apiUsesDotEnv={PATIENTS_API_FROM_DOTENV}
      deployedFallback={DEPLOYED_PATIENTS_API_BASE}
    />
  )
}

export default App