import React, { useEffect, useState, useCallback } from 'react'
import { listHouseholds, listMembers } from '../services/api'
import { useAuth } from '../context/AuthContext'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import MealPlanner from '../components/MealPlanner'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [households, setHouseholds] = useState([])
  const [myMembers, setMyMembers] = useState([])
  const [dashboardHouseholdId, setDashboardHouseholdId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [h, allMembers] = await Promise.all([
        listHouseholds(),
        listMembers(),
      ])
      const mine = allMembers.filter((m) => m.user_id === user.id)
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
            <TodoList
              householdId={dashboardHouseholdId ?? (households[0]?.id ?? null)}
              households={households}
            />
          )}
        </section>
      </div>
      {!loading && (
        <section className="dashboard-section dashboard-meal-planner">
          <MealPlanner
            householdId={dashboardHouseholdId ?? (households[0]?.id ?? null)}
            myMemberId={myMemberForHousehold?.id ?? null}
            mealPlannerWeeks={mealPlannerWeeks}
          />
        </section>
      )}
    </div>
  )
}
