import { AUTH_LOGIN_URL, AUTH_REGISTER_URL } from '../config.js'

function assertHttpsUrl(url, label) {
  if (!/^https?:\/\//i.test(String(url))) {
    throw new Error(
      `${label}이(가) http(s) 절대 URL이 아닙니다. VITE_API_BASE와 빌드 로그를 확인하세요. 현재: ${JSON.stringify(url)}`,
    )
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

export function getAuthRegisterUrl() {
  return AUTH_REGISTER_URL
}

export function getAuthLoginUrl() {
  return AUTH_LOGIN_URL
}

export async function loginRequest(email, password) {
  assertHttpsUrl(AUTH_LOGIN_URL, '로그인 URL')
  const res = await fetch(AUTH_LOGIN_URL, {
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
  assertHttpsUrl(AUTH_REGISTER_URL, '회원가입 URL')
  const res = await fetch(AUTH_REGISTER_URL, {
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
