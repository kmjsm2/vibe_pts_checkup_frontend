import { Route, Routes, Navigate } from 'react-router-dom'
import { ClinicalShell } from './components/clinical/ClinicalShell.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ClinicalShell />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
