import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'
import './Login.css'

export default function Login() {
  const { user, loading, login } = useAuth()

  useEffect(() => {
    document.title = 'Login - Lionfish'
    return () => { document.title = 'Lionfish' }
  }, [])

  if (loading) return <div className="login-loading">Loading…</div>
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="login-page">
      <div className="login-page-content">
      <div className="login-card">
        <img src="/logo.jpg" alt="Lionfish" className="login-logo" />
        <h1>Lionfish</h1>
        <p className="login-tagline">
          A private control center for your household schedules, meals, and tasks.
        </p>
        <ul className="login-feature-list">
          <li>Connect multiple Google Calendars into one shared view</li>
          <li>See everyone’s events color‑coded on a single dashboard</li>
          <li>Plan meals and grocery lists per household</li>
          <li>Share access with family members via invite links</li>
        </ul>
        <p className="login-cta-help">
          Sign in with Google to create or join a household. You can revoke access at any time in
          your Google account settings.
        </p>
        <button type="button" className="login-google-btn" onClick={login}>
          Login with Google
        </button>
      </div>
      </div>
      <Footer />
    </div>
  )
}
