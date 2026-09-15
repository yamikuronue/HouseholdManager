import React, { useState, useEffect } from 'react'
import { getCalendars, addCalendar, removeCalendar } from '../services/api'
import AppDialog from './AppDialog'
import './CalendarList.css'

function CalendarList() {
  const [calendars, setCalendars] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [removeId, setRemoveId] = useState(null)

  useEffect(() => {
    loadCalendars()
  }, [])

  const loadCalendars = async () => {
    try {
      const data = await getCalendars()
      setCalendars(data.calendars || [])
    } catch (error) {
      console.error('Error loading calendars:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCalendar = async () => {
    setNotice('Google Calendar integration coming soon!')
  }

  const confirmRemoveCalendar = async () => {
    const calendarId = removeId
    setRemoveId(null)
    if (!calendarId) return
    try {
      await removeCalendar(calendarId)
      loadCalendars()
    } catch (error) {
      console.error('Error removing calendar:', error)
    }
  }

  if (loading) {
    return <div>Loading calendars...</div>
  }

  return (
    <div className="calendar-list">
      <h2>Connected Calendars</h2>
      {notice && <p role="status">{notice}</p>}
      <button onClick={handleAddCalendar} className="add-calendar-btn">
        + Add Google Calendar
      </button>
      <ul>
        {calendars.map(calendar => (
          <li key={calendar.id}>
            <span style={{ color: calendar.color || '#000' }}>
              {calendar.name}
            </span>
            <button
              onClick={() => setRemoveId(calendar.id)}
              className="remove-btn"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <AppDialog
        open={removeId != null}
        title="Remove calendar"
        message="Are you sure you want to remove this calendar?"
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemoveCalendar}
      />
    </div>
  )
}

export default CalendarList
