import React, { useState, useEffect, useRef } from 'react'
import {
  listMealSlots,
  listPlannedMeals,
  createOrUpdatePlannedMeal,
  deletePlannedMeal,
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

  const loadRef = useRef(null)

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      setError('')
      try {
        const start = new Date(startDate)
        const end = new Date(start)
        end.setDate(end.getDate() + numDays - 1)
        const [slotList, mealList] = await Promise.all([
          listMealSlots(householdId),
          listPlannedMeals(householdId, ISO_DATE(start), ISO_DATE(end)),
        ])
        if (!cancelled) {
          setSlots(slotList)
          setMeals(mealList)
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadRef.current = doLoad
    doLoad()
    return () => {
      cancelled = true
      loadRef.current = null
    }
  }, [householdId, startDate.getTime(), numDays])

  const getMealFor = (dateStr, slotId) =>
    meals.find((m) => m.meal_date === dateStr && m.meal_slot_id === slotId)

  const [editingCell, setEditingCell] = useState(null)
  const editingInputRef = useRef(null)

  const isEditing = (dateStr, slotId) =>
    editingCell && editingCell.dateStr === dateStr && editingCell.slotId === slotId

  const startEditing = (dateStr, slotId) => {
    if (!myMemberId) return
    const meal = getMealFor(dateStr, slotId)
    if (meal && meal.member_id !== myMemberId) return
    setEditingCell({ dateStr, slotId, value: meal?.description ?? '' })
    setTimeout(() => editingInputRef.current?.focus(), 0)
  }

  const setEditingValue = (value) => {
    setEditingCell((prev) => (prev ? { ...prev, value } : null))
  }

  const saveEdit = async (dateStr, slotId, value) => {
    const trimmed = (value || '').trim()
    const existing = getMealFor(dateStr, slotId)
    setEditingCell(null)
    setError('')
    try {
      if (trimmed === '') {
        if (existing?.member_id === myMemberId) await deletePlannedMeal(existing.id)
      } else {
        await createOrUpdatePlannedMeal({
          household_id: householdId,
          meal_date: dateStr,
          meal_slot_id: slotId,
          member_id: myMemberId,
          description: trimmed,
        })
      }
      if (loadRef.current) await loadRef.current()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleEditKeyDown = (e, dateStr, slotId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(dateStr, slotId, editingCell?.value ?? '')
    }
    if (e.key === 'Escape') {
      setEditingCell(null)
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
                    const editing = isEditing(dateStr, slot.id)
                    const label = meal
                      ? meal.description
                        ? `${meal.description} [${meal.member_display_name}]`
                        : meal.member_display_name
                      : null
                    return (
                      <td
                        key={`${dateStr}-${slot.id}`}
                        className="meal-planner-cell meal-planner-cell-meal"
                        onClick={() => !editing && startEditing(dateStr, slot.id)}
                      >
                        {editing ? (
                          <input
                            ref={editingInputRef}
                            type="text"
                            className="meal-planner-input"
                            placeholder="e.g. Cereal"
                            value={editingCell?.value ?? ''}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, dateStr, slot.id)}
                            onBlur={() => saveEdit(dateStr, slot.id, editingCell?.value ?? '')}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : meal ? (
                          <span
                            className="meal-planner-entry"
                            style={{ borderLeftColor: meal.member_color || '#888' }}
                            title={meal.member_display_name}
                          >
                            {label}
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
