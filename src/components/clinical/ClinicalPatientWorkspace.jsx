import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatSymptomCheckResponse, postSymptomCheck } from '../../api/ai.js'
import {
  createPatient,
  deletePatient,
  fetchPatient,
  updatePatient,
} from '../../api/patients.js'
import { PATIENTS_DB_INFO_URL } from '../../config.js'
import { PatientForm } from '../PatientForm.jsx'
import {
  emptyPatientForm,
  formToCreatePayload,
  formToPatchPayload,
  patientToForm,
} from '../patientFormUtils.js'
import { getPatientDoctor } from '../../utils/patientFields.js'

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

function buildAiSummaryMarkdown(p) {
  if (!p) return ''
  const lines = [
    '## 임상 요약',
    '',
    `**환자:** ${p.name ?? '—'} (${p.chartNumber ?? '차트 없음'})`,
    `**진료과:** ${p.department ?? '—'} · **담당의:** ${getPatientDoctor(p)}`,
    `**성별:** ${p.gender ?? '—'} · **최근 검진:** ${formatDate(p.lastCheckupDate)}`,
    '',
    '### 진단',
    String(p.diagnosis ?? '등록된 진단이 없습니다.'),
    '',
    '### 복용 약물',
    Array.isArray(p.medications)
      ? p.medications.join(', ')
      : String(p.medications ?? '—'),
    '',
    '### 알레르기',
    Array.isArray(p.allergies)
      ? p.allergies.join(', ')
      : String(p.allergies ?? '—'),
    '',
    '### 메모',
    String(p.notes ?? '—'),
  ]
  return lines.join('\n')
}

function concernBullets(p) {
  const items = []
  if (p?.allergies) {
    const a = Array.isArray(p.allergies) ? p.allergies : [p.allergies]
    if (a.length && String(a[0]).trim()) {
      items.push(`알레르기 이력: ${a.filter(Boolean).join(', ')}`)
    }
  }
  if (p?.diagnosis) {
    items.push(`주요 진단에 따른 경과 관찰이 필요할 수 있습니다.`)
  }
  if (!items.length) {
    items.push('기록 기반 자동 태깅된 주의사항이 없습니다. AI 증상체크로 보조 판단을 요청할 수 있습니다.')
  }
  return items
}

export function ClinicalPatientWorkspace({
  createNonce = 0,
  selectedPatientId,
  onSelectPatient,
  listPatients,
  onRefreshList,
  dbInfo,
  dbInfoError,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [actionError, setActionError] = useState('')

  const createNonceRef = useRef(0)

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

  useEffect(() => {
    if (!selectedPatientId) {
      setDetail(null)
      setDetailError('')
      return
    }
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      setDetailError('')
      try {
        const p = await fetchPatient(selectedPatientId)
        if (!cancelled) {
          setDetail(p)
          setDetailError('')
        }
      } catch (e) {
        if (!cancelled) {
          setDetail(null)
          setDetailError(e.message || '환자 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId])

  const openCreate = useCallback(() => {
    setModal({ mode: 'create' })
    setForm(emptyPatientForm())
    setActionError('')
  }, [])

  useEffect(() => {
    if (createNonce > createNonceRef.current) {
      openCreate()
    }
    createNonceRef.current = createNonce
  }, [createNonce, openCreate])

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.get('openCreate') !== '1') return
    openCreate()
    q.delete('openCreate')
    const s = q.toString()
    navigate({ pathname: '/', search: s ? `?${s}` : '' }, { replace: true })
  }, [location.search, openCreate, navigate])

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
        const created = await createPatient(formToCreatePayload(form))
        setModal(null)
        await onRefreshList()
        if (created?._id) onSelectPatient(created._id)
      } else if (modal?.mode === 'edit' && modal.patient?._id) {
        const patch = formToPatchPayload(form, modal.patient)
        if (Object.keys(patch).length === 0) {
          setActionError('변경된 항목이 없습니다.')
          setSaving(false)
          return
        }
        await updatePatient(modal.patient._id, patch)
        setModal(null)
        await onRefreshList()
        if (modal.patient._id === selectedPatientId) {
          const p = await fetchPatient(modal.patient._id)
          setDetail(p)
        }
      }
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
      const deletedId = deleteTarget._id
      setDeleteTarget(null)
      await onRefreshList()
      if (selectedPatientId === deletedId) onSelectPatient(null)
    } catch (e) {
      setActionError(e.message || '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const listPreview = useCallback(
    () => listPatients.find((x) => x._id === selectedPatientId),
    [listPatients, selectedPatientId],
  )

  const p = detail ?? listPreview()

  return (
    <div className="clinical-workspace">
      <section className="clinical-center" aria-label="환자 상세">
        {!selectedPatientId ? (
          <div className="clinical-empty-center">
            <h2>환자를 선택하세요</h2>
            <p>왼쪽 목록에서 환자를 선택하면 임상 요약과 기록이 표시됩니다.</p>
            <button type="button" className="clinical-btn clinical-btn-primary" onClick={openCreate}>
              새 환자 등록
            </button>
          </div>
        ) : detailLoading ? (
          <div className="clinical-detail-loading">
            <span className="spinner clinical-spinner" aria-hidden />
            불러오는 중…
          </div>
        ) : detailError ? (
          <div className="clinical-banner clinical-banner-error" role="alert">
            {detailError}
          </div>
        ) : p ? (
          <>
            <header className="clinical-detail-header">
              <div>
                <div className="clinical-detail-title-row">
                  <h1 className="clinical-patient-name">{p.name ?? '—'}</h1>
                  {p.diagnosis ? (
                    <span className="clinical-badge clinical-badge-crit">주의</span>
                  ) : null}
                </div>
                <p className="clinical-detail-meta">
                  차트 {p.chartNumber ?? '—'} · MRN 연동 ·{' '}
                  {p.department ?? '진료과 미지정'}
                </p>
              </div>
              <div className="clinical-detail-actions">
                <button type="button" className="clinical-btn clinical-btn-ghost" onClick={() => openAiModal(p)}>
                  AI 증상체크
                </button>
                <button type="button" className="clinical-btn clinical-btn-ghost" onClick={() => openEdit(p)}>
                  수정
                </button>
                <button type="button" className="clinical-btn clinical-btn-danger" onClick={() => setDeleteTarget(p)}>
                  삭제
                </button>
              </div>
            </header>

            <div className="clinical-info-bar">
              <span>
                <strong>담당의</strong> {getPatientDoctor(p)}
              </span>
              <span>
                <strong>최근 검진</strong> {formatDate(p.lastCheckupDate)}
              </span>
              <span>
                <strong>성별</strong> {p.gender ?? '—'}
              </span>
              <span>
                <strong>혈액형</strong> {p.bloodType ?? '—'}
              </span>
            </div>

            {actionError ? (
              <div className="clinical-banner clinical-banner-error" role="alert">
                {actionError}
              </div>
            ) : null}

            <div className="clinical-ai-card">
              <div className="clinical-ai-card-head">
                <span className="clinical-ai-icon" aria-hidden>
                  ◆
                </span>
                AI Clinical Summary
              </div>
              <div className="clinical-ai-card-body">
                <div className="clinical-ai-md">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                    {buildAiSummaryMarkdown(p)}
                  </ReactMarkdown>
                </div>
                <p className="clinical-concerns-label">Key concerns</p>
                <ul className="clinical-concerns-list">
                  {concernBullets(p).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                <div className="clinical-risk-row">
                  {p.allergies ? (
                    <span className="clinical-pill clinical-pill-danger">알레르기</span>
                  ) : null}
                  {p.lastCheckupDate ? (
                    <span className="clinical-pill clinical-pill-warn">검진 이력</span>
                  ) : null}
                  <span className="clinical-pill clinical-pill-info">기록 연동됨</span>
                </div>
              </div>
            </div>

            <div className="clinical-tabs">
              <span className="clinical-tab active">개요</span>
              <span className="clinical-tab disabled">검사</span>
              <span className="clinical-tab disabled">처방</span>
            </div>

            <div className="clinical-mini-grid">
              <div className="clinical-mini-card">
                <h3>진단</h3>
                <p>{p.diagnosis ?? '—'}</p>
              </div>
              <div className="clinical-mini-card">
                <h3>약물</h3>
                <p>
                  {Array.isArray(p.medications)
                    ? p.medications.join(', ') || '—'
                    : p.medications ?? '—'}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <aside className="clinical-alerts" aria-label="알림 및 조치">
        <header className="clinical-alerts-head">
          <h2>Alerts &amp; Actions</h2>
          <span className="clinical-alerts-dot" aria-hidden />
        </header>
        {!p ? (
          <p className="clinical-alerts-empty">환자를 선택하면 맥락 알림이 표시됩니다.</p>
        ) : (
          <div className="clinical-alerts-stack">
            {p.allergies ? (
              <div className="clinical-alert-card clinical-alert-critical">
                <strong>Critical · 알레르기</strong>
                <p>
                  {Array.isArray(p.allergies)
                    ? p.allergies.join(', ')
                    : String(p.allergies)}
                </p>
                <div className="clinical-alert-actions">
                  <button type="button" className="clinical-btn-link" onClick={() => openEdit(p)}>
                    기록 수정
                  </button>
                </div>
              </div>
            ) : null}
            <div className="clinical-alert-card clinical-alert-warn">
              <strong>Reminder · 검진</strong>
              <p>최근 검진일: {formatDate(p.lastCheckupDate)}. 필요 시 추적 일정을 조정하세요.</p>
            </div>
            <div className="clinical-alert-card clinical-alert-info">
              <strong>AI · 추천</strong>
              <p>증상 변화가 있으면 AI 증상체크로 요약 검토를 실행할 수 있습니다.</p>
              <div className="clinical-alert-actions">
                <button type="button" className="clinical-btn-link" onClick={() => openAiModal(p)}>
                  증상체크 열기
                </button>
              </div>
            </div>
          </div>
        )}

        {dbInfoError ? (
          <p className="clinical-db-foot clinical-db-err">{dbInfoError}</p>
        ) : dbInfo ? (
          <p className="clinical-db-foot">
            DB {dbInfo.database ?? '—'} · {dbInfo.documentCount ?? 0}건
            <a className="clinical-db-link" href={PATIENTS_DB_INFO_URL} target="_blank" rel="noreferrer">
              db-info
            </a>
          </p>
        ) : null}
      </aside>

      {modal ? (
        <div
          className="modal-backdrop clinical-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="modal clinical-modal" role="dialog" aria-labelledby="patient-modal-title">
            <div className="modal-head">
              <h2 id="patient-modal-title">{modal.mode === 'create' ? '환자 등록' : '환자 수정'}</h2>
              <button type="button" className="btn icon" onClick={closeModal} aria-label="닫기">
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
              <button type="button" className="btn ghost" onClick={closeModal} disabled={saving}>
                취소
              </button>
              <button type="button" className="btn primary" onClick={submitForm} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiPatient ? (
        <div
          className="modal-backdrop clinical-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAiModal()
          }}
        >
          <div className="modal modal-ai clinical-modal" role="dialog" aria-labelledby="ai-symptom-title">
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
                환자: <strong>{aiPatient.name ?? '—'}</strong>
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
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>{aiResultText}</ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-foot ai-modal-foot">
              <button type="button" className="btn ghost" onClick={closeAiModal} disabled={aiLoading}>
                닫기
              </button>
              <button type="button" className="btn primary" onClick={runAiSymptomCheck} disabled={aiLoading}>
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
          className="modal-backdrop clinical-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null)
          }}
        >
          <div className="modal modal-sm clinical-modal" role="dialog" aria-modal="true">
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
                {deleteTarget.chartNumber ? ` (${deleteTarget.chartNumber})` : ''} 환자를 삭제할까요?
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                취소
              </button>
              <button type="button" className="btn danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
