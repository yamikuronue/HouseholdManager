import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './LoginCallback.css'

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setToken(token)
      navigate('/dashboard', { replace: true })
    } else {
      setError('No token received. Please try logging in again.')
    }
  }, [searchParams, setToken, navigate])

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
