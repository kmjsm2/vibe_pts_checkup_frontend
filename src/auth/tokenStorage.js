const STORAGE_KEY = 'pts_checkup_jwt'

export function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    if (token == null || token === '') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(token))
    }
  } catch {
    /* ignore */
  }
}

export function clearStoredToken() {
  setStoredToken(null)
}

export { STORAGE_KEY }
