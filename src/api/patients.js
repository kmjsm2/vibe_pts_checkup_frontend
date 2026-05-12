import { PATIENTS_API_BASE, PATIENTS_DB_INFO_URL } from '../config.js'
import { authFetch } from './http.js'
import { normalizePatientDocument } from '../utils/patientFields.js'

async function parseError(res) {
  try {
    const j = await res.json()
    const msg = j.message || res.statusText
    const extra = Array.isArray(j.details) ? j.details.join('\n') : ''
    return extra ? `${msg}\n${extra}` : msg
  } catch {
    return res.statusText || '요청에 실패했습니다.'
  }
}

/**
 * 백엔드마다 목록 필드명이 다를 수 있어 단일 형태로 맞춥니다.
 * (`patients`, `data`, `items`, `docs`, `results` 등)
 */
export function normalizePatientsListResponse(body) {
  if (body == null) {
    return { patients: [], total: 0, dbTotal: 0 }
  }
  if (Array.isArray(body)) {
    return {
      patients: body.map((row) => normalizePatientDocument(row)),
      total: body.length,
      dbTotal: body.length,
    }
  }
  if (typeof body !== 'object') {
    return { patients: [], total: 0, dbTotal: 0 }
  }

  /* { data: { patients: [...] } } 형태 */
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    const d = body.data
    const inner =
      d.patients ??
      d.list ??
      d.items ??
      d.docs ??
      d.results ??
      d.records
    if (Array.isArray(inner)) {
      return {
        patients: inner.map((row) => normalizePatientDocument(row)),
        total: Number(body.total ?? d.total ?? inner.length) || 0,
        dbTotal:
          Number(body.dbTotal ?? d.dbTotal ?? d.totalDocuments ?? inner.length) || 0,
      }
    }
  }

  const raw =
    body.patients ??
    body.list ??
    body.rows ??
    body.result ??
    body.data ??
    body.items ??
    body.docs ??
    body.results ??
    body.records ??
    (Array.isArray(body.payload) ? body.payload : null)

  const patients = Array.isArray(raw)
    ? raw.map((row) => normalizePatientDocument(row))
    : []

  const total = Number(body.total ?? body.count ?? patients.length) || 0
  const dbTotal =
    Number(
      body.dbTotal ??
        body.totalDocuments ??
        body.dbCount ??
        body.totalCount ??
        total,
    ) || 0

  return { patients, total, dbTotal }
}

function buildQuery(params) {
  const q = new URLSearchParams()
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.skip != null) q.set('skip', String(params.skip))
  const t = (s) => (typeof s === 'string' ? s.trim() : '')
  if (t(params.search)) q.set('search', t(params.search))
  if (t(params.department)) q.set('department', t(params.department))
  if (t(params.physician)) q.set('physician', t(params.physician))
  if (t(params.bloodType)) q.set('bloodType', t(params.bloodType))
  if (t(params.gender)) q.set('gender', t(params.gender))
  if (t(params.recordSource)) q.set('recordSource', t(params.recordSource))
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchPatientsDbInfo() {
  const res = await authFetch(PATIENTS_DB_INFO_URL)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchPatients(params = {}) {
  const res = await authFetch(`${PATIENTS_API_BASE}${buildQuery(params)}`)
  if (!res.ok) throw new Error(await parseError(res))
  const body = await res.json()
  return normalizePatientsListResponse(body)
}

export async function fetchPatient(id) {
  const res = await authFetch(`${PATIENTS_API_BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  const body = await res.json()
  const doc =
    body && typeof body === 'object' && body.data && typeof body.data === 'object'
      ? body.data
      : body
  return normalizePatientDocument(doc)
}

export async function createPatient(body) {
  const res = await authFetch(PATIENTS_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updatePatient(id, body) {
  const res = await authFetch(`${PATIENTS_API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deletePatient(id) {
  const res = await authFetch(`${PATIENTS_API_BASE}/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}
