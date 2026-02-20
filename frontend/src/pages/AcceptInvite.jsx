import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getInvitationByToken, acceptInvitation } from '../services/api'
import { useAuth } from '../context/AuthContext'
import './AcceptInvite.css'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(!!token)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Missing invite token in URL.')
      setLoading(false)
      return
    }
    getInvitationByToken(token)
      .then(setInvitation)
      .catch((e) => setError(e.response?.data?.detail || 'Invitation not found'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async () => {
    if (!user || !token) return
    setError('')
    try {
      await acceptInvitation({ token, user_id: user.id })
      setAccepted(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  if (authLoading || loading) {
    return <div className="accept-invite-loading">Loading…</div>
  }

  if (!token || error) {
    return (
      <div className="accept-invite-page">
        <div className="accept-invite-card">
          <h1>Invalid invite</h1>
          <p>{error || 'Missing token.'}</p>
          <a href="/dashboard">Go to Dashboard</a>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="accept-invite-page">
        <div className="accept-invite-card">
          <h1>Sign in to accept</h1>
          <p>You need to log in with Google to accept this household invite.</p>
          <a href="/login">Login with Google</a>
        </div>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="accept-invite-page">
        <div className="accept-invite-card accept-invite-success">
          <h1>You’re in!</h1>
          <p>Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="accept-invite-page">
      <div className="accept-invite-card">
        <h1>Accept invitation</h1>
        {invitation && (
          <>
            <p>
              You’ve been invited to join a household (invite sent to{' '}
              <strong>{invitation.email}</strong>).
            </p>
            <p className="accept-invite-as">
              You’re signed in as <strong>{user.email}</strong>. Accept to join the household.
            </p>
          </>
        )}
        {error && <p className="accept-invite-error">{error}</p>}
        <button type="button" className="accept-invite-btn" onClick={handleAccept}>
          Accept invite
        </button>
      </div>
    </div>
  )
}
