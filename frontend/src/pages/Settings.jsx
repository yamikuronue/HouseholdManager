import React, { useEffect, useState } from 'react'
import {
  listHouseholds,
  createHousehold,
  createMember,
  listMembers,
  listInvitations,
  createInvitation,
  createCalendar,
  listCalendars,
  deleteCalendar,
  getGoogleCalendars,
  updateMember,
  updateHousehold,
  listMealSlots,
  createMealSlot,
  updateMealSlot,
  deleteMealSlot,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

export default function Settings() {
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
  const [myMembers, setMyMembers] = useState([])
  const [myCalendars, setMyCalendars] = useState([])
  const [mealSlotsByHousehold, setMealSlotsByHousehold] = useState({})
  const [newMealSlotName, setNewMealSlotName] = useState('')
  const [newMealSlotHouseholdId, setNewMealSlotHouseholdId] = useState('')

  const DEFAULT_PASTEL_COLORS = [
    '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
    '#E0BBE4', '#FFDFBA', '#B5EAD7', '#C7CEEA',
  ]

  const load = async () => {
    if (!user) return
    try {
      const [h, inv, allMembers] = await Promise.all([
        listHouseholds(),
        listInvitations(),
        listMembers(),
      ])
      const mine = allMembers.filter((m) => m.user_id === user.id)
      const myHouseholdIds = new Set(mine.map((m) => m.household_id))
      const mineHouseholds = h.filter((hh) => myHouseholdIds.has(hh.id))
      setHouseholds(mineHouseholds)
      setMyMembers(mine)
      setInvitations(inv)
      const calendarLists = await Promise.all(
        mine.map((m) => listCalendars({ member_id: m.id }))
      )
      setMyCalendars(calendarLists.flat())
      const slotLists = await Promise.all(
        mineHouseholds.map((hh) => listMealSlots(hh.id))
      )
      const slotsByH = {}
      mineHouseholds.forEach((hh, i) => { slotsByH[hh.id] = slotLists[i] })
      setMealSlotsByHousehold(slotsByH)
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

  const handleRemoveCalendar = async (calendar) => {
    if (!window.confirm(`Remove "${calendar.name}" from this household? It will stay in your Google account; only the link here is removed.`)) return
    setError('')
    try {
      await deleteCalendar(calendar.id)
      setMyCalendars((prev) => prev.filter((c) => c.id !== calendar.id))
      setSuccess('Calendar removed from household.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleMealPlannerWeeksChange = async (householdId, weeks) => {
    setError('')
    try {
      await updateHousehold(householdId, { meal_planner_weeks: weeks })
      setHouseholds((prev) => prev.map((h) => (h.id === householdId ? { ...h, meal_planner_weeks: weeks } : h)))
      setSuccess('Meal planner weeks updated.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleAddMealSlot = async (e) => {
    e.preventDefault()
    const hid = newMealSlotHouseholdId ? parseInt(newMealSlotHouseholdId, 10) : null
    if (!newMealSlotName.trim() || !hid) {
      setError('Select household and enter a meal type name.')
      return
    }
    setError('')
    try {
      const slot = await createMealSlot({ household_id: hid, name: newMealSlotName.trim() })
      setMealSlotsByHousehold((prev) => ({
        ...prev,
        [hid]: [...(prev[hid] || []), slot],
      }))
      setNewMealSlotName('')
      setNewMealSlotHouseholdId('')
      setSuccess('Meal type added.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteMealSlot = async (slot) => {
    if (!window.confirm(`Remove "${slot.name}"? Planned meals for this slot will be removed.`)) return
    setError('')
    try {
      await deleteMealSlot(slot.id)
      setMealSlotsByHousehold((prev) => ({
        ...prev,
        [slot.household_id]: (prev[slot.household_id] || []).filter((s) => s.id !== slot.id),
      }))
      setSuccess('Meal type removed.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleEventColorChange = async (memberId, hex) => {
    setError('')
    try {
      await updateMember(memberId, { event_color: hex })
      setMyMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, event_color: hex } : m))
      )
      setSuccess('Event color updated.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  if (loading) return <div className="dashboard-loading">Loading…</div>

  return (
    <div className="dashboard settings-page">
      <h1>Settings</h1>
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

      {households.length > 0 && (
        <section className="dashboard-section">
          <h2>Your color</h2>
          <p className="dashboard-muted">Your calendar events and meal planner entries use this color. Choose per household.</p>
          {households.map((h) => {
            const myMember = myMembers.find((m) => m.household_id === h.id)
            if (!myMember) return null
            const currentColor = myMember.event_color || DEFAULT_PASTEL_COLORS[0]
            return (
              <div key={h.id} className="settings-event-color-row">
                <span className="settings-event-color-label">{h.name}</span>
                <div className="settings-event-color-options">
                  {DEFAULT_PASTEL_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className="settings-color-swatch"
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={`Use ${hex}`}
                      onClick={() => handleEventColorChange(myMember.id, hex)}
                    />
                  ))}
                  <label className="settings-color-picker-label">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => handleEventColorChange(myMember.id, e.target.value)}
                      className="settings-color-picker"
                    />
                    <span className="settings-color-picker-text">Custom</span>
                  </label>
                </div>
              </div>
            )
          })}
        </section>
      )}

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
        <h2>Pending invitations</h2>
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
        <h2>Your calendars</h2>
        <p className="dashboard-muted">Calendars linked to this household. Removing one only unlinks it here; it stays in your Google account.</p>
        {myCalendars.length === 0 ? (
          <p className="dashboard-muted">No calendars added yet. Add one below.</p>
        ) : (
          <ul className="dashboard-list">
            {households.map((h) => {
              const myMember = myMembers.find((m) => m.household_id === h.id)
              const cals = myCalendars.filter((c) => c.member_id === myMember?.id)
              if (cals.length === 0) return null
              return (
                <li key={h.id} className="settings-calendar-household">
                  <strong>{h.name}</strong>
                  <ul className="dashboard-list settings-calendar-sublist">
                    {cals.map((cal) => (
                      <li key={cal.id} className="settings-calendar-item">
                        <span>{cal.name}</span>
                        <button
                          type="button"
                          className="settings-remove-calendar-btn"
                          onClick={() => handleRemoveCalendar(cal)}
                          title="Remove from household (stays in Google)"
                        >
                          Remove from household
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
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

      {households.length > 0 && (
        <section className="dashboard-section">
          <h2>Meal planner</h2>
          <p className="dashboard-muted">Configure which meals appear and how many weeks to show on the dashboard.</p>
          {households.map((h) => (
            <div key={h.id} className="settings-meal-planner-household">
              <strong>{h.name}</strong>
              <div className="settings-meal-planner-weeks">
                <span>Weeks to show:</span>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={h.meal_planner_weeks === w ? 'settings-weeks-btn settings-weeks-btn-active' : 'settings-weeks-btn'}
                    onClick={() => handleMealPlannerWeeksChange(h.id, w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="settings-meal-slots">
                <span>Meal types (order):</span>
                <ul className="dashboard-list settings-meal-slots-list">
                  {(mealSlotsByHousehold[h.id] || []).map((slot) => (
                    <li key={slot.id} className="settings-meal-slot-item">
                      {slot.name}
                      <button
                        type="button"
                        className="settings-remove-calendar-btn"
                        onClick={() => handleDeleteMealSlot(slot)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <form onSubmit={handleAddMealSlot} className="dashboard-form dashboard-form-inline">
            <select
              value={newMealSlotHouseholdId}
              onChange={(e) => setNewMealSlotHouseholdId(e.target.value)}
            >
              <option value="">Select household</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Meal type (e.g. Snack)"
              value={newMealSlotName}
              onChange={(e) => setNewMealSlotName(e.target.value)}
            />
            <button type="submit">Add meal type</button>
          </form>
        </section>
      )}
    </div>
  )
}
