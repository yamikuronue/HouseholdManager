import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { exchangeCodeForSession, listMyPendingInvitations } from '../services/api'
import Footer from '../components/Footer'
import './LoginCallback.css'

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const { user, loadUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const codeApplied = useRef(false)
  const redirectedAfterLogin = useRef(false)

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
    const routeAfterLogin = async () => {
      if (!user || !codeApplied.current || redirectedAfterLogin.current) return
      redirectedAfterLogin.current = true
      try {
        const pending = await listMyPendingInvitations()
        if (Array.isArray(pending) && pending.length > 0) {
          navigate('/settings?pending_invites=1', { replace: true })
          return
        }
      } catch {
        // If this check fails, fall back to dashboard.
      }
      navigate('/dashboard', { replace: true })
    }
    routeAfterLogin()
  }, [user, navigate])

  if (error) {
    return (
      <div className="login-callback-wrapper">
        <div className="login-callback">
          <div className="login-callback-card">
            <p className="login-callback-error">{error}</p>
            <a href="/login">Back to Login</a>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="login-callback-wrapper">
      <div className="login-callback">
        <p>Completing sign in…</p>
      </div>
      <Footer />
    </div>
  )
}
