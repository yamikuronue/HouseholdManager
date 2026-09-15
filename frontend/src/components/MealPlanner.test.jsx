import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MealPlanner from './MealPlanner'
import { pointerDragTo } from '../test/pointerDrag'

vi.mock('../services/api', () => ({
  listMealSlots: vi.fn(),
  listPlannedMeals: vi.fn(),
  createOrUpdatePlannedMeal: vi.fn(),
  updatePlannedMeal: vi.fn(),
  deletePlannedMeal: vi.fn(),
  swapPlannedMeals: vi.fn(),
}))

import {
  listMealSlots,
  listPlannedMeals,
  swapPlannedMeals,
  updatePlannedMeal,
} from '../services/api'

describe('MealPlanner pointer drag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMealSlots.mockResolvedValue([
      { id: 1, name: 'Breakfast' },
      { id: 2, name: 'Lunch' },
    ])
    updatePlannedMeal.mockResolvedValue({})
    swapPlannedMeals.mockResolvedValue({})
    listPlannedMeals.mockImplementation(async (_householdId, startDate) => [
      {
        id: 101,
        meal_date: startDate,
        meal_slot_id: 1,
        description: 'Oatmeal',
        member_id: 1,
        member_color: '#4caf50',
        member_display_name: 'Alex',
      },
    ])
  })

  it('prompts to select a household when none is chosen', () => {
    render(<MealPlanner />)
    expect(screen.getByText('Select a household to view the meal planner.')).toBeInTheDocument()
  })

  it('moves a meal to an empty square', async () => {
    render(<MealPlanner householdId={7} myMemberId={1} mealPlannerWeeks={1} />)
    const handle = await screen.findByLabelText('Drag to move or swap meal')
    const sourceCell = handle.closest('[data-drop-id]')
    const [dateStr] = sourceCell.getAttribute('data-drop-id').split('|')
    const target = document.querySelector(`[data-drop-id="${dateStr}|2"]`)

    pointerDragTo(handle, target)
    await waitFor(() =>
      expect(updatePlannedMeal).toHaveBeenCalledWith(101, {
        meal_date: dateStr,
        meal_slot_id: 2,
      })
    )
    expect(swapPlannedMeals).not.toHaveBeenCalled()
  })

  it('swaps when dropping onto another meal', async () => {
    listPlannedMeals.mockImplementation(async (_householdId, startDate) => [
      {
        id: 101,
        meal_date: startDate,
        meal_slot_id: 1,
        description: 'Oatmeal',
        member_id: 1,
      },
      {
        id: 202,
        meal_date: startDate,
        meal_slot_id: 2,
        description: 'Soup',
        member_id: 1,
      },
    ])
    render(<MealPlanner householdId={7} myMemberId={1} mealPlannerWeeks={1} />)
    const handles = await screen.findAllByLabelText('Drag to move or swap meal')
    const sourceCell = handles[0].closest('[data-drop-id]')
    const [dateStr] = sourceCell.getAttribute('data-drop-id').split('|')
    const target = document.querySelector(`[data-drop-id="${dateStr}|2"]`)

    pointerDragTo(handles[0], target)
    await waitFor(() => expect(swapPlannedMeals).toHaveBeenCalledWith(101, 202))
  })

  it('does not call the API when dropped on the same cell', async () => {
    render(<MealPlanner householdId={7} myMemberId={1} mealPlannerWeeks={1} />)
    const handle = await screen.findByLabelText('Drag to move or swap meal')
    pointerDragTo(handle, handle.closest('[data-drop-id]'))
    await new Promise((r) => setTimeout(r, 30))
    expect(updatePlannedMeal).not.toHaveBeenCalled()
    expect(swapPlannedMeals).not.toHaveBeenCalled()
  })

  it('shows an error when move fails', async () => {
    updatePlannedMeal.mockRejectedValue(new Error('move failed'))
    render(<MealPlanner householdId={7} myMemberId={1} mealPlannerWeeks={1} />)
    const handle = await screen.findByLabelText('Drag to move or swap meal')
    const sourceCell = handle.closest('[data-drop-id]')
    const [dateStr] = sourceCell.getAttribute('data-drop-id').split('|')
    const target = document.querySelector(`[data-drop-id="${dateStr}|2"]`)
    pointerDragTo(handle, target)
    expect(await screen.findByText('move failed')).toBeInTheDocument()
  })
})
