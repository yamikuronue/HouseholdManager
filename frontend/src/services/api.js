import axios from 'axios'

// Empty string = same-origin (when frontend is served from backend); undefined = local dev
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auth
export const getAuthMe = () => api.get('/api/auth/me').then((r) => r.data)
export const getGoogleAuthUrl = () => `${API_BASE_URL}/api/auth/google`

// Households
export const listHouseholds = () => api.get('/api/households').then((r) => r.data)
export const createHousehold = (name) => api.post('/api/households', { name }).then((r) => r.data)
export const getHousehold = (id) => api.get(`/api/households/${id}`).then((r) => r.data)
export const updateHousehold = (id, data) => api.patch(`/api/households/${id}`, data).then((r) => r.data)
export const deleteHousehold = (id) => api.delete(`/api/households/${id}`)

// Members
export const listMembers = (householdId) =>
  api.get('/api/members', { params: householdId != null ? { household_id: householdId } : {} }).then((r) => r.data)
export const createMember = (body) => api.post('/api/members', body).then((r) => r.data)
export const getMember = (id) => api.get(`/api/members/${id}`).then((r) => r.data)
export const updateMember = (id, data) => api.patch(`/api/members/${id}`, data).then((r) => r.data)
export const deleteMember = (id) => api.delete(`/api/members/${id}`)

// Calendars
export const listCalendars = (opts = {}) =>
  api.get('/api/calendars', { params: opts }).then((r) => r.data)
export const createCalendar = (body) => api.post('/api/calendars', body).then((r) => r.data)
export const getCalendar = (id) => api.get(`/api/calendars/${id}`).then((r) => r.data)
export const updateCalendar = (id, data) => api.patch(`/api/calendars/${id}`, data).then((r) => r.data)
export const deleteCalendar = (id) => api.delete(`/api/calendars/${id}`)

// Invitations
export const listInvitations = (opts = {}) =>
  api.get('/api/invitations', { params: opts }).then((r) => r.data)
export const createInvitation = (body) => api.post('/api/invitations', body).then((r) => r.data)
export const getInvitationByToken = (token) => api.get(`/api/invitations/by-token/${token}`).then((r) => r.data)
export const resendInvitation = (id) => api.post(`/api/invitations/resend/${id}`).then((r) => r.data)
export const acceptInvitation = (body) => api.post('/api/invitations/accept', body).then((r) => r.data)

// Events (aggregated)
export const getEvents = (startDate, endDate) => {
  const params = {}
  if (startDate) params.start_date = startDate?.toISOString?.()
  if (endDate) params.end_date = endDate?.toISOString?.()
  return api.get('/api/events', { params }).then((r) => r.data)
}

// Legacy names for existing components
export const getCalendars = () => listCalendars()
export const addCalendar = createCalendar
export const removeCalendar = deleteCalendar
