import { PATIENTS_API_BASE } from '../config.js'

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

export async function fetchPatients(params = {}) {
  const res = await fetch(`${PATIENTS_API_BASE}${buildQuery(params)}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchPatient(id) {
  const res = await fetch(`${PATIENTS_API_BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createPatient(body) {
  const res = await fetch(PATIENTS_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updatePatient(id, body) {
  const res = await fetch(`${PATIENTS_API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deletePatient(id) {
  const res = await fetch(`${PATIENTS_API_BASE}/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}
