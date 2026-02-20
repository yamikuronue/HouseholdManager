import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const { user, loading, login } = useAuth()

  if (loading) return <div className="login-loading">Loading…</div>
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>HouseholdManager</h1>
        <p>Sign in with your Google account to manage households and calendars.</p>
        <button type="button" className="login-google-btn" onClick={login}>
          Login with Google
        </button>
      </div>
    </div>
  )
}
