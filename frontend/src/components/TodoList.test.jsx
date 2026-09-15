import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodoList from './TodoList'

vi.mock('../services/api', () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))

import { deleteTodo, listTodos } from '../services/api'

const items = [
  {
    id: 11,
    content: 'Buy milk',
    is_section_header: false,
    is_checked: false,
    member_color: '#4caf50',
    member_display_name: 'Alex',
    position: 0,
  },
  {
    id: 12,
    content: 'Weekend',
    is_section_header: true,
    is_checked: false,
    position: 1,
  },
]

describe('TodoList delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listTodos.mockResolvedValue([...items])
    deleteTodo.mockResolvedValue({})
  })

  it('does not delete on the first trash tap', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteTodo).not.toHaveBeenCalled()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
  })

  it('deletes the item after confirming', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteTodo).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument())
  })

  it('does not delete when canceling', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteTodo).not.toHaveBeenCalled()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows an error banner when delete fails', async () => {
    const user = userEvent.setup()
    deleteTodo.mockRejectedValue({ response: { data: { detail: 'Cannot remove item' } } })
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText('Cannot remove item')).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('falls back to the error message when the API has no detail', async () => {
    const user = userEvent.setup()
    deleteTodo.mockRejectedValue(new Error('network down'))
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText('network down')).toBeInTheDocument()
  })

  it('does not open a native confirm dialog', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<TodoList householdId={7} />)

    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteTodo).toHaveBeenCalled())
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('deletes a section header after confirming', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)

    await screen.findByText('Weekend')
    await user.click(screen.getByRole('button', { name: 'Delete section' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(deleteTodo).toHaveBeenCalledWith(12))
    await waitFor(() => expect(screen.queryByText('Weekend')).not.toBeInTheDocument())
  })
})
