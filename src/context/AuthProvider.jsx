import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../auth/tokenStorage.js'
import { setUnauthorizedHandler } from '../api/http.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [token, setTokenState] = useState(() => getStoredToken())

  const setToken = useCallback((value) => {
    setStoredToken(value)
    setTokenState(getStoredToken())
  }, [])

  const logout = useCallback(() => {
    clearStoredToken()
    setTokenState(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredToken()
      setTokenState(null)
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      setToken,
      logout,
    }),
    [token, setToken, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
