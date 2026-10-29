import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MealPlanner from './MealPlanner'

vi.mock('../services/api', () => ({
  listMealSlots: vi.fn(),
  listPlannedMeals: vi.fn(),
  createOrUpdatePlannedMeal: vi.fn(),
  updatePlannedMeal: vi.fn(),
  deletePlannedMeal: vi.fn(),
  swapPlannedMeals: vi.fn(),
}))

import { listMealSlots, listPlannedMeals } from '../services/api'

describe('MealPlanner dates across DST change', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TZ = 'America/New_York'
    vi.useFakeTimers({ toFake: ['Date'] })
    listMealSlots.mockResolvedValue([{ id: 1, name: 'Dinner' }])
    listPlannedMeals.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  const renderedDates = () =>
    [...document.querySelectorAll('[data-drop-id]')].map((el) => el.getAttribute('data-drop-id').split('|')[0])

  it.each([
    ['morning', new Date(2026, 9, 28, 9, 0)],
    ['evening', new Date(2026, 9, 28, 21, 30)],
  ])('lists every day with correct labels when loaded in the %s', async (_label, now) => {
    vi.setSystemTime(now)
    render(<MealPlanner householdId={7} myMemberId={1} mealPlannerWeeks={2} />)
    await screen.findAllByText('Dinner', { selector: 'th' })

    expect(renderedDates()).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ])
    expect(listPlannedMeals).toHaveBeenCalledWith(7, '2026-10-26', '2026-11-08')

    const rows = [...document.querySelectorAll('.meal-planner-date-label')].map((el) => el.textContent)
    const sat = new Date(2026, 9, 31)
    expect(rows[5]).toBe(
      sat.toLocaleDateString(undefined, { weekday: 'short' }) +
        sat.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    )
  })
})
