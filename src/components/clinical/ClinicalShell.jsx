import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchPatients, fetchPatientsDbInfo } from '../../api/patients.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  displayDash,
  getPatientChartNumber,
  getPatientDepartment,
  getPatientDiagnosis,
  getPatientDoctor,
  getPatientIdString,
  getPatientListRowKey,
  getPatientName,
} from '../../utils/patientFields.js'
import { ClinicalPatientWorkspace } from './ClinicalPatientWorkspace.jsx'

const PAGE_SIZE = 50

export function ClinicalShell() {
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname.startsWith('/dashboard')
  const [searchParams] = useSearchParams()

  const selectedPatientId = searchParams.get('patient') || ''

  const setSelectedPatientId = useCallback(
    (id) => {
      if (id) {
        navigate({ pathname: '/', search: `?patient=${encodeURIComponent(id)}` }, { replace: true })
      } else {
        navigate({ pathname: '/', search: '' }, { replace: true })
      }
    },
    [navigate],
  )

  const [dbInfo, setDbInfo] = useState(null)
  const [dbInfoError, setDbInfoError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [dbTotal, setDbTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [createNonce, setCreateNonce] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(searchInput.trim()), 320)
    return () => clearTimeout(t)
  }, [searchInput])

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

  const loadPatients = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      const data = await fetchPatients({
        limit: PAGE_SIZE,
        skip,
        search: appliedSearch,
      })
      setPatients(data.patients ?? [])
      setTotal(data.total ?? 0)
      setDbTotal(data.dbTotal ?? 0)
    } catch (e) {
      setListError(e.message || '목록을 불러오지 못했습니다.')
      setPatients([])
      setTotal(0)
      setDbTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [skip, appliedSearch])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  const onRefreshList = useCallback(async () => {
    await loadPatients()
  }, [loadPatients])

  const canPrev = skip > 0
  const canNext = skip + patients.length < total

  return (
    <div className="clinical-root">
      <aside className="clinical-sidebar" aria-label="환자 목록">
        <div className="clinical-sidebar-top">
          <div className="clinical-logo">
            <span className="clinical-logo-mark">ClinicalAI</span>
            <span className="clinical-logo-ver">v2 · 환자 관리</span>
          </div>
          <div className="clinical-sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `clinical-nav-item${isActive && !isDashboard ? ' active' : ''}`}
            >
              <span className="clinical-nav-icon" aria-hidden>
                ◉
              </span>
              Patients
              <span className="clinical-nav-badge">{dbTotal || total || '—'}</span>
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `clinical-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="clinical-nav-icon" aria-hidden>
                ▤
              </span>
              대시보드
            </NavLink>
          </div>
        </div>

        <div className="clinical-sidebar-search">
          <input
            type="search"
            placeholder="환자 검색…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setSkip(0)
            }}
            aria-label="환자 검색"
          />
        </div>
        {listError ? (
          <div className="clinical-sidebar-error" role="alert">
            {listError}
          </div>
        ) : null}
        <div className="clinical-patient-list" role="list">
          {listLoading ? (
            <div className="clinical-list-loading">
              <span className="spinner clinical-spinner" aria-hidden />
            </div>
          ) : patients.length === 0 ? (
            <p className="clinical-list-empty">환자가 없습니다.</p>
          ) : (
            patients
              .filter((p) => p != null && typeof p === 'object')
              .map((p, index) => {
              const patientRowId = getPatientIdString(p)
              const patientRowKey = getPatientListRowKey(p, index)
              const active =
                patientRowId != null && String(patientRowId) === String(selectedPatientId)
              const dx = getPatientDiagnosis(p)
              return (
                <button
                  key={patientRowKey}
                  type="button"
                  role="listitem"
                  className={`clinical-patient-card${active ? ' active' : ''}`}
                  onClick={() => patientRowId && setSelectedPatientId(String(patientRowId))}
                >
                  <div className="clinical-patient-card-top">
                    <span className="clinical-patient-card-name">{displayDash(getPatientName(p))}</span>
                    {dx ? <span className="clinical-mini-warn" title="진단 있음" /> : null}
                  </div>
                  <div className="clinical-patient-sub">
                    {displayDash(getPatientChartNumber(p))} · {displayDash(getPatientDepartment(p))} ·{' '}
                    {getPatientDoctor(p)}
                  </div>
                  <div className="clinical-patient-dx" title={dx ?? ''}>
                    {displayDash(dx)}
                  </div>
                  <div className="clinical-patient-badges">
                    <span className="clinical-chip">AI Ready</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="clinical-sidebar-pager">
          <button
            type="button"
            className="clinical-btn clinical-btn-ghost clinical-btn-tiny"
            disabled={!canPrev || listLoading}
            onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
          >
            이전
          </button>
          <button
            type="button"
            className="clinical-btn clinical-btn-ghost clinical-btn-tiny"
            disabled={!canNext || listLoading}
            onClick={() => setSkip((s) => s + PAGE_SIZE)}
          >
            다음
          </button>
        </div>

        <div className="clinical-sidebar-bottom">
          <button
            type="button"
            className="clinical-btn clinical-btn-ai"
            onClick={() => {
              if (isDashboard) {
                navigate({ pathname: '/', search: 'openCreate=1' })
              } else {
                setCreateNonce((n) => n + 1)
              }
            }}
          >
            ＋ 새 환자 등록
          </button>
          <button type="button" className="clinical-btn clinical-btn-ghost clinical-btn-block" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>

      <div className="clinical-body">
        {isDashboard ? (
          <div className="clinical-dashboard-host">
            <Outlet />
          </div>
        ) : (
          <ClinicalPatientWorkspace
            selectedPatientId={selectedPatientId}
            onSelectPatient={setSelectedPatientId}
            listPatients={patients}
            onRefreshList={onRefreshList}
            dbInfo={dbInfo}
            dbInfoError={dbInfoError}
            createNonce={createNonce}
          />
        )}
      </div>
    </div>
  )
}
