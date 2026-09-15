import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GroceryLists from './GroceryLists'

vi.mock('../services/api', () => ({
  listGroceryLists: vi.fn(),
  createGroceryList: vi.fn(),
  deleteGroceryList: vi.fn(),
  listGroceryListItems: vi.fn(),
  createGroceryListItem: vi.fn(),
  updateGroceryListItem: vi.fn(),
  deleteGroceryListItem: vi.fn(),
}))

import { deleteGroceryListItem, listGroceryListItems, listGroceryLists } from '../services/api'

const lists = [{ id: 3, name: 'Costco', household_id: 7 }]
const items = [
  {
    id: 21,
    content: 'Eggs',
    is_section_header: false,
    is_checked: false,
    member_color: '#2196f3',
    member_display_name: 'Sam',
    position: 0,
  },
  {
    id: 22,
    content: 'Produce',
    is_section_header: true,
    is_checked: false,
    position: 1,
  },
]

describe('GroceryLists item delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGroceryLists.mockResolvedValue([...lists])
    listGroceryListItems.mockResolvedValue([...items])
    deleteGroceryListItem.mockResolvedValue({})
  })

  it('does not delete on the first trash tap', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteGroceryListItem).not.toHaveBeenCalled()
    expect(screen.getByText('Eggs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
  })

  it('deletes the item after confirming', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteGroceryListItem).toHaveBeenCalledWith(21))
    await waitFor(() => expect(screen.queryByText('Eggs')).not.toBeInTheDocument())
  })

  it('does not delete when canceling', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteGroceryListItem).not.toHaveBeenCalled()
    expect(screen.getByText('Eggs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows an error banner when delete fails', async () => {
    const user = userEvent.setup()
    deleteGroceryListItem.mockRejectedValue({
      response: { data: { detail: 'Item is locked' } },
    })
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText('Item is locked')).toBeInTheDocument()
    expect(screen.getByText('Eggs')).toBeInTheDocument()
  })

  it('falls back to the error message when the API has no detail', async () => {
    const user = userEvent.setup()
    deleteGroceryListItem.mockRejectedValue(new Error('offline'))
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText('offline')).toBeInTheDocument()
  })

  it('does not open a native confirm dialog for item delete', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteGroceryListItem).toHaveBeenCalled())
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('deletes a section header after confirming', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)

    await screen.findByText('Produce')
    await user.click(screen.getByRole('button', { name: 'Delete section' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteGroceryListItem).toHaveBeenCalledWith(22))
    await waitFor(() => expect(screen.queryByText('Produce')).not.toBeInTheDocument())
  })
})
