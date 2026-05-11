import { PATIENTS_API_BASE, PATIENTS_DB_INFO_URL } from '../config.js'

/* global __VITE_DEV_PROXY_LOCAL__ */

/** 절대 URL이거나, 로컬 프록시 모드에서 `/` 로 시작하는 API 베이스만 허용 */
function assertApiBase(url, label) {
  const s = String(url ?? '').trim()
  if (/^https?:\/\//i.test(s)) return s.replace(/\/$/, '')
  if (__VITE_DEV_PROXY_LOCAL__ === true && s.startsWith('/')) {
    const t = s.replace(/\/$/, '')
    return t || '/'
  }
  throw new Error(
    `${label}는 http(s):// 전체 URL이어야 합니다. (상대 경로만 있으면 요청이 localhost:5173으로 붙습니다. 로컬 백엔드는 .env에 전체 URL 또는 VITE_DEV_PROXY_LOCAL=true 와 /api/... 조합을 쓰세요.) 현재: ${JSON.stringify(s)}`,
  )
}

const API_BASE = assertApiBase(PATIENTS_API_BASE, 'PATIENTS_API_BASE')
const DB_INFO_URL = assertApiBase(PATIENTS_DB_INFO_URL, 'PATIENTS_DB_INFO_URL')

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
  const res = await fetch(DB_INFO_URL)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchPatients(params = {}) {
  const res = await fetch(`${API_BASE}${buildQuery(params)}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchPatient(id) {
  const res = await fetch(`${API_BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createPatient(body) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updatePatient(id, body) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deletePatient(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}
