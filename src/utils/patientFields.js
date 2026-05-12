/**
 * 환자 문서의 ID·표시 필드명 차이를 흡수합니다.
 * (신규: chartNumber, doctor 등 / 레거시: snake_case, attendingPhysician 등)
 */

export function toIdString(value) {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value.$oid != null) return String(value.$oid)
  return null
}

function pickFirstString(p, keys) {
  if (!p || typeof p !== 'object') return null
  for (const k of keys) {
    const v = p?.[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s !== '') return s
  }
  return null
}

/** 비어 있으면 "—", 아니면 trim 된 문자열 */
export function displayDash(value) {
  if (value == null) return '—'
  const s = String(value).trim()
  return s === '' ? '—' : s
}

export function getPatientIdString(p) {
  if (!p || typeof p !== 'object') return null
  return toIdString(p._id) ?? toIdString(p.id) ?? toIdString(p.patientId)
}

export function getPatientChartNumber(p) {
  return pickFirstString(p, [
    'chartNumber',
    'chart_no',
    'chartNo',
    'mrn',
    'patientNumber',
    'chart',
    'chartId',
  ])
}

export function getPatientName(p) {
  return pickFirstString(p, ['name', 'patientName', 'fullName', 'patient_name'])
}

export function getPatientDepartment(p) {
  return pickFirstString(p, ['department', 'dept', 'clinic', 'ward', 'division'])
}

export function getPatientDiagnosis(p) {
  return pickFirstString(p, [
    'diagnosis',
    'dx',
    'primaryDiagnosis',
    'primary_diagnosis',
    'impression',
  ])
}

export function getPatientDoctor(p) {
  const d = pickFirstString(p, ['doctor', 'attendingPhysician', 'physician', 'attending', 'md'])
  return d ?? '—'
}

/** 목록/상세 공통: `_id`를 문자열로 고정 (Mongo 확장 JSON 등) */
export function normalizePatientDocument(p) {
  if (!p || typeof p !== 'object') return p
  const id = getPatientIdString(p)
  if (id != null) return { ...p, _id: id }
  return { ...p }
}

/** 사이드바 행 React key (항상 index 포함해 유일성 보장) */
export function getPatientListRowKey(p, index) {
  const id = getPatientIdString(p)
  if (id != null) return `id-${id}-i${index}`
  const chart = getPatientChartNumber(p)
  if (chart != null) return `chart-${chart}-i${index}`
  const name = getPatientName(p)
  if (name != null) return `name-${name}-i${index}`
  return `row-i${index}`
}
