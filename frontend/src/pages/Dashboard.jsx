import React, { useEffect, useState } from 'react'
import {
  listHouseholds,
  createHousehold,
  createMember,
  listMembers,
  listInvitations,
  createInvitation,
  createCalendar,
  getGoogleCalendars,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import CalendarWidget from '../components/CalendarWidget'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [households, setHouseholds] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteHouseholdId, setInviteHouseholdId] = useState('')
  const [calendarHouseholdId, setCalendarHouseholdId] = useState('')
  const [googleCalendars, setGoogleCalendars] = useState([])
  const [calendarListLoading, setCalendarListLoading] = useState(false)
  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    if (!user) return
    try {
      const [h, inv, allMembers] = await Promise.all([
        listHouseholds(),
        listInvitations(),
        listMembers(),
      ])
      const myHouseholdIds = new Set(
        allMembers.filter((m) => m.user_id === user.id).map((m) => m.household_id)
      )
      setHouseholds(h.filter((hh) => myHouseholdIds.has(hh.id)))
      setInvitations(inv)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
    else setLoading(false)
  }, [user])

  const loadGoogleCalendars = async () => {
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
  }

  useEffect(() => {
    if (user) loadGoogleCalendars()
  }, [user])

  const handleCreateHousehold = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!newHouseholdName.trim()) return
    try {
      const newH = await createHousehold(newHouseholdName.trim())
      await createMember({ user_id: user.id, household_id: newH.id })
      setNewHouseholdName('')
      setSuccess('Household created. You were added as a member.')
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleSendInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const hid = inviteHouseholdId ? parseInt(inviteHouseholdId, 10) : null
    if (!inviteEmail.trim() || !hid) {
      setError('Select a household and enter an email.')
      return
    }
    const members = await listMembers(hid)
    const me = members.find((m) => m.user_id === user?.id)
    if (!me) {
      setError('You must be a member of the household to send invites.')
      return
    }
    try {
      await createInvitation({
        household_id: hid,
        email: inviteEmail.trim().toLowerCase(),
        invited_by_member_id: me.id,
      })
      setInviteEmail('')
      setSuccess('Invitation sent.')
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleAddCalendar = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const hid = calendarHouseholdId ? parseInt(calendarHouseholdId, 10) : null
    if (!selectedGoogleCalendarId || !hid) {
      setError('Select household and a calendar.')
      return
    }
    const selected = googleCalendars.find((c) => c.id === selectedGoogleCalendarId)
    if (!selected) {
      setError('Selected calendar not found. Please pick one from the list.')
      return
    }
    const members = await listMembers(hid)
    const me = members.find((m) => m.user_id === user?.id)
    if (!me) {
      setError('You must be a member of the household to add calendars.')
      return
    }
    try {
      await createCalendar({
        member_id: me.id,
        name: selected.summary,
        google_calendar_id: selected.id,
        is_visible: true,
      })
      setSelectedGoogleCalendarId('')
      setSuccess('Calendar added.')
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  if (loading) return <div className="dashboard-loading">Loading…</div>

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {error && <div className="dashboard-message dashboard-error">{error}</div>}
      {success && <div className="dashboard-message dashboard-success">{success}</div>}

      <section className="dashboard-section">
        <h2>Create household</h2>
        <form onSubmit={handleCreateHousehold} className="dashboard-form">
          <input
            type="text"
            placeholder="Household name"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
          />
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="dashboard-section">
        <h2>My households</h2>
        {households.length === 0 ? (
          <p className="dashboard-muted">No households yet. Create one above, or accept an invite.</p>
        ) : (
          <ul className="dashboard-list">
            {households.map((h) => (
              <li key={h.id}>
                <strong>{h.name}</strong> (id: {h.id})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Send invite</h2>
        <form onSubmit={handleSendInvite} className="dashboard-form dashboard-form-inline">
          <select
            value={inviteHouseholdId}
            onChange={(e) => setInviteHouseholdId(e.target.value)}
          >
            <option value="">Select household</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input
            type="email"
            placeholder="Email to invite"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit">Send invite</button>
        </form>
      </section>

      <section className="dashboard-section">
        <h2>Pending invitations (this household)</h2>
        {invitations.filter((i) => i.status === 'pending').length === 0 ? (
          <p className="dashboard-muted">No pending invitations.</p>
        ) : (
          <ul className="dashboard-list">
            {invitations
              .filter((i) => i.status === 'pending')
              .map((i) => (
                <li key={i.id}>
                  {i.email} – last sent {new Date(i.last_sent_at).toLocaleDateString()}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Add calendar</h2>
        <form onSubmit={handleAddCalendar} className="dashboard-form dashboard-form-column">
          <select
            value={calendarHouseholdId}
            onChange={(e) => setCalendarHouseholdId(e.target.value)}
          >
            <option value="">Select household</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            value={selectedGoogleCalendarId}
            onChange={(e) => setSelectedGoogleCalendarId(e.target.value)}
            disabled={calendarListLoading}
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
          <button type="submit" disabled={calendarListLoading}>Add calendar</button>
        </form>
      </section>

      <section className="dashboard-section dashboard-calendar">
        <h2>Calendar</h2>
        <CalendarWidget />
      </section>
    </div>
  )
}
