import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}))

vi.mock('../services/api', () => ({
  listHouseholds: vi.fn(),
  createHousehold: vi.fn(),
  createMember: vi.fn(),
  listMembers: vi.fn(),
  listInvitations: vi.fn(),
  listMyPendingInvitations: vi.fn(),
  createInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  declineMyPendingInvitation: vi.fn(),
  deleteMember: vi.fn(),
  deleteHousehold: vi.fn(),
  createCalendar: vi.fn(),
  listCalendars: vi.fn(),
  deleteCalendar: vi.fn(),
  getGoogleCalendars: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  updateMember: vi.fn(),
  updateHousehold: vi.fn(),
  listMealSlots: vi.fn(),
  createMealSlot: vi.fn(),
  updateMealSlot: vi.fn(),
  deleteMealSlot: vi.fn(),
}))

import Settings from './Settings'
import { deleteMember, getGoogleCalendars, listCalendars, listHouseholds, listInvitations, listMealSlots, listMembers, listMyPendingInvitations } from '../services/api'

describe('Settings in-app confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listHouseholds.mockResolvedValue([{ id: 7, name: 'Home', meal_planner_weeks: 2 }])
    listInvitations.mockResolvedValue([])
    listMyPendingInvitations.mockResolvedValue([])
    listMembers.mockImplementation(async (householdId) => {
      const members = [
        {
          id: 1,
          household_id: 7,
          user_id: 1,
          role: 'owner',
          event_color: '#bae1ff',
          user: { display_name: 'Me' },
        },
        {
          id: 2,
          household_id: 7,
          user_id: 2,
          role: 'member',
          event_color: '#ffb3ba',
          user: { display_name: 'Sam' },
        },
      ]
      return householdId === 7 || householdId == null ? members : members
    })
    listCalendars.mockResolvedValue([])
    listMealSlots.mockResolvedValue([])
    getGoogleCalendars.mockResolvedValue([])
    deleteMember.mockResolvedValue({})
  })

  it('asks for confirmation in an in-app dialog instead of window.confirm', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    const samRow = (await screen.findByText('Sam')).closest('li')
    await user.click(within(samRow).getByRole('button', { name: 'Remove' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Remove member' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(deleteMember).not.toHaveBeenCalled()

    await user.click(within(samRow).getByRole('button', { name: 'Remove' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(deleteMember).toHaveBeenCalledWith(2))
    confirmSpy.mockRestore()
  })
})
