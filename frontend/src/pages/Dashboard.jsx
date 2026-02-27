import React, { useEffect, useState, useCallback } from 'react'
import { listHouseholds, listMembers } from '../services/api'
import { useAuth } from '../context/AuthContext'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [households, setHouseholds] = useState([])
  const [todoHouseholdId, setTodoHouseholdId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [h, allMembers] = await Promise.all([
        listHouseholds(),
        listMembers(),
      ])
      const myHouseholdIds = new Set(
        allMembers.filter((m) => m.user_id === user.id).map((m) => m.household_id)
      )
      const mine = h.filter((hh) => myHouseholdIds.has(hh.id))
      setHouseholds(mine)
      if (mine.length > 0 && !todoHouseholdId) setTodoHouseholdId(mine[0].id)
    } catch (e) {
      // ignore for dashboard
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-main">
        <section className="dashboard-section dashboard-calendar">
          <h2>Calendar</h2>
          <CalendarWidget />
        </section>
        <section className="dashboard-section dashboard-todo">
          {loading ? (
            <p className="dashboard-muted">Loading…</p>
          ) : (
            <>
              {households.length > 1 && (
                <div className="dashboard-todo-household">
                  <label htmlFor="todo-household">Household:</label>
                  <select
                    id="todo-household"
                    value={todoHouseholdId ?? ''}
                    onChange={(e) => setTodoHouseholdId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <TodoList
                householdId={todoHouseholdId ?? (households[0]?.id ?? null)}
                households={households}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
