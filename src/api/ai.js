import { API_BASE, PATIENTS_API_BASE } from '../config.js'
import { authFetch } from './http.js'

function symptomCheckUrl() {
  const base = String(API_BASE ?? '').trim().replace(/\/$/, '')
  if (!base) {
    throw new Error(
      'API 베이스 URL이 비어 있습니다. `VITE_API_BASE` 또는 config 기본값을 확인하세요.',
    )
  }
  return `${base}/api/ai/symptom-check`
}

function messageFromJson(j, fallback) {
  if (j == null || typeof j !== 'object') return fallback
  const msg = j.message || j.error
  const extra = Array.isArray(j.details) ? j.details.join('\n') : ''
  if (msg && extra) return `${msg}\n${extra}`
  if (msg) return String(msg)
  return fallback
}

async function readJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function assertApiBase() {
  const base = String(API_BASE ?? '').trim().replace(/\/$/, '')
  if (!base) {
    throw new Error(
      'API 베이스 URL이 비어 있습니다. `VITE_API_BASE` 또는 config 기본값을 확인하세요.',
    )
  }
  return base
}

function toPatientAge(value) {
  if (value == null || value === '') return undefined
  const n =
    typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < 0 || n > 150) return undefined
  return Math.trunc(n)
}

/**
 * POST /api/ai/symptom-check
 * 백엔드는 `patientAge`에 0~150 정수(숫자 타입)를 기대합니다.
 */
export async function postSymptomCheck({ symptoms, age, patientId }) {
  const url = symptomCheckUrl()
  const body = {
    symptoms: String(symptoms ?? '').trim(),
  }
  const patientAge = toPatientAge(age)
  if (patientAge !== undefined) {
    body.patientAge = patientAge
  }
  if (patientId != null && patientId !== '') {
    body.patientId = patientId
  }
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json = {}
  try {
    json = await res.json()
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || '증상 분석 요청에 실패했습니다.'),
    )
  }
  return json
}

/**
 * API 본문의 `result`에서 마크다운 텍스트만 꺼냅니다.
 * 전체 JSON을 문자열로 보여 주지 않습니다.
 */
function extractSymptomTextFromResult(result) {
  if (result == null) return ''
  if (typeof result === 'string') return result.trim()
  if (typeof result === 'number' || typeof result === 'boolean') {
    return String(result)
  }
  if (Array.isArray(result)) {
    const parts = result
      .map((item) => extractSymptomTextFromResult(item))
      .filter((s) => s && String(s).trim())
    return parts.join('\n\n').trim()
  }
  if (typeof result === 'object') {
    for (const key of [
      'text',
      'markdown',
      'content',
      'message',
      'answer',
      'output',
      'analysis',
    ]) {
      const v = result[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return ''
}

export function formatSymptomCheckResponse(data) {
  if (data == null) return ''
  if (typeof data === 'string') return data.trim()

  const fromResult = extractSymptomTextFromResult(data.result)
  if (fromResult) return fromResult

  return ''
}

/**
 * GET /api/patients/:patientId/images
 * @returns {Promise<object>} 서버 JSON 본문
 */
export async function fetchPatientImages(patientId) {
  const pid = encodeURIComponent(String(patientId ?? ''))
  const url = `${PATIENTS_API_BASE}/${pid}/images`
  const res = await authFetch(url, { method: 'GET' })
  const json = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || '영상 목록을 불러오지 못했습니다.'),
    )
  }
  return json
}

/**
 * POST /api/patients/:patientId/images
 * FormData: `image`, `imageType`
 */
export async function uploadPatientImage(patientId, file, imageType) {
  const pid = encodeURIComponent(String(patientId ?? ''))
  const url = `${PATIENTS_API_BASE}/${pid}/images`
  const fd = new FormData()
  fd.append('image', file)
  fd.append('imageType', String(imageType ?? ''))
  const res = await authFetch(url, { method: 'POST', body: fd })
  const json = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || '영상 업로드에 실패했습니다.'),
    )
  }
  return json
}

/**
 * POST /api/ai/patients/:patientId/images/:imageId/analyze
 */
export async function analyzePatientImage(patientId, imageId) {
  const base = assertApiBase()
  const pid = encodeURIComponent(String(patientId ?? ''))
  const iid = encodeURIComponent(String(imageId ?? ''))
  const url = `${base}/api/ai/patients/${pid}/images/${iid}/analyze`
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const json = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || 'AI 영상 분석에 실패했습니다.'),
    )
  }
  return json
}

/**
 * GET /api/patients/:patientId/images/:imageId (base64 등 포함)
 */
export async function fetchPatientImage(patientId, imageId) {
  const pid = encodeURIComponent(String(patientId ?? ''))
  const iid = encodeURIComponent(String(imageId ?? ''))
  const url = `${PATIENTS_API_BASE}/${pid}/images/${iid}`
  const res = await authFetch(url, { method: 'GET' })
  const json = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || '영상 정보를 불러오지 못했습니다.'),
    )
  }
  return json
}
