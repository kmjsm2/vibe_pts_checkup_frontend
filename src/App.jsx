import { useEffect, useState } from 'react'
import { fetchPatientsDbInfo } from './api/patients.js'
import {
  DEPLOYED_PATIENTS_API_BASE,
  PATIENTS_API_BASE,
  PATIENTS_DB_INFO_URL,
} from './config.js'
import { PatientCheckupApp } from './components/PatientCheckupApp.jsx'
import './App.css'

export { DEPLOYED_PATIENTS_API_BASE, PATIENTS_API_BASE, PATIENTS_DB_INFO_URL }

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
    />
  )
}

export default App