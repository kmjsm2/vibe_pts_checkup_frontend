import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  analyzePatientImage,
  fetchPatientImage,
  fetchPatientImages,
  formatSymptomCheckResponse,
  postSymptomCheck,
  uploadPatientImage,
} from '../../api/ai.js'
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

const IMAGING_TYPE_OPTIONS = [
  { id: 'xray', label: 'X-ray' },
  { id: 'ct', label: 'CT' },
  { id: 'mri', label: 'MRI' },
]

function imagingTypeLabel(type) {
  const o = IMAGING_TYPE_OPTIONS.find((x) => x.id === type)
  return o ? o.label : String(type ?? '—')
}

function normalizeServerImageType(t) {
  const s = String(t ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
  if (s === 'x-ray' || s === 'xray' || s === 'xr' || s === 'cr') return 'xray'
  if (s === 'ct') return 'ct'
  if (s === 'mri') return 'mri'
  return s || 'xray'
}

function normalizeImagesList(body) {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return []
  const inner = body.images ?? body.data ?? body.items ?? body.docs ?? body.results
  return Array.isArray(inner) ? inner : []
}

function getImageRowId(row) {
  if (!row || typeof row !== 'object') return null
  return row._id ?? row.id ?? row.imageId ?? null
}

function getImageSortTime(row) {
  const t = row?.createdAt ?? row?.uploadedAt ?? row?.created ?? row?.date ?? row?.timestamp
  const d = t ? new Date(t) : new Date(0)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

function toDataUrlFromDetail(detail) {
  if (!detail || typeof detail !== 'object') return ''
  const raw =
    detail.imageDataUrl ??
    detail.imageUrl ??
    detail.url ??
    (typeof detail.image === 'string' ? detail.image : null) ??
    detail.base64 ??
    detail.data ??
    detail.content
  if (raw == null || typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s) return ''
  if (s.startsWith('data:')) return s
  const mime =
    (typeof detail.mimeType === 'string' && detail.mimeType) ||
    (typeof detail.contentType === 'string' && detail.contentType) ||
    'image/png'
  return `data:${mime};base64,${s}`
}

function timelineThumbSrc(row) {
  if (!row || typeof row !== 'object') return ''
  const u = row.thumbnailUrl ?? row.thumbUrl ?? row.previewUrl
  if (typeof u === 'string' && u.trim()) {
    const t = u.trim()
    return t.startsWith('data:') || /^https?:/i.test(t) ? t : toDataUrlFromDetail({ image: t, mimeType: row.mimeType })
  }
  const b = row.thumbnail ?? row.thumbnailBase64 ?? row.thumb
  if (typeof b === 'string' && b.trim()) {
    return toDataUrlFromDetail({ image: b.trim(), mimeType: row.thumbnailMime ?? row.mimeType })
  }
  return ''
}

function extractOpinion(detail, extra) {
  const base = { ...(detail && typeof detail === 'object' ? detail : {}), ...(extra && typeof extra === 'object' ? extra : {}) }
  const inner = base.analysis && typeof base.analysis === 'object' ? base.analysis : {}
  const from = { ...base, ...inner }
  const join = (v) => {
    if (v == null) return ''
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join('\n')
    return String(v).trim()
  }
  return {
    findings: join(from.findings ?? from.finding),
    impression: join(from.impression),
    recommendation: join(from.recommendation ?? from.recommendations),
    confidence: Number(from.confidence),
    analyzedAt: from.analyzedAt ?? from.analysisDate ?? from.updatedAt ?? '',
    imageType: from.imageType ?? from.type ?? base.imageType,
  }
}

function confidenceTone(conf) {
  const n = Number(conf)
  if (!Number.isFinite(n)) return 'none'
  if (n >= 80) return 'high'
  if (n >= 50) return 'mid'
  return 'low'
}

function formatImagingDate(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 영상 검사 탭: 서버 이미지 목록·업로드·AI 분석 */
function ImagingTab({ patientId }) {
  const [uploadType, setUploadType] = useState('xray')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const [rows, setRows] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [selectedId, setSelectedId] = useState(null)
  const [imageDetail, setImageDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [opinionExtra, setOpinionExtra] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadList = useCallback(async () => {
    if (patientId == null || patientId === '') {
      setRows([])
      setListLoading(false)
      return
    }
    setListError('')
    setListLoading(true)
    try {
      const body = await fetchPatientImages(patientId)
      const list = normalizeImagesList(body)
      const sorted = [...list].sort((a, b) => getImageSortTime(a) - getImageSortTime(b))
      setRows(sorted)
    } catch (e) {
      setListError(e.message || '영상 목록을 불러오지 못했습니다.')
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    setSelectedId(null)
    setImageDetail(null)
    setOpinionExtra(null)
    setDetailError('')
    setActionError('')
  }, [patientId])

  useEffect(() => {
    if (selectedId == null || patientId == null || patientId === '') {
      setImageDetail(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      setDetailError('')
      setOpinionExtra(null)
      try {
        const d = await fetchPatientImage(patientId, selectedId)
        if (!cancelled) setImageDetail(d)
      } catch (e) {
        if (!cancelled) {
          setImageDetail(null)
          setDetailError(e.message || '영상을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, selectedId])

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null)
      return
    }
    setSelectedId((cur) => {
      if (cur != null && rows.some((r) => getImageRowId(r) === cur)) return cur
      return getImageRowId(rows[rows.length - 1])
    })
  }, [rows])

  const addFiles = async (fileList) => {
    if (patientId == null || patientId === '') return
    const list = Array.from(fileList ?? []).filter(
      (f) => f.type === 'image/jpeg' || f.type === 'image/png',
    )
    if (!list.length) return
    setActionError('')
    setUploading(true)
    try {
      for (const file of list) {
        await uploadPatientImage(patientId, file, uploadType)
      }
      await loadList()
    } catch (e) {
      setActionError(e.message || '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    void addFiles(e.dataTransfer?.files)
  }

  const onAnalyze = async () => {
    if (selectedId == null || patientId == null || patientId === '') return
    setActionError('')
    setAnalyzeLoading(true)
    try {
      const out = await analyzePatientImage(patientId, selectedId)
      setOpinionExtra(out)
      const d = await fetchPatientImage(patientId, selectedId)
      setImageDetail(d)
    } catch (e) {
      setActionError(e.message || 'AI 분석에 실패했습니다.')
    } finally {
      setAnalyzeLoading(false)
    }
  }

  const previewSrc = toDataUrlFromDetail(imageDetail)
  const opinion = extractOpinion(imageDetail, opinionExtra)
  const typeKey = normalizeServerImageType(opinion.imageType ?? imageDetail?.imageType ?? uploadType)
  const conf = opinion.confidence
  const confTone = confidenceTone(conf)
  const confPct = Number.isFinite(conf) ? Math.min(100, Math.max(0, conf)) : null

  if (patientId == null || patientId === '') {
    return (
      <div className="clinical-imaging-tab">
        <p className="clinical-imaging-lead">환자를 선택한 뒤 영상을 관리할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="clinical-imaging-tab">
      {listError ? (
        <div className="clinical-banner clinical-banner-error" role="alert">
          {listError}
        </div>
      ) : null}
      {actionError ? (
        <div className="clinical-banner clinical-banner-error" role="alert">
          {actionError}
        </div>
      ) : null}

      <p className="clinical-imaging-lead">서버에 저장된 영상을 불러오고, 업로드·AI 소견을 요청합니다.</p>

      <div className="clinical-imaging-type-row" role="group" aria-label="업로드 시 영상 종류">
        {IMAGING_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={uploading}
            className={`clinical-imaging-type-btn${uploadType === opt.id ? ' active' : ''}`}
            onClick={() => setUploadType(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={uploading}
        className={`clinical-imaging-drop${dragOver ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
        }}
        onDrop={onDrop}
      >
        <span className="clinical-imaging-drop-title">
          {uploading ? '업로드 중…' : '이미지를 끌어 놓거나 클릭하여 업로드'}
        </span>
        <span className="clinical-imaging-drop-hint">JPEG, PNG만 가능합니다.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="clinical-imaging-file-input"
        accept="image/jpeg,image/png"
        multiple
        aria-hidden
        tabIndex={-1}
        disabled={uploading}
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="clinical-imaging-timeline-wrap">
        <div className="clinical-imaging-timeline-label">영상 타임라인 (날짜순)</div>
        {listLoading ? (
          <div className="clinical-imaging-timeline-loading">
            <span className="spinner clinical-spinner" aria-hidden />
          </div>
        ) : rows.length === 0 ? (
          <p className="clinical-imaging-timeline-empty">등록된 영상이 없습니다. 위에서 업로드하세요.</p>
        ) : (
          <div className="clinical-imaging-timeline" role="list">
            {rows.map((row, idx) => {
              const id = getImageRowId(row)
              const active = id != null && id === selectedId
              const thumb = timelineThumbSrc(row)
              const t = row?.createdAt ?? row?.uploadedAt ?? row?.created ?? row?.date
              return (
                <button
                  key={id != null ? String(id) : `row-${idx}`}
                  type="button"
                  role="listitem"
                  className={`clinical-imaging-timeline-item${active ? ' active' : ''}`}
                  onClick={() => id != null && setSelectedId(id)}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="clinical-imaging-timeline-img" />
                  ) : (
                    <div className="clinical-imaging-timeline-placeholder" aria-hidden>
                      ◧
                    </div>
                  )}
                  <span className="clinical-imaging-timeline-date">{formatImagingDate(t)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="clinical-imaging-result-wrap">
        {analyzeLoading ? (
          <div className="clinical-imaging-analyze-overlay" role="status" aria-live="polite">
            <span className="spinner clinical-spinner" aria-hidden />
            <p>AI가 영상을 분석하고 있습니다…</p>
          </div>
        ) : null}

        {detailLoading ? (
          <div className="clinical-imaging-detail-loading">
            <span className="spinner clinical-spinner" aria-hidden />
            <span>영상을 불러오는 중…</span>
          </div>
        ) : detailError ? (
          <div className="clinical-banner clinical-banner-error" role="alert">
            {detailError}
          </div>
        ) : selectedId == null ? (
          <p className="clinical-imaging-timeline-empty">표시할 영상이 없습니다.</p>
        ) : (
          <div className="clinical-imaging-result">
            <div className="clinical-imaging-preview-col">
              <div className="clinical-imaging-preview-frame">
                {previewSrc ? (
                  <img src={previewSrc} alt="선택한 영상" className="clinical-imaging-preview-img" />
                ) : (
                  <div className="clinical-imaging-preview-empty">미리보기 데이터가 없습니다.</div>
                )}
              </div>
            </div>
            <div className="clinical-imaging-opinion-col">
              <header className="clinical-imaging-opinion-head">
                <h3 className="clinical-imaging-opinion-title">🔬 AI 영상 소견</h3>
                <div className="clinical-imaging-opinion-meta">
                  <span className="clinical-imaging-type-badge">{imagingTypeLabel(typeKey)}</span>
                  <span className="clinical-imaging-opinion-date">
                    분석: {opinion.analyzedAt ? formatImagingDate(opinion.analyzedAt) : '—'}
                  </span>
                </div>
              </header>

              <section className="clinical-imaging-opinion-section">
                <h4>Findings</h4>
                <p>{opinion.findings || '—'}</p>
              </section>
              <section className="clinical-imaging-opinion-section">
                <h4>Impression</h4>
                <p>{opinion.impression || '—'}</p>
              </section>
              <section className="clinical-imaging-opinion-section">
                <h4>Recommendation</h4>
                <p>{opinion.recommendation || '—'}</p>
              </section>

              {confPct != null ? (
                <div className="clinical-imaging-confidence">
                  <div className="clinical-imaging-confidence-label">
                    <span>Confidence</span>
                    <span>{Math.round(confPct)}%</span>
                  </div>
                  <div className="clinical-imaging-confidence-track">
                    <div
                      className={`clinical-imaging-confidence-fill clinical-imaging-confidence-${confTone}`}
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <p className="clinical-imaging-disclaimer">
                ⚠️ 본 소견은 AI 보조 도구로 생성되었습니다. 최종 판독 및 진단은 반드시 전문의가 확인해야 합니다. (식약처
                SaMD 가이드라인 준수)
              </p>

              <div className="clinical-imaging-actions">
                <button
                  type="button"
                  className="clinical-btn clinical-btn-ai"
                  disabled={analyzeLoading || detailLoading}
                  onClick={() => void onAnalyze()}
                >
                  AI 소견 생성
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
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

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [selectedPatientId])

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
              <span
                className={`clinical-tab${activeTab === 'overview' ? ' active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                개요
              </span>
              <span
                className={`clinical-tab${activeTab === 'imaging' ? ' active' : ''}`}
                onClick={() => setActiveTab('imaging')}
              >
                영상 검사
              </span>
              <span
                className={`clinical-tab${activeTab === 'prescription' ? ' active' : ''}`}
                onClick={() => setActiveTab('prescription')}
              >
                처방
              </span>
            </div>

            {activeTab === 'overview' && (
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
            )}

            {activeTab === 'imaging' && <ImagingTab patientId={p._id} />}

            {activeTab === 'prescription' && (
              <div className="clinical-mini-card">
                <h3>처방 내역</h3>
                <p>처방 데이터가 없습니다.</p>
              </div>
            )}
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
