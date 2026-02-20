import React, { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getEvents } from '../services/api'
import './CalendarWidget.css'

function CalendarWidget() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const data = await getEvents()
      // Transform API events to FullCalendar format
      const calendarEvents = data.events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        backgroundColor: event.color || '#3788d8',
        borderColor: event.color || '#3788d8',
        extendedProps: {
          description: event.description,
          location: event.location,
          calendarName: event.calendar_name
        }
      }))
      setEvents(calendarEvents)
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading calendar...</div>
  }

  return (
    <div className="calendar-widget">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        height="auto"
        eventClick={(info) => {
          alert(`Event: ${info.event.title}\nCalendar: ${info.event.extendedProps.calendarName}`)
        }}
      />
    </div>
  )
}

export default CalendarWidget
