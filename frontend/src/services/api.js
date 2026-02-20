import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const getCalendars = async () => {
  const response = await api.get('/api/calendars')
  return response.data
}

export const addCalendar = async (calendarData) => {
  const response = await api.post('/api/calendars', calendarData)
  return response.data
}

export const removeCalendar = async (calendarId) => {
  const response = await api.delete(`/api/calendars/${calendarId}`)
  return response.data
}

export const getEvents = async (startDate, endDate) => {
  const params = {}
  if (startDate) params.start_date = startDate.toISOString()
  if (endDate) params.end_date = endDate.toISOString()
  
  const response = await api.get('/api/events', { params })
  return response.data
}
