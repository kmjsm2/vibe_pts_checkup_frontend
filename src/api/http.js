import { getStoredToken } from '../auth/tokenStorage.js'

let onUnauthorized = null

export function setUnauthorizedHandler(fn) {
  onUnauthorized = typeof fn === 'function' ? fn : null
}

/**
 * 모든 API 호출에 `Authorization: Bearer`를 붙입니다. 토큰이 없으면 헤더만 생략합니다.
 */
export async function authFetch(input, init = {}) {
  const token = getStoredToken()
  const headers = new Headers(init.headers ?? undefined)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 && onUnauthorized) {
    onUnauthorized()
  }
  return res
}
