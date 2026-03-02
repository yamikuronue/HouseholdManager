import React, { useEffect, useState } from 'react'
import {
  listHouseholds,
  createHousehold,
  createMember,
  listMembers,
  listInvitations,
  createInvitation,
  resendInvitation,
  deleteInvitation,
  deleteMember,
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
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [googleCalendars, setGoogleCalendars] = useState([])
  const [calendarListLoading, setCalendarListLoading] = useState(false)
  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [myMembers, setMyMembers] = useState([])
  const [membersByHousehold, setMembersByHousehold] = useState({}) // householdId -> list of members (with user)
  const [myCalendars, setMyCalendars] = useState([])
  const [mealSlotsByHousehold, setMealSlotsByHousehold] = useState({})
  const [newMealSlotName, setNewMealSlotName] = useState('')

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
      const membersPerH = {}
      await Promise.all(
        mineHouseholds.map(async (hh) => {
          const list = await listMembers(hh.id)
          membersPerH[hh.id] = list
        })
      )
      setMembersByHousehold(membersPerH)
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
      if (mineHouseholds.length > 0) {
        setSelectedHouseholdId((prev) => {
          const id = prev ? parseInt(prev, 10) : null
          const valid = id != null && mineHouseholds.some((hh) => hh.id === id)
          return valid ? prev : String(mineHouseholds[0].id)
        })
      } else {
        setSelectedHouseholdId('')
      }
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
    const hid = selectedHouseholdId ? parseInt(selectedHouseholdId, 10) : null
    if (!inviteEmail.trim() || !hid) {
      setError('Choose a household above and enter an email.')
      return
    }
    const members = await listMembers(hid)
    const me = members.find((m) => m.user_id === user?.id)
    if (!me) {
      setError('You must be a member of the household to send invites.')
      return
    }
    try {
      const res = await createInvitation({
        household_id: hid,
        email: inviteEmail.trim().toLowerCase(),
        invited_by_member_id: me.id,
      })
      const inv = res.invitation ?? res
      const emailSent = res.email_sent
      setInviteEmail('')
      if (emailSent === true) {
        setSuccess(`Invitation sent. Email delivered to ${inv.email}.`)
      } else if (emailSent === false) {
        setSuccess('Invitation created, but email could not be sent. Share the invite link from the list below.')
      } else {
        setSuccess('Invitation created. (Email is not configured.)')
      }
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleResendInvite = async (invitationId, email) => {
    setError('')
    setSuccess('')
    try {
      const res = await resendInvitation(invitationId)
      const emailSent = res.email_sent
      if (emailSent === true) {
        setSuccess(`Email resent to ${email}.`)
      } else if (emailSent === false) {
        setSuccess('Invitation updated, but email could not be sent. Share the invite link from below.')
      } else {
        setSuccess('Invitation updated. (Email is not configured.)')
      }
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteInvite = async (invitationId, email) => {
    if (!window.confirm(`Remove the invitation for ${email}? They will no longer be able to use the invite link.`)) return
    setError('')
    setSuccess('')
    try {
      await deleteInvitation(invitationId)
      setSuccess('Invitation removed.')
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleRemoveMember = async (householdId, memberId, displayName) => {
    if (!window.confirm(`Remove ${displayName} from this household? They will lose access to the household.`)) return
    setError('')
    setSuccess('')
    try {
      await deleteMember(memberId)
      setMembersByHousehold((prev) => ({
        ...prev,
        [householdId]: (prev[householdId] || []).filter((m) => m.id !== memberId),
      }))
      setSuccess('Member removed from household.')
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleAddCalendar = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const hid = selectedHouseholdId ? parseInt(selectedHouseholdId, 10) : null
    if (!selectedGoogleCalendarId || !hid) {
      setError('Choose a household above and a calendar.')
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
    const hid = selectedHouseholdId ? parseInt(selectedHouseholdId, 10) : null
    if (!newMealSlotName.trim() || !hid) {
      setError('Choose a household above and enter a meal type name.')
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

      {households.length > 0 && (
        <section className="dashboard-section settings-household-context">
          <label htmlFor="settings-household">Household for forms below:</label>
          <select
            id="settings-household"
            value={selectedHouseholdId}
            onChange={(e) => setSelectedHouseholdId(e.target.value)}
            className="settings-household-global-select"
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="dashboard-section">
        <h2>My households</h2>
        {households.length === 0 ? (
          <p className="dashboard-muted">No households yet. Create one above, or accept an invite.</p>
        ) : (
          <ul className="dashboard-list settings-households-list">
            {households.map((h) => {
              const myMember = myMembers.find((m) => m.household_id === h.id)
              const isOwner = myMember?.role === 'owner'
              const members = membersByHousehold[h.id] || []
              return (
                <li key={h.id} className="settings-household-item">
                  <div className="settings-household-header">
                    <strong>{h.name}</strong>
                  </div>
                  <ul className="dashboard-list settings-members-sublist">
                    {members.map((m) => {
                      const displayName = m.user?.display_name || m.user?.email || 'Unknown'
                      const isMe = m.user_id === user?.id
                      const canRemove = isOwner && !isMe && m.role !== 'owner'
                      const memberColor = m.event_color || DEFAULT_PASTEL_COLORS[0]
                      return (
                        <li key={m.id} className="dashboard-list-item-with-action">
                          <span className="settings-member-row">
                            <span
                              className="settings-member-color-swatch"
                              style={{ backgroundColor: memberColor }}
                              title={`${displayName}'s color`}
                              aria-hidden
                            />
                            <span>
                              {displayName}
                              {m.role === 'owner' && (
                                <span className="settings-role-badge settings-role-owner">Owner</span>
                              )}
                              {isMe && <span className="settings-role-badge settings-role-me">You</span>}
                            </span>
                          </span>
                          {canRemove && (
                            <button
                              type="button"
                              className="dashboard-btn-danger"
                              onClick={() => handleRemoveMember(h.id, m.id, displayName)}
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
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
        {(() => {
          const hid = selectedHouseholdId ? parseInt(selectedHouseholdId, 10) : null
          const pending = invitations.filter(
            (i) => i.status === 'pending' && (hid == null || i.household_id === hid)
          )
          return pending.length === 0 ? (
            <p className="dashboard-muted">
              {hid ? 'No pending invitations for this household.' : 'Select a household above to see pending invitations.'}
            </p>
          ) : (
          <ul className="dashboard-list">
            {pending.map((i) => (
                <li key={i.id} className="dashboard-list-item-with-action">
                  <span>{i.email} – last sent {new Date(i.last_sent_at).toLocaleDateString()}</span>
                  <span className="dashboard-list-actions">
                    <button
                      type="button"
                      className="dashboard-btn-secondary"
                      onClick={() => handleResendInvite(i.id, i.email)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="dashboard-btn-danger"
                      onClick={() => handleDeleteInvite(i.id, i.email)}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
          </ul>
          )
        })()}
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
