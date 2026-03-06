import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  getHousehold,
  listMembers,
  updateMember,
  getGoogleCalendars,
  listCalendars,
  createCalendar,
  deleteCalendar,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import './Onboarding.css'

const DEFAULT_PASTEL_COLORS = [
  '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
  '#E0BBE4', '#FFDFBA', '#B5EAD7', '#C7CEEA',
]

export default function Onboarding() {
  const [searchParams] = useSearchParams()
  const householdIdParam = searchParams.get('household_id')
  const householdId = householdIdParam ? parseInt(householdIdParam, 10) : null
  const { user } = useAuth()
  const navigate = useNavigate()

  const [household, setHousehold] = useState(null)
  const [myMember, setMyMember] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [googleCalendars, setGoogleCalendars] = useState([])
  const [calendarListLoading, setCalendarListLoading] = useState(false)
  const [myCalendars, setMyCalendars] = useState([])
  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = useState('')
  const [addingCalendar, setAddingCalendar] = useState(false)

  const loadHouseholdAndMember = useCallback(async () => {
    if (!householdId || !user) return
    setError('')
    try {
      const [h, memberList] = await Promise.all([
        getHousehold(householdId),
        listMembers(householdId),
      ])
      setHousehold(h)
      setMembers(memberList)
      const me = memberList.find((m) => Number(m.user_id) === Number(user.id))
      setMyMember(me || null)
      if (me) {
        const cals = await listCalendars({ member_id: me.id })
        setMyCalendars(cals)
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [householdId, user])

  useEffect(() => {
    document.title = 'Welcome - Lionfish'
    return () => { document.title = 'Lionfish' }
  }, [])

  useEffect(() => {
    loadHouseholdAndMember()
  }, [loadHouseholdAndMember])

  const loadGoogleCalendars = useCallback(async () => {
    if (!user) return
    setCalendarListLoading(true)
    try {
      const list = await getGoogleCalendars()
      setGoogleCalendars(list)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setCalendarListLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user && myMember) loadGoogleCalendars()
  }, [user, myMember, loadGoogleCalendars])

  const handleColorChange = async (hex) => {
    if (!myMember) return
    setError('')
    try {
      await updateMember(myMember.id, { event_color: hex })
      setMyMember((prev) => (prev ? { ...prev, event_color: hex } : null))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleAddCalendar = async (e) => {
    e.preventDefault()
    if (!selectedGoogleCalendarId || !myMember) return
    setError('')
    setAddingCalendar(true)
    try {
      const selected = googleCalendars.find((c) => c.id === selectedGoogleCalendarId)
      if (!selected) {
        setError('Please select a calendar.')
        return
      }
      await createCalendar({
        household_id: householdId,
        member_id: myMember.id,
        google_calendar_id: selected.id,
        name: selected.summary,
      })
      setSelectedGoogleCalendarId('')
      const cals = await listCalendars({ member_id: myMember.id })
      setMyCalendars(cals)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setAddingCalendar(false)
    }
  }

  const handleRemoveCalendar = async (cal) => {
    if (!window.confirm(`Remove "${cal.name}" from this household?`)) return
    setError('')
    try {
      await deleteCalendar(cal.id)
      setMyCalendars((prev) => prev.filter((c) => c.id !== cal.id))
      loadHouseholdAndMember()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleContinue = () => {
    navigate('/dashboard', { replace: true })
  }

  if (!householdId) {
    navigate('/dashboard', { replace: true })
    return null
  }

  if (loading) {
    return (
      <div className="onboarding">
        <div className="onboarding-loading">Loading…</div>
      </div>
    )
  }

  if (error && !household) {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-error">
          <h1>Something went wrong</h1>
          <p>{error}</p>
          <button type="button" className="onboarding-btn" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  const householdName = household?.name ?? 'your new household'

  return (
    <div className="onboarding">
      <main className="onboarding-main">
        <div className="onboarding-card">
          <h1 className="onboarding-title">You’re in!</h1>
          <p className="onboarding-welcome">
            Welcome to <strong>{householdName}</strong>. Set your color and calendars below, then continue to the dashboard.
          </p>

          {error && (
            <div className="onboarding-error-msg" role="alert">
              {error}
            </div>
          )}

          {/* Pick your color */}
          <section className="onboarding-section">
            <h2>Pick your color</h2>
            <p className="onboarding-muted">
              Your events and meal planner entries will use this color in the household.
            </p>
            <div className="onboarding-color-row">
              {DEFAULT_PASTEL_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="onboarding-color-swatch"
                  style={{ backgroundColor: hex }}
                  title={hex}
                  aria-label={`Use ${hex}`}
                  onClick={() => handleColorChange(hex)}
                  aria-pressed={myMember?.event_color === hex}
                />
              ))}
              <label className="onboarding-color-custom">
                <input
                  type="color"
                  value={myMember?.event_color || DEFAULT_PASTEL_COLORS[0]}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="onboarding-color-input"
                />
                <span>Custom</span>
              </label>
            </div>
          </section>

          {/* Calendars */}
          <section className="onboarding-section">
            <h2>Add a calendar (optional)</h2>
            <p className="onboarding-muted">
              Link a Google calendar so its events show on the household dashboard. You can add more later in Settings.
            </p>
            {myCalendars.length > 0 && (
              <ul className="onboarding-calendar-list">
                {myCalendars.map((cal) => (
                  <li key={cal.id} className="onboarding-calendar-item">
                    <span>{cal.name}</span>
                    <button
                      type="button"
                      className="onboarding-calendar-remove"
                      onClick={() => handleRemoveCalendar(cal)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddCalendar} className="onboarding-calendar-form">
              <select
                value={selectedGoogleCalendarId}
                onChange={(e) => setSelectedGoogleCalendarId(e.target.value)}
                disabled={calendarListLoading}
                aria-label="Select a Google calendar"
              >
                <option value="">
                  {calendarListLoading ? 'Loading your calendars…' : 'Select a Google calendar'}
                </option>
                {googleCalendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={calendarListLoading || addingCalendar}>
                Add calendar
              </button>
            </form>
          </section>

          <div className="onboarding-actions">
            <button type="button" className="onboarding-btn onboarding-btn-primary" onClick={handleContinue}>
              Continue to dashboard
            </button>
            <button type="button" className="onboarding-skip" onClick={handleContinue}>
              Skip for now
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
