import { API_BASE } from '../config.js'

function authUrls() {
  const base = String(API_BASE ?? '').trim().replace(/\/$/, '')
  if (!base) {
    throw new Error(
      'API 베이스 URL이 비어 있습니다. `VITE_API_BASE` 또는 config 기본값을 확인하세요.',
    )
  }
  return {
    login: `${base}/api/auth/login`,
    register: `${base}/api/auth/register`,
  }
}

function extractToken(body) {
  if (body == null || typeof body !== 'object') return null
  return (
    body.token ??
    body.accessToken ??
    body.jwt ??
    body.access_token ??
    (body.data && typeof body.data === 'object' ? body.data.token : null) ??
    null
  )
}

function messageFromJson(j, fallback) {
  if (j == null || typeof j !== 'object') return fallback
  const msg = j.message || j.error
  const extra = Array.isArray(j.details) ? j.details.join('\n') : ''
  if (msg && extra) return `${msg}\n${extra}`
  if (msg) return String(msg)
  return fallback
}

export async function loginRequest(email, password) {
  const { login } = authUrls()
  const res = await fetch(login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  let json = {}
  try {
    json = await res.json()
  } catch {
    /* empty or non-JSON */
  }
  if (!res.ok) {
    throw new Error(messageFromJson(json, res.statusText || '로그인에 실패했습니다.'))
  }
  const token = extractToken(json)
  if (!token) {
    throw new Error('서버 응답에 토큰이 없습니다. 백엔드 응답 형식을 확인하세요.')
  }
  return { token, raw: json }
}

export async function registerRequest(email, password, name) {
  const { register } = authUrls()
  const res = await fetch(register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  let json = {}
  try {
    json = await res.json()
  } catch {
    /* empty or non-JSON */
  }
  if (!res.ok) {
    throw new Error(
      messageFromJson(json, res.statusText || '회원가입에 실패했습니다.'),
    )
  }
  const token = extractToken(json)
  return { token: token ?? null, raw: json }
}
