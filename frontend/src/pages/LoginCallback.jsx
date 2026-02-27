import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './LoginCallback.css'

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const { user, setToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const tokenApplied = useRef(false)

  // Apply token from URL once; do not navigate here (state update may not be visible yet).
  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('No token received. Please try logging in again.')
      return
    }
    if (tokenApplied.current) return
    tokenApplied.current = true
    setToken(token).catch(() => {
      setError('Failed to load user. Please try logging in again.')
    })
  }, [searchParams, setToken])

  // Navigate only after auth context has the user, so ProtectedRoute does not redirect to /login.
  useEffect(() => {
    if (user && tokenApplied.current) {
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
