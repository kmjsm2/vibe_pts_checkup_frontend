import { useEffect, useState } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { fetchPatientsDbInfo } from './api/patients.js'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { PatientCheckupApp } from './components/PatientCheckupApp.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import {
  API_BASE,
  API_BASE_FROM_ENV,
  PATIENTS_API_BASE,
  PATIENTS_DB_INFO_URL,
  VITE_API_BASE_RAW,
} from './config.js'
import './App.css'

export {
  API_BASE,
  API_BASE_FROM_ENV,
  DEV_DEFAULT_API_BASE,
  PROD_DEFAULT_API_BASE,
  DEPLOYED_PATIENTS_API_BASE,
  PATIENTS_API_BASE,
  PATIENTS_DB_INFO_URL,
  VITE_API_BASE_RAW,
} from './config.js'

function PatientHome() {
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
      apiRoot={API_BASE}
      dbInfoUrl={PATIENTS_DB_INFO_URL}
      dbInfo={dbInfo}
      dbInfoError={dbInfoError}
      apiEnvRaw={VITE_API_BASE_RAW}
      apiUsesDotEnv={API_BASE_FROM_ENV}
    />
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <PatientHome />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
