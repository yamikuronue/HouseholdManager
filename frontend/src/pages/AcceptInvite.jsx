import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getInvitationByToken, acceptInvitation } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'
import './AcceptInvite.css'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(!!token)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Accept invitation - Lionfish'
    return () => { document.title = 'Lionfish' }
  }, [])

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
      const res = await acceptInvitation({ token, user_id: user.id })
      const householdId = res?.household_id ?? invitation?.household_id
      if (householdId != null) {
        navigate(`/onboarding?household_id=${householdId}`, { replace: true })
      } else {
        setAccepted(true)
        setTimeout(() => navigate('/dashboard'), 2000)
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="accept-invite-wrapper">
        <div className="accept-invite-loading">Loading…</div>
        <Footer />
      </div>
    )
  }

  if (!token || error) {
    return (
      <div className="accept-invite-wrapper">
        <div className="accept-invite-page">
          <div className="accept-invite-card">
            <h1>Invalid invite</h1>
            <p>{error || 'Missing token.'}</p>
            <a href="/dashboard">Go to Dashboard</a>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="accept-invite-wrapper">
        <div className="accept-invite-page">
          <div className="accept-invite-card">
            <h1>Sign in to accept</h1>
            <p>You need to log in with Google to accept this household invite.</p>
            <a href="/login">Login with Google</a>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="accept-invite-wrapper">
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
      <Footer />
    </div>
  )
}
