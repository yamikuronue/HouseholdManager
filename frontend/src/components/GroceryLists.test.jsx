import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

import {
  createGroceryList,
  createGroceryListItem,
  deleteGroceryList,
  deleteGroceryListItem,
  listGroceryListItems,
  listGroceryLists,
  updateGroceryListItem,
} from '../services/api'

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

describe('GroceryLists other flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGroceryLists.mockResolvedValue([...lists])
    listGroceryListItems.mockResolvedValue([...items])
    deleteGroceryListItem.mockResolvedValue({})
    createGroceryList.mockResolvedValue({ id: 9, name: 'Trader Joes', household_id: 7 })
    createGroceryListItem.mockResolvedValue({})
    updateGroceryListItem.mockResolvedValue({})
    deleteGroceryList.mockResolvedValue({})
  })

  it('prompts to select a household when none is chosen', () => {
    render(<GroceryLists />)
    expect(screen.getByText('Select a household to view grocery lists.')).toBeInTheDocument()
    expect(listGroceryLists).not.toHaveBeenCalled()
  })

  it('shows Loading when lists have not arrived', () => {
    listGroceryLists.mockReturnValue(new Promise(() => {}))
    render(<GroceryLists householdId={7} myMemberId={1} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('records a list load error even if the empty state stays visible', async () => {
    listGroceryLists.mockRejectedValue({ response: { data: { detail: 'lists failed' } } })
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await waitFor(() => expect(listGroceryLists).toHaveBeenCalled())
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an item load error', async () => {
    listGroceryListItems.mockRejectedValue(new Error('items failed'))
    render(<GroceryLists householdId={7} myMemberId={1} />)
    expect(await screen.findByText('items failed')).toBeInTheDocument()
  })

  it('creates a list from the prompt and ignores cancel', async () => {
    const user = userEvent.setup()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('Trader Joes').mockReturnValueOnce(null)
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: '+ Add list' }))
    await waitFor(() =>
      expect(createGroceryList).toHaveBeenCalledWith({ household_id: 7, name: 'Trader Joes' })
    )
    await user.click(screen.getByRole('button', { name: '+ Add list' }))
    expect(createGroceryList).toHaveBeenCalledTimes(1)
    promptSpy.mockRestore()
  })

  it('shows an error when creating a list fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'prompt').mockReturnValue('Fail list')
    createGroceryList.mockRejectedValue(new Error('create list failed'))
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: '+ Add list' }))
    expect(await screen.findByText('create list failed')).toBeInTheDocument()
    window.prompt.mockRestore()
  })

  it('does not show a list delete control when only one list exists', async () => {
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    expect(screen.queryByRole('button', { name: 'Delete Costco' })).not.toBeInTheDocument()
  })

  it('deletes a list after native confirm when more than one list exists', async () => {
    const user = userEvent.setup()
    listGroceryLists
      .mockResolvedValueOnce([
        { id: 3, name: 'Costco', household_id: 7 },
        { id: 4, name: 'Aldi', household_id: 7 },
      ])
      .mockResolvedValueOnce([{ id: 4, name: 'Aldi', household_id: 7 }])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByRole('button', { name: 'Delete Costco' })
    await user.click(screen.getByRole('button', { name: 'Delete Costco' }))
    await waitFor(() => expect(deleteGroceryList).toHaveBeenCalledWith(3))
    confirmSpy.mockRestore()
  })

  it('does not delete a list when confirm is declined', async () => {
    const user = userEvent.setup()
    listGroceryLists.mockResolvedValue([
      { id: 3, name: 'Costco', household_id: 7 },
      { id: 4, name: 'Aldi', household_id: 7 },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await user.click(await screen.findByRole('button', { name: 'Delete Costco' }))
    expect(deleteGroceryList).not.toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('shows an error when list delete fails', async () => {
    const user = userEvent.setup()
    listGroceryLists.mockResolvedValue([
      { id: 3, name: 'Costco', household_id: 7 },
      { id: 4, name: 'Aldi', household_id: 7 },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteGroceryList.mockRejectedValue({ response: { data: { detail: 'list delete failed' } } })
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await user.click(await screen.findByRole('button', { name: 'Delete Costco' }))
    expect(await screen.findByText('list delete failed')).toBeInTheDocument()
    window.confirm.mockRestore()
  })

  it('navigates grocery tabs with arrow keys, Home, and End', async () => {
    const user = userEvent.setup()
    listGroceryLists.mockResolvedValue([
      { id: 3, name: 'Costco', household_id: 7 },
      { id: 4, name: 'Aldi', household_id: 7 },
      { id: 5, name: 'Target', household_id: 7 },
    ])
    render(<GroceryLists householdId={7} myMemberId={1} />)
    const firstTab = await screen.findByRole('tab', { name: /Costco/ })
    firstTab.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Aldi/ })).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Costco/ })).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{End}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Target/ })).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{Home}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Costco/ })).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Target/ })).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Costco/ })).toHaveAttribute('aria-selected', 'true'))
  })

  it('toggles an item from the checkbox and label', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Cross out' }))
    await waitFor(() => expect(updateGroceryListItem).toHaveBeenCalledWith(21, { is_checked: true }))
    const label = screen.getByText('Eggs')
    await user.click(label)
    await waitFor(() => expect(updateGroceryListItem).toHaveBeenCalledWith(21, { is_checked: false }))
    label.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(updateGroceryListItem).toHaveBeenCalledTimes(3))
    await user.keyboard(' ')
    await waitFor(() => expect(updateGroceryListItem).toHaveBeenCalledTimes(4))
    fireEvent.keyDown(label, { key: 'a' })
    expect(updateGroceryListItem).toHaveBeenCalledTimes(4)
  })

  it('shows an error when toggle fails', async () => {
    const user = userEvent.setup()
    updateGroceryListItem.mockRejectedValue(new Error('toggle failed'))
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Cross out' }))
    expect(await screen.findByText('toggle failed')).toBeInTheDocument()
  })

  it('adds an item', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Item or section title…'), 'Butter')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(createGroceryListItem).toHaveBeenCalledWith({
        grocery_list_id: 3,
        content: 'Butter',
        is_section_header: false,
        member_id: 1,
      })
    )
  })

  it('submits a new grocery item when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Item or section title…'), 'Juice{Enter}')
    await waitFor(() =>
      expect(createGroceryListItem).toHaveBeenCalledWith({
        grocery_list_id: 3,
        content: 'Juice',
        is_section_header: false,
        member_id: 1,
      })
    )
  })

  it('cancels the add row', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(createGroceryListItem).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Click to add item' })).toBeInTheDocument()
  })

  it('adds a section header', async () => {
    const user = userEvent.setup()
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Item or section title…'), 'Frozen')
    await user.click(screen.getByRole('checkbox', { name: 'Section header' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(createGroceryListItem).toHaveBeenCalledWith({
        grocery_list_id: 3,
        content: 'Frozen',
        is_section_header: true,
        member_id: 1,
      })
    )
  })

  it('reports an error when adding an item fails', async () => {
    const user = userEvent.setup()
    createGroceryListItem.mockRejectedValue({ response: { data: { detail: 'add item failed' } } })
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    await user.click(screen.getByRole('button', { name: 'Click to add item' }))
    await user.type(screen.getByPlaceholderText('Item or section title…'), 'Yogurt')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('add item failed')).toBeInTheDocument()
  })

  it('deletes crossed-out items and reports errors', async () => {
    const user = userEvent.setup()
    listGroceryListItems.mockResolvedValue([
      { ...items[0], is_checked: true },
      items[1],
    ])
    render(<GroceryLists householdId={7} myMemberId={1} />)
    const clearBtn = await screen.findByRole('button', { name: 'Delete crossed-out items (1)' })
    await user.click(clearBtn)
    await waitFor(() => expect(deleteGroceryListItem).toHaveBeenCalledWith(21))
    await waitFor(() => expect(screen.queryByText('Eggs')).not.toBeInTheDocument())
  })

  it('reloads grocery items when clearing crossed-out items fails', async () => {
    const user = userEvent.setup()
    listGroceryListItems.mockResolvedValue([{ ...items[0], is_checked: true }])
    deleteGroceryListItem.mockRejectedValue(new Error('clear failed'))
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await user.click(await screen.findByRole('button', { name: /Delete crossed-out items/ }))
    await waitFor(() => expect(listGroceryListItems).toHaveBeenCalledTimes(2))
  })

  it('reorders grocery items on drop', async () => {
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()
    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    await waitFor(() => expect(rows[0]).toHaveClass('grocery-list-item-dragging'))
    fireEvent.dragOver(rows[1], { dataTransfer: dt })
    await waitFor(() => expect(rows[1]).toHaveClass('grocery-list-item-drop-target'))
    fireEvent.dragLeave(rows[1])
    fireEvent.drop(rows[1], { dataTransfer: dt })
    fireEvent.dragEnd(handles[0])
    await waitFor(() => expect(updateGroceryListItem).toHaveBeenCalledWith(22, { position: 0 }))
    expect(updateGroceryListItem).toHaveBeenCalledWith(21, { position: 1 })
  })

  it('does not persist grocery reorder on same-row drop', async () => {
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()
    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    fireEvent.drop(rows[0], { dataTransfer: dt })
    expect(updateGroceryListItem).not.toHaveBeenCalled()
  })

  it('reloads grocery items when reorder save fails', async () => {
    updateGroceryListItem.mockRejectedValue({ response: { data: { detail: 'reorder failed' } } })
    render(<GroceryLists householdId={7} myMemberId={1} />)
    await screen.findByText('Eggs')
    const handles = screen.getAllByLabelText('Drag to reorder')
    const rows = screen.getAllByRole('listitem')
    const dt = dataTransferMock()
    fireEvent.dragStart(handles[0], { dataTransfer: dt })
    await waitFor(() => expect(rows[0]).toHaveClass('grocery-list-item-dragging'))
    fireEvent.drop(rows[1], { dataTransfer: dt })
    await waitFor(() => expect(listGroceryListItems).toHaveBeenCalledTimes(2))
  })

  it('renders fallback labels for empty grocery content', async () => {
    listGroceryListItems.mockResolvedValue([
      { id: 41, content: '', is_section_header: false, is_checked: true, position: 0 },
      { id: 42, content: '', is_section_header: true, is_checked: false, position: 1 },
    ])
    render(<GroceryLists householdId={7} myMemberId={1} />)
    expect(await screen.findByText('New item')).toBeInTheDocument()
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark not done' })).toHaveTextContent('✓')
  })
})
