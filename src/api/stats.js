import { STATS_API_URL } from '../config.js'
import { authFetch } from './http.js'

async function parseError(res) {
  try {
    const j = await res.json()
    const msg = j.message || j.error || res.statusText
    const extra = Array.isArray(j.details) ? j.details.join('\n') : ''
    return extra ? `${msg}\n${extra}` : String(msg)
  } catch {
    return res.statusText || '요청에 실패했습니다.'
  }
}

export async function fetchStats() {
  const res = await authFetch(STATS_API_URL)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
