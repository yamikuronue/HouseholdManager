import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodoList from './TodoList'

vi.mock('../services/api', () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))

import { deleteTodo, listTodos, createTodo, updateTodo } from '../services/api'

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

function dataTransferMock() {
  const data = {}
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    setData: (type, value) => {
      data[type] = value
    },
    getData: (type) => data[type] || '',
  }
}

describe('TodoList other flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listTodos.mockResolvedValue([...items])
    deleteTodo.mockResolvedValue({})
    createTodo.mockResolvedValue({})
    updateTodo.mockResolvedValue({})
  })

  it('prompts to select a household when none is chosen', () => {
    render(<TodoList />)
    expect(screen.getByText('Select a household to view the to-do list.')).toBeInTheDocument()
    expect(listTodos).not.toHaveBeenCalled()
  })

  it('shows a loading state then the items', async () => {
    let resolveList
    listTodos.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      })
    )
    render(<TodoList householdId={7} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    resolveList([...items])
    expect(await screen.findByText('Buy milk')).toBeInTheDocument()
  })

  it('shows a load error from the API detail', async () => {
    listTodos.mockRejectedValue({ response: { data: { detail: 'Cannot load todos' } } })
    render(<TodoList householdId={7} />)
    expect(await screen.findByText('Cannot load todos')).toBeInTheDocument()
  })

  it('shows a load error from the Error message', async () => {
    listTodos.mockRejectedValue(new Error('todos offline'))
    render(<TodoList householdId={7} />)
    expect(await screen.findByText('todos offline')).toBeInTheDocument()
  })

  it('toggles an item from the checkbox', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    await waitFor(() => expect(updateTodo).toHaveBeenCalledWith(11, { is_checked: true }))
    expect(screen.getByRole('button', { name: 'Uncheck' })).toBeInTheDocument()
  })

  it('toggles an item from the label click and keyboard', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    const label = await screen.findByText('Buy milk')
    await user.click(label)
    await waitFor(() => expect(updateTodo).toHaveBeenCalledWith(11, { is_checked: true }))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(updateTodo).toHaveBeenCalledWith(11, { is_checked: false }))
    await user.keyboard(' ')
    await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(3))
  })

  it('shows an error when toggle fails with a message fallback', async () => {
    const user = userEvent.setup()
    updateTodo.mockRejectedValue(new Error('Toggle failed'))
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Toggle failed')).toBeInTheDocument()
  })

  it('adds an item', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Type item or section title…'), 'Apples')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(createTodo).toHaveBeenCalledWith({
        household_id: 7,
        content: 'Apples',
        is_section_header: false,
      })
    )
  })

  it('adds a section header', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Type item or section title…'), 'Produce')
    await user.click(screen.getByRole('checkbox', { name: 'Section header' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(createTodo).toHaveBeenCalledWith({
        household_id: 7,
        content: 'Produce',
        is_section_header: true,
      })
    )
  })

  it('submits a new item when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Type item or section title…'), 'Bananas{Enter}')
    await waitFor(() =>
      expect(createTodo).toHaveBeenCalledWith({
        household_id: 7,
        content: 'Bananas',
        is_section_header: false,
      })
    )
  })

  it('cancels add on empty submit or Escape', async () => {
    const user = userEvent.setup()
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(createTodo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()
  })

  it('shows an error when add fails', async () => {
    const user = userEvent.setup()
    createTodo.mockRejectedValue(new Error('add failed'))
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Type item or section title…'), 'Apples')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('add failed')).toBeInTheDocument()
  })

  it('reorders items on drop and persists new positions', async () => {
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()

    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    await waitFor(() => expect(rows[0]).toHaveClass('todo-item-dragging'))
    fireEvent.dragOver(rows[1], { dataTransfer: dt })
    await waitFor(() => expect(rows[1]).toHaveClass('todo-item-drop-target'))
    fireEvent.dragLeave(rows[1])
    fireEvent.dragOver(rows[1], { dataTransfer: dt })
    fireEvent.drop(rows[1], { dataTransfer: dt })
    fireEvent.dragEnd(handles[0])

    await waitFor(() => expect(updateTodo).toHaveBeenCalled())
    expect(updateTodo).toHaveBeenCalledWith(12, { position: 0 })
    expect(updateTodo).toHaveBeenCalledWith(11, { position: 1 })
  })

  it('does not persist when dropped on the same row', async () => {
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()
    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    fireEvent.dragOver(rows[0], { dataTransfer: dt })
    fireEvent.drop(rows[0], { dataTransfer: dt })
    expect(updateTodo).not.toHaveBeenCalled()
  })

  it('reloads when reorder save fails', async () => {
    updateTodo.mockRejectedValue(new Error('reorder failed'))
    render(<TodoList householdId={7} />)
    await screen.findByText('Buy milk')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()
    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    await waitFor(() => expect(rows[0]).toHaveClass('todo-item-dragging'))
    fireEvent.drop(rows[1], { dataTransfer: dt })
    await waitFor(() => expect(listTodos).toHaveBeenCalledTimes(2))
  })

  it('renders fallback labels for empty content', async () => {
    listTodos.mockResolvedValue([
      { id: 31, content: '', is_section_header: false, is_checked: true, position: 0 },
      { id: 32, content: '', is_section_header: true, is_checked: false, position: 1 },
    ])
    render(<TodoList householdId={7} />)
    expect(await screen.findByText('New item')).toBeInTheDocument()
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uncheck' })).toHaveTextContent('✓')
  })
})
