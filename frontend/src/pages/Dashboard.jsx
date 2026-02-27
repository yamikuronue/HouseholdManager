import React, { useEffect, useState, useCallback } from 'react'
import { listHouseholds, listMembers } from '../services/api'
import { useAuth } from '../context/AuthContext'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import GroceryLists from '../components/GroceryLists'
import MealPlanner from '../components/MealPlanner'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [households, setHouseholds] = useState([])
  const [myMembers, setMyMembers] = useState([])
  const [householdMembers, setHouseholdMembers] = useState([])
  const [dashboardHouseholdId, setDashboardHouseholdId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [h, members] = await Promise.all([
        listHouseholds(),
        listMembers(),
      ])
      const mine = members.filter((m) => m.user_id === user.id)
      const myHouseholdIds = new Set(mine.map((m) => m.household_id))
      setHouseholds(h.filter((hh) => myHouseholdIds.has(hh.id)))
      setMyMembers(mine)
      const mineHouseholds = h.filter((hh) => myHouseholdIds.has(hh.id))
      if (mineHouseholds.length > 0 && !dashboardHouseholdId) setDashboardHouseholdId(mineHouseholds[0].id)
    } catch (e) {
      // ignore for dashboard
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const hid = dashboardHouseholdId ?? households[0]?.id
    if (!hid) {
      setHouseholdMembers([])
      return
    }
    listMembers(hid)
      .then(setHouseholdMembers)
      .catch(() => setHouseholdMembers([]))
  }, [dashboardHouseholdId, households])

  const selectedHousehold = households.find((h) => h.id === dashboardHouseholdId)
  const myMemberForHousehold = myMembers.find((m) => m.household_id === dashboardHouseholdId)
  const mealPlannerWeeks = selectedHousehold?.meal_planner_weeks ?? 2

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {households.length > 1 && (
        <div className="dashboard-household-select">
          <label htmlFor="dashboard-household">Household:</label>
          <select
            id="dashboard-household"
            value={dashboardHouseholdId ?? ''}
            onChange={(e) => setDashboardHouseholdId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      )}
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
              <TodoList
                householdId={dashboardHouseholdId ?? (households[0]?.id ?? null)}
                households={households}
              />
              {householdMembers.length > 0 && (
                <div className="dashboard-color-key" aria-label="Who has each color">
                  <span className="dashboard-color-key-label">Colors:</span>
                  {householdMembers.map((m) => (
                    <span key={m.id} className="dashboard-color-key-item">
                      <span
                        className="dashboard-color-key-dot"
                        style={{ backgroundColor: m.event_color || '#888' }}
                      />
                      <span className="dashboard-color-key-name">
                        {m.user?.display_name || m.user?.email || 'Member'}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {!loading && (
        <>
          <section className="dashboard-section dashboard-grocery-lists">
            <GroceryLists
              householdId={dashboardHouseholdId ?? (households[0]?.id ?? null)}
              myMemberId={myMemberForHousehold?.id ?? null}
            />
          </section>
          <section className="dashboard-section dashboard-meal-planner">
            <MealPlanner
              householdId={dashboardHouseholdId ?? (households[0]?.id ?? null)}
              myMemberId={myMemberForHousehold?.id ?? null}
              mealPlannerWeeks={mealPlannerWeeks}
            />
          </section>
        </>
      )}
    </div>
  )
}
