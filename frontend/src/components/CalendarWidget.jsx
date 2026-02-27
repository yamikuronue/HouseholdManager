import React, { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getEvents } from '../services/api'
import './CalendarWidget.css'

function CalendarWidget() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback((start, end) => {
    setLoading(true)
    getEvents(start, end)
      .then((data) => {
        const calendarEvents = (data?.events ?? []).map((event) => ({
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
      })
      .catch((err) => console.error('Error loading events:', err))
      .finally(() => setLoading(false))
  }, [])

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
        loading={loading}
        height="auto"
        datesSet={(info) => loadEvents(info.start, info.end)}
        eventClick={(info) => {
          alert(`Event: ${info.event.title}\nCalendar: ${info.event.extendedProps.calendarName}`)
        }}
      />
    </div>
  )
}

export default CalendarWidget
