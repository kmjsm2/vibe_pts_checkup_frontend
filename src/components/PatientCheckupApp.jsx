import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { formatSymptomCheckResponse, postSymptomCheck } from '../api/ai.js'
import {
  createPatient,
  deletePatient,
  fetchPatients,
  updatePatient,
} from '../api/patients.js'
import { PATIENTS_API_BASE as defaultApiBase } from '../config.js'
import { PatientForm } from './PatientForm.jsx'
import {
  emptyPatientForm,
  formToCreatePayload,
  formToPatchPayload,
  patientToForm,
} from './patientFormUtils.js'

const PAGE_SIZE = 50

function ageFromBirthDate(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10)) : new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1
  return age >= 0 && age < 150 ? String(age) : ''
}

function formatDate(value) {
  if (value == null || value === '') return '—'
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR')
}

export function PatientCheckupApp({
  apiBase,
  apiRoot,
  dbInfoUrl,
  dbInfo,
  dbInfoError,
  apiEnvRaw,
  apiUsesDotEnv,
} = {}) {
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [dbTotal, setDbTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [physician, setPhysician] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [gender, setGender] = useState('')
  const [recordSource, setRecordSource] = useState('')

  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedDepartment, setAppliedDepartment] = useState('')
  const [appliedPhysician, setAppliedPhysician] = useState('')
  const [appliedBloodType, setAppliedBloodType] = useState('')
  const [appliedGender, setAppliedGender] = useState('')
  const [appliedRecordSource, setAppliedRecordSource] = useState('')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(() => emptyPatientForm())
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [aiPatient, setAiPatient] = useState(null)
  const [aiSymptoms, setAiSymptoms] = useState('')
  const [aiAge, setAiAge] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiResultText, setAiResultText] = useState('')

  const api = apiBase ?? defaultApiBase
  const resolvedApiRoot = apiRoot ?? ''
  const resolvedDbInfoUrl = dbInfoUrl ?? `${api}/db-info`

  const load = useCallback(async () => {
    setLoading(true)
    setActionError('')
    try {
      const data = await fetchPatients({
        limit: PAGE_SIZE,
        skip,
        search: appliedSearch,
        department: appliedDepartment,
        physician: appliedPhysician,
        bloodType: appliedBloodType,
        gender: appliedGender,
        recordSource: appliedRecordSource,
      })
      setPatients(data.patients ?? [])
      setTotal(data.total ?? 0)
      setDbTotal(data.dbTotal ?? 0)
    } catch (e) {
      setActionError(e.message || '목록을 불러오지 못했습니다.')
      setPatients([])
      setTotal(0)
      setDbTotal(0)
    } finally {
      setLoading(false)
    }
  }, [
    skip,
    appliedSearch,
    appliedDepartment,
    appliedPhysician,
    appliedBloodType,
    appliedGender,
    appliedRecordSource,
  ])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setModal({ mode: 'create' })
    setForm(emptyPatientForm())
    setActionError('')
  }

  const openEdit = (p) => {
    setModal({ mode: 'edit', patient: p })
    setForm(patientToForm(p))
    setActionError('')
  }

  const closeModal = () => {
    if (saving) return
    setModal(null)
  }

  const onFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submitForm = async () => {
    setSaving(true)
    setActionError('')
    try {
      if (modal?.mode === 'create') {
        await createPatient(formToCreatePayload(form))
      } else if (modal?.mode === 'edit' && modal.patient?._id) {
        const patch = formToPatchPayload(form, modal.patient)
        if (Object.keys(patch).length === 0) {
          setActionError('변경된 항목이 없습니다.')
          setSaving(false)
          return
        }
        await updatePatient(modal.patient._id, patch)
      }
      setModal(null)
      await load()
    } catch (e) {
      setActionError(e.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const openAiModal = (p) => {
    setAiPatient(p)
    setAiSymptoms('')
    setAiAge(ageFromBirthDate(p?.birthDate))
    setAiError('')
    setAiResultText('')
  }

  const closeAiModal = () => {
    if (aiLoading) return
    setAiPatient(null)
    setAiSymptoms('')
    setAiAge('')
    setAiError('')
    setAiResultText('')
  }

  const runAiSymptomCheck = async () => {
    setAiError('')
    setAiResultText('')
    if (!String(aiSymptoms).trim()) {
      setAiError('증상을 입력해 주세요.')
      return
    }
    const ageTrim = String(aiAge).trim()
    let ageValue = null
    if (ageTrim !== '') {
      const n = Number(ageTrim)
      if (Number.isNaN(n) || n < 0 || n > 150) {
        setAiError('나이는 0–150 사이 숫자로 입력해 주세요.')
        return
      }
      ageValue = n
    }
    setAiLoading(true)
    try {
      const data = await postSymptomCheck({
        symptoms: aiSymptoms,
        age: ageValue,
        patientId: aiPatient?._id,
      })
      setAiResultText(formatSymptomCheckResponse(data))
    } catch (e) {
      setAiError(e.message || '분석에 실패했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError('')
    try {
      await deletePatient(deleteTarget._id)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      setActionError(e.message || '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const applyFilters = (e) => {
    e.preventDefault()
    setAppliedSearch(search)
    setAppliedDepartment(department)
    setAppliedPhysician(physician)
    setAppliedBloodType(bloodType)
    setAppliedGender(gender)
    setAppliedRecordSource(recordSource)
    setSkip(0)
  }

  const resetFilters = () => {
    setSearch('')
    setDepartment('')
    setPhysician('')
    setBloodType('')
    setGender('')
    setRecordSource('')
    setAppliedSearch('')
    setAppliedDepartment('')
    setAppliedPhysician('')
    setAppliedBloodType('')
    setAppliedGender('')
    setAppliedRecordSource('')
    setSkip(0)
  }

  const canPrev = skip > 0
  const canNext = skip + patients.length < total

  return (
    <div className="checkup-app">
      <header className="checkup-header">
        <div>
          <h1>환자 관리</h1>
          <p className="checkup-sub">
            환자 정보를 등록·수정·삭제합니다. 실제 요청 URL:{' '}
            <code className="inline-code">{api}</code>
          </p>
          <p className="checkup-sub checkup-env-line">
            <span
              className={
                apiUsesDotEnv ? 'env-badge env-badge-on' : 'env-badge env-badge-off'
              }
            >
              {apiUsesDotEnv ? '.env 적용' : '모드 기본 호스트'}
            </span>
            {' · '}
            <code className="inline-code">VITE_API_BASE</code>
            {': '}
            <code className="inline-code">
              {typeof apiEnvRaw === 'string' && apiEnvRaw.trim()
                ? apiEnvRaw.trim()
                : `— (미설정 · 현재 적용: ${resolvedApiRoot || '—'})`}
            </code>
          </p>
          <p className="checkup-sub network-hint">
            개발 서버에서는 <code className="inline-code">@vite/client</code>·
            <code className="inline-code">*.jsx</code> 등이{' '}
            <code className="inline-code">localhost:5173</code>에서 오는 것이
            정상입니다. 환자 API는 네트워크 탭에서{' '}
            <code className="inline-code">patients</code>·
            <code className="inline-code">db-info</code> 요청의{' '}
            <strong>Request URL</strong>이{' '}
            <code className="inline-code">{resolvedApiRoot || '백엔드 호스트'}</code>
            기준인지 확인하세요. <code className="inline-code">VITE_API_BASE</code>에
            백엔드 루트(<code className="inline-code">http://localhost:5000</code> 등)를
            넣으면 <code className="inline-code">/api/…</code> 경로가 자동으로 붙습니다.
          </p>
        </div>
        <div className="checkup-header-actions">
          <button type="button" className="btn primary" onClick={openCreate}>
            환자 등록
          </button>
        </div>
      </header>

      {dbInfoError ? (
        <div className="banner error" role="alert">
          DB 연결 정보: {dbInfoError}
        </div>
      ) : null}

      {dbInfo ? (
        <div className="banner info" role="status">
          <p className="db-info-line">
            <strong>{dbInfo.database ?? '—'}</strong> · 컬렉션{' '}
            {dbInfo.collection ?? 'patients'} · 문서{' '}
            <strong>{dbInfo.documentCount ?? 0}</strong>건
            {dbInfo.isAtlas ? ' · MongoDB Atlas' : null}
            {' · '}
            <a
              className="db-info-link"
              href={resolvedDbInfoUrl}
              target="_blank"
              rel="noreferrer"
            >
              db-info (JSON)
            </a>
          </p>
          {dbInfo.hint ? <p className="db-hint">{dbInfo.hint}</p> : null}
        </div>
      ) : null}

      {actionError ? (
        <div className="banner error" role="alert">
          {actionError}
        </div>
      ) : null}

      <form className="filters" onSubmit={applyFilters}>
        <label className="filter-field grow">
          <span>검색</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="차트번호, 이름, 진단, 담당의, 진료과, 약물, 외부 ID"
          />
        </label>
        <label className="filter-field">
          <span>진료과</span>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </label>
        <label className="filter-field">
          <span>담당의</span>
          <input
            value={physician}
            onChange={(e) => setPhysician(e.target.value)}
          />
        </label>
        <label className="filter-field narrow">
          <span>혈액형</span>
          <input
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
          />
        </label>
        <label className="filter-field narrow">
          <span>성별</span>
          <input value={gender} onChange={(e) => setGender(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>기록 출처</span>
          <select
            value={recordSource}
            onChange={(e) => setRecordSource(e.target.value)}
          >
            <option value="">전체</option>
            <option value="clinical">clinical</option>
            <option value="synthetic">synthetic</option>
            <option value="deidentified">deidentified</option>
          </select>
        </label>
        <div className="filter-actions">
          <button type="submit" className="btn">
            조회
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={resetFilters}
          >
            필터 초기화
          </button>
        </div>
      </form>

      <div className="list-meta">
        {loading ? (
          <span>불러오는 중…</span>
        ) : (
          <span>
            표시 {patients.length}명 · 검색 결과 {total}명 · DB 전체 {dbTotal}명
          </span>
        )}
        <div className="pager">
          <button
            type="button"
            className="btn small"
            disabled={!canPrev || loading}
            onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
          >
            이전
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!canNext || loading}
            onClick={() => setSkip((s) => s + PAGE_SIZE)}
          >
            다음
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="patient-table">
          <thead>
            <tr>
              <th>차트번호</th>
              <th>이름</th>
              <th>진료과</th>
              <th>담당의</th>
              <th>최근 검진</th>
              <th>진단</th>
              <th className="col-actions">작업</th>
            </tr>
          </thead>
          <tbody>
            {!loading && patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  환자가 없습니다. 조건을 바꾸거나 새로 등록해 보세요.
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p._id}>
                  <td>{p.chartNumber ?? '—'}</td>
                  <td className="strong">{p.name ?? '—'}</td>
                  <td>{p.department ?? '—'}</td>
                  <td>{p.attendingPhysician ?? '—'}</td>
                  <td>{formatDate(p.lastCheckupDate)}</td>
                  <td className="cell-clamp" title={p.diagnosis ?? ''}>
                    {p.diagnosis ?? '—'}
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn link"
                      onClick={() => openAiModal(p)}
                    >
                      AI 증상체크
                    </button>
                    <button
                      type="button"
                      className="btn link"
                      onClick={() => openEdit(p)}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="btn link danger"
                      onClick={() => setDeleteTarget(p)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="patient-modal-title"
          >
            <div className="modal-head">
              <h2 id="patient-modal-title">
                {modal.mode === 'create' ? '환자 등록' : '환자 수정'}
              </h2>
              <button
                type="button"
                className="btn icon"
                onClick={closeModal}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <PatientForm
                key={modal.mode === 'edit' ? modal.patient._id : 'new'}
                form={form}
                onChange={onFormChange}
                idPrefix={modal.mode === 'edit' ? 'edit' : 'new'}
              />
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn ghost"
                onClick={closeModal}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={submitForm}
                disabled={saving}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiPatient ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAiModal()
          }}
        >
          <div
            className="modal modal-ai"
            role="dialog"
            aria-labelledby="ai-symptom-title"
            aria-modal="true"
          >
            <div className="modal-head">
              <h2 id="ai-symptom-title">AI 증상체크</h2>
              <button
                type="button"
                className="btn icon"
                onClick={closeAiModal}
                disabled={aiLoading}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="ai-modal-patient">
                환자:{' '}
                <strong>{aiPatient.name ?? '—'}</strong>
                {aiPatient.chartNumber ? ` (${aiPatient.chartNumber})` : ''}
              </p>
              <label className="patient-field full">
                <span>증상</span>
                <textarea
                  className="ai-symptom-input"
                  value={aiSymptoms}
                  onChange={(e) => setAiSymptoms(e.target.value)}
                  placeholder="증상을 자세히 적어 주세요."
                  rows={5}
                  disabled={aiLoading}
                />
              </label>
              <label className="patient-field narrow">
                <span>나이</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={150}
                  value={aiAge}
                  onChange={(e) => setAiAge(e.target.value)}
                  placeholder="예: 45"
                  disabled={aiLoading}
                />
              </label>
              {aiError ? (
                <div className="banner error" role="alert">
                  {aiError}
                </div>
              ) : null}
              {aiResultText ? (
                <div className="ai-result-card" role="region" aria-label="분석 결과">
                  <h3 className="ai-result-title">분석 결과</h3>
                  <div className="ai-result-body">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                      {aiResultText}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-foot ai-modal-foot">
              <button
                type="button"
                className="btn ghost"
                onClick={closeAiModal}
                disabled={aiLoading}
              >
                닫기
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={runAiSymptomCheck}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <span className="spinner spinner-inline" aria-hidden />
                    분석 중…
                  </>
                ) : (
                  '분석하기'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null)
          }}
        >
          <div className="modal modal-sm" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2>환자 삭제</h2>
              <button
                type="button"
                className="btn icon"
                onClick={() => !deleting && setDeleteTarget(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{deleteTarget.name ?? '(이름 없음)'}</strong>
                {deleteTarget.chartNumber
                  ? ` (${deleteTarget.chartNumber})`
                  : ''}{' '}
                환자를 삭제할까요? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
