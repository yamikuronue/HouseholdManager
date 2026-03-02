import React, { useState, useCallback, useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getEvents, getWritableCalendars, createEvent } from '../services/api'
import './CalendarWidget.css'

function formatForGoogleDates(d) {
  const pad = (n) => String(n).padStart(2, '0')
  const year = d.getUTCFullYear()
  const month = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  const hour = pad(d.getUTCHours())
  const min = pad(d.getUTCMinutes())
  const sec = pad(d.getUTCSeconds())
  return `${year}${month}${day}T${hour}${min}${sec}Z`
}

function CalendarWidget() {
  const [events, setEvents] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [eventPopoverEvent, setEventPopoverEvent] = useState(null)
  const [writableCalendars, setWritableCalendars] = useState([])
  const [addForm, setAddForm] = useState({
    title: '',
    calendar_id: '',
    description: '',
    location: '',
    start: '',
    end: '',
  })
  const [addError, setAddError] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const calendarRef = useRef(null)
  const currentRangeRef = useRef({ start: null, end: null })
  const [searchQuery, setSearchQuery] = useState('')
  const [skippedCalendars, setSkippedCalendars] = useState([])

  const loadEvents = useCallback((start, end) => {
    if (start) currentRangeRef.current = { start, end }
    getEvents(start, end, searchQuery)
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
            calendarName: event.calendar_name,
            htmlLink: event.html_link,
          },
        }))
        setEvents(calendarEvents)
        setSkippedCalendars(data?.skipped_calendars ?? [])
      })
      .catch((err) => {
        console.error('Error loading events:', err)
        setSkippedCalendars([])
      })
  }, [searchQuery])

  const refreshEvents = useCallback(() => {
    const { start, end } = currentRangeRef.current
    if (start && end) loadEvents(start, end)
  }, [loadEvents])

  // Refetch when search query changes (debounced)
  const searchDebounceRef = useRef(null)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      const { start, end } = currentRangeRef.current
      if (start && end) loadEvents(start, end)
      searchDebounceRef.current = null
    }, 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery, loadEvents])

  const openAddModal = useCallback((startDate) => {
    setAddError('')
    const start = startDate
      ? new Date(startDate)
      : (() => {
          const s = new Date()
          s.setMinutes(0, 0, 0)
          return s
        })()
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const toLocal = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const h = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${day}T${h}:${min}`
    }
    setAddForm({
      title: '',
      calendar_id: '',
      description: '',
      location: '',
      start: toLocal(start),
      end: toLocal(end),
    })
    setAddModalOpen(true)
    getWritableCalendars()
      .then(setWritableCalendars)
      .catch(() => setWritableCalendars([]))
  }, [])

  const closeAddModal = useCallback(() => {
    setAddModalOpen(false)
    setAddError('')
    setAddSubmitting(false)
  }, [])

  const handleCreateEvent = useCallback(
    async (e) => {
      e.preventDefault()
      setAddError('')
      if (!addForm.title?.trim()) {
        setAddError('Name is required.')
        return
      }
      if (!addForm.calendar_id) {
        setAddError('Please select a calendar.')
        return
      }
      const start = new Date(addForm.start)
      const end = new Date(addForm.end)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setAddError('Please set valid start and end times.')
        return
      }
      if (end <= start) {
        setAddError('End time must be after start time.')
        return
      }
      setAddSubmitting(true)
      try {
        await createEvent({
          calendar_id: parseInt(addForm.calendar_id, 10),
          title: addForm.title.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
          description: addForm.description?.trim() || null,
          location: addForm.location?.trim() || null,
        })
        closeAddModal()
        refreshEvents()
      } catch (err) {
        const msg =
          err.response?.data?.detail ||
          (Array.isArray(err.response?.data?.detail)
            ? err.response.data.detail.map((x) => x.msg).join(', ')
            : 'Failed to create event.')
        setAddError(String(msg))
      } finally {
        setAddSubmitting(false)
      }
    },
    [addForm, closeAddModal, refreshEvents]
  )

  const openAdvancedGoogle = useCallback(() => {
    const start = addForm.start ? new Date(addForm.start) : new Date()
    const end = addForm.end ? new Date(addForm.end) : new Date(start.getTime() + 60 * 60 * 1000)
    const text = encodeURIComponent(addForm.title || 'New event')
    const details = encodeURIComponent(addForm.description || '')
    const location = encodeURIComponent(addForm.location || '')
    const dates = `${formatForGoogleDates(start)}/${formatForGoogleDates(end)}`
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${dates}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [addForm])

  const handleEventClick = useCallback((info) => {
    info.jsEvent.preventDefault()
    const htmlLink = info.event.extendedProps.htmlLink
    setEventPopoverEvent({
      title: info.event.title,
      description: info.event.extendedProps.description,
      location: info.event.extendedProps.location,
      calendarName: info.event.extendedProps.calendarName,
      htmlLink,
    })
  }, [])

  const closeEventPopover = useCallback(() => setEventPopoverEvent(null), [])

  return (
    <div className="calendar-widget">
      {skippedCalendars.length > 0 && (
        <div className="calendar-widget-warning" role="alert">
          <strong>Some calendars could not be loaded:</strong>{' '}
          {skippedCalendars.map((s) => `${s.calendar_name} (${s.owner})`).join(', ')}.
          Ask these members to sign in again to refresh their calendar access.
        </div>
      )}
      <div className="calendar-widget-header">
        <div className="calendar-widget-search-wrap">
          <label htmlFor="calendar-search" className="calendar-search-label">
            Search events
          </label>
          <input
            id="calendar-search"
            type="search"
            className="calendar-widget-search"
            placeholder="Search events (title, description, location)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search calendar events"
          />
        </div>
        <button
          type="button"
          className="calendar-widget-add-btn"
          onClick={() => openAddModal()}
          aria-label="Add event"
        >
          + Add event
        </button>
      </div>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        height="auto"
        datesSet={(info) => loadEvents(info.start, info.end)}
        dateClick={(info) => openAddModal(info.date)}
        eventClick={handleEventClick}
      />

      {addModalOpen && (
        <div className="calendar-modal-overlay" onClick={closeAddModal} role="presentation">
          <div
            className="calendar-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="add-event-title"
          >
            <h2 id="add-event-title" className="calendar-modal-title">
              Add event
            </h2>
            <form onSubmit={handleCreateEvent} className="calendar-add-form">
              <label htmlFor="add-event-name">
                Name <span className="required">*</span>
              </label>
              <input
                id="add-event-name"
                type="text"
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Event name"
                autoFocus
              />
              <label htmlFor="add-event-calendar">
                Calendar <span className="required">*</span>
              </label>
              <select
                id="add-event-calendar"
                value={addForm.calendar_id}
                onChange={(e) => setAddForm((f) => ({ ...f, calendar_id: e.target.value }))}
              >
                <option value="">Select a calendar</option>
                {writableCalendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
              <label htmlFor="add-event-description">Description</label>
              <textarea
                id="add-event-description"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                rows={2}
              />
              <label htmlFor="add-event-location">Location</label>
              <input
                id="add-event-location"
                type="text"
                value={addForm.location}
                onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Location"
              />
              <label htmlFor="add-event-start">Start</label>
              <input
                id="add-event-start"
                type="datetime-local"
                value={addForm.start}
                onChange={(e) => setAddForm((f) => ({ ...f, start: e.target.value }))}
              />
              <label htmlFor="add-event-end">End</label>
              <input
                id="add-event-end"
                type="datetime-local"
                value={addForm.end}
                onChange={(e) => setAddForm((f) => ({ ...f, end: e.target.value }))}
              />
              {addError && <p className="calendar-form-error">{addError}</p>}
              <div className="calendar-modal-actions">
                <button type="submit" disabled={addSubmitting}>
                  {addSubmitting ? 'Creating…' : 'Create event'}
                </button>
                <button type="button" className="calendar-advanced-btn" onClick={openAdvancedGoogle}>
                  Advanced: open in Google Calendar
                </button>
                <button type="button" onClick={closeAddModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eventPopoverEvent && (
        <div className="calendar-modal-overlay" onClick={closeEventPopover} role="presentation">
          <div
            className="calendar-modal calendar-event-popover"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="event-popover-title"
          >
            <h2 id="event-popover-title" className="calendar-modal-title">
              {eventPopoverEvent.title}
            </h2>
            {eventPopoverEvent.calendarName && (
              <p className="calendar-event-meta">Calendar: {eventPopoverEvent.calendarName}</p>
            )}
            {eventPopoverEvent.description && (
              <p className="calendar-event-description">{eventPopoverEvent.description}</p>
            )}
            {eventPopoverEvent.location && (
              <p className="calendar-event-location">{eventPopoverEvent.location}</p>
            )}
            {eventPopoverEvent.htmlLink ? (
              <a
                href={eventPopoverEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="calendar-google-link"
                onClick={(e) => {
                  e.preventDefault()
                  window.open(eventPopoverEvent.htmlLink, '_blank', 'noopener,noreferrer')
                }}
              >
                Open in Google Calendar (edit or delete)
              </a>
            ) : (
              <p className="calendar-event-muted">
                Open the event in your Google Calendar app to edit or delete it.
              </p>
            )}
            <div className="calendar-modal-actions">
              <button type="button" onClick={closeEventPopover}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarWidget
