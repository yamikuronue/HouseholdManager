import React, { useState, useEffect } from 'react'
import { getCalendars, addCalendar, removeCalendar } from '../services/api'
import './CalendarList.css'

function CalendarList() {
  const [calendars, setCalendars] = useState([])
  const [loading, setLoading] = useState(true)

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
    // TODO: Implement Google OAuth flow
    alert('Google Calendar integration coming soon!')
  }

  const handleRemoveCalendar = async (calendarId) => {
    if (window.confirm('Are you sure you want to remove this calendar?')) {
      try {
        await removeCalendar(calendarId)
        loadCalendars()
      } catch (error) {
        console.error('Error removing calendar:', error)
      }
    }
  }

  if (loading) {
    return <div>Loading calendars...</div>
  }

  return (
    <div className="calendar-list">
      <h2>Connected Calendars</h2>
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
              onClick={() => handleRemoveCalendar(calendar.id)}
              className="remove-btn"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CalendarList
