import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { loginRequest, registerRequest } from '../api/auth.js'
import { useAuth } from '../hooks/useAuth.js'

export function LoginPage() {
  const { isAuthenticated, setToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { token } = await loginRequest(email, password)
        setToken(token)
        navigate(from, { replace: true })
      } else {
        const trimmedName = name.trim()
        if (!trimmedName) {
          setError('이름을 입력해 주세요.')
          setSubmitting(false)
          return
        }
        const { token } = await registerRequest(email, password, trimmedName)
        if (token) {
          setToken(token)
          navigate(from, { replace: true })
        } else {
          const { token: t2 } = await loginRequest(email, password)
          setToken(t2)
          navigate(from, { replace: true })
        }
      }
    } catch (err) {
      setError(err.message || '요청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page clinical-login-dark">
      <div className="login-card">
        <h1 className="login-title">{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p className="login-lead">
          {mode === 'login'
            ? '이메일과 비밀번호를 입력하세요.'
            : '이름, 이메일, 비밀번호를 입력하세요.'}{' '}
          JWT는 이 브라우저의 <code className="inline-code">localStorage</code>에
          저장됩니다.
        </p>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
              setName('')
            }}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            회원가입
          </button>
        </div>

        {error ? (
          <div className="banner error login-error" role="alert">
            {error}
          </div>
        ) : null}

        <form className="login-form" onSubmit={onSubmit}>
          {mode === 'register' ? (
            <label className="login-field">
              <span>이름</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
                disabled={submitting}
                placeholder="홍길동"
              />
            </label>
          ) : null}
          <label className="login-field">
            <span>이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              disabled={submitting}
            />
          </label>
          <label className="login-field">
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={4}
              disabled={submitting}
            />
          </label>
          <button type="submit" className="btn primary login-submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner spinner-inline" aria-hidden />
                처리 중…
              </>
            ) : mode === 'login' ? (
              '로그인'
            ) : (
              '가입하기'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
