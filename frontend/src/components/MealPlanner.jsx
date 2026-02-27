import React, { useState, useEffect, useCallback } from 'react'
import {
  listMealSlots,
  listPlannedMeals,
  createOrUpdatePlannedMeal,
  deletePlannedMeal,
  listMembers,
} from '../services/api'
import './MealPlanner.css'

const ISO_DATE = (d) => d.toISOString().slice(0, 10)

export default function MealPlanner({ householdId, myMemberId, mealPlannerWeeks = 2 }) {
  const [slots, setSlots] = useState([])
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  })

  const numDays = mealPlannerWeeks * 7
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + numDays - 1)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    setError('')
    try {
      const [slotList, mealList] = await Promise.all([
        listMealSlots(householdId),
        listPlannedMeals(householdId, ISO_DATE(startDate), ISO_DATE(endDate)),
      ])
      setSlots(slotList)
      setMeals(mealList)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [householdId, startDate, endDate, numDays])

  useEffect(() => {
    load()
  }, [load])

  const getMealFor = (dateStr, slotId) =>
    meals.find((m) => m.meal_date === dateStr && m.meal_slot_id === slotId)

  const handleCellClick = async (dateStr, slotId) => {
    if (!myMemberId) return
    const existing = getMealFor(dateStr, slotId)
    setError('')
    try {
      if (existing) {
        if (existing.member_id === myMemberId) await deletePlannedMeal(existing.id)
      } else {
        await createOrUpdatePlannedMeal({
          household_id: householdId,
          meal_date: dateStr,
          meal_slot_id: slotId,
          member_id: myMemberId,
        })
      }
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  if (!householdId) {
    return (
      <div className="meal-planner meal-planner-empty">
        <p className="meal-planner-muted">Select a household to view the meal planner.</p>
      </div>
    )
  }

  const dates = []
  const d = new Date(startDate)
  for (let i = 0; i < numDays; i++) {
    dates.push(ISO_DATE(new Date(d)))
    d.setDate(d.getDate() + 1)
  }

  return (
    <div className="meal-planner">
      <div className="meal-planner-header">
        <h2 className="meal-planner-title">Meal planner</h2>
        <div className="meal-planner-nav">
          <button
            type="button"
            className="meal-planner-nav-btn"
            onClick={() => {
              const s = new Date(startDate)
              s.setDate(s.getDate() - numDays)
              setStartDate(s)
            }}
          >
            ← Previous
          </button>
          <span className="meal-planner-range">
            {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            –{endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            type="button"
            className="meal-planner-nav-btn"
            onClick={() => {
              const s = new Date(startDate)
              s.setDate(s.getDate() + numDays)
              setStartDate(s)
            }}
          >
            Next →
          </button>
        </div>
      </div>
      {error && <div className="meal-planner-error">{error}</div>}
      {loading ? (
        <p className="meal-planner-muted">Loading…</p>
      ) : (
        <div className="meal-planner-grid-wrap">
          <table className="meal-planner-table">
            <thead>
              <tr>
                <th className="meal-planner-cell meal-planner-cell-label" />
                {dates.map((dateStr) => (
                  <th key={dateStr} className="meal-planner-cell meal-planner-cell-header">
                    {new Date(dateStr + 'Z').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td className="meal-planner-cell meal-planner-cell-label">{slot.name}</td>
                  {dates.map((dateStr) => {
                    const meal = getMealFor(dateStr, slot.id)
                    return (
                      <td
                        key={`${dateStr}-${slot.id}`}
                        className="meal-planner-cell meal-planner-cell-meal"
                        onClick={() => handleCellClick(dateStr, slot.id)}
                      >
                        {meal ? (
                          <span
                            className="meal-planner-entry"
                            style={{ borderLeftColor: meal.member_color || '#888' }}
                            title={meal.member_display_name}
                          >
                            {meal.member_display_name}
                          </span>
                        ) : (
                          <span className="meal-planner-empty-cell">+</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
