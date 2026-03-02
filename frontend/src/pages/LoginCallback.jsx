import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { exchangeCodeForSession } from '../services/api'
import './LoginCallback.css'

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const { user, loadUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const codeApplied = useRef(false)

  useEffect(() => {
    document.title = 'Signing in - Lionfish'
    return () => { document.title = 'Lionfish' }
  }, [])

  // Exchange one-time code for session cookie, then load user.
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No code received. Please try logging in again.')
      return
    }
    if (codeApplied.current) return
    codeApplied.current = true
    exchangeCodeForSession(code)
      .then(() => loadUser())
      .catch(() => {
        setError('Failed to complete sign in. Please try logging in again.')
      })
  }, [searchParams, loadUser])

  // Navigate once we have the user.
  useEffect(() => {
    if (user && codeApplied.current) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  if (error) {
    return (
      <div className="login-callback">
        <div className="login-callback-card">
          <p className="login-callback-error">{error}</p>
          <a href="/login">Back to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="login-callback">
      <p>Completing sign in…</p>
    </div>
  )
}
