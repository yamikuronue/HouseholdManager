import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import usePointerDrag, { persistReorder } from './usePointerDrag'
import { pointerDragTo } from '../test/pointerDrag'

function DragDemo({ onDrop }) {
  const { activeId, bindHandle } = usePointerDrag(onDrop)
  return (
    <div>
      <button type="button" {...bindHandle('a', { from: 'a' })}>
        handle
      </button>
      <div data-drop-id="b">target</div>
      <span>{activeId || 'idle'}</span>
    </div>
  )
}

describe('persistReorder', () => {
  it('returns the same items when indexes match or are missing', async () => {
    const items = [{ id: 1, position: 0 }]
    const updateItem = vi.fn()
    expect(await persistReorder(items, 0, 0, updateItem)).toBe(items)
    expect(await persistReorder(items, null, 1, updateItem)).toBe(items)
    expect(updateItem).not.toHaveBeenCalled()
  })

  it('reorders and persists changed positions', async () => {
    const items = [
      { id: 1, position: 0 },
      { id: 2, position: 1 },
    ]
    const updateItem = vi.fn().mockResolvedValue({})
    const next = await persistReorder(items, 0, 1, updateItem)
    expect(next.map((i) => i.id)).toEqual([2, 1])
    expect(updateItem).toHaveBeenCalledWith(2, { position: 0 })
    expect(updateItem).toHaveBeenCalledWith(1, { position: 1 })
  })
})

describe('usePointerDrag', () => {
  it('drops onto a target under the pointer', () => {
    const onDrop = vi.fn()
    render(<DragDemo onDrop={onDrop} />)
    pointerDragTo(screen.getByRole('button', { name: 'handle' }), screen.getByText('target'))
    expect(onDrop).toHaveBeenCalledWith({ from: 'a' }, 'b')
  })

  it('ignores non-primary buttons and cancels', () => {
    const onDrop = vi.fn()
    render(<DragDemo onDrop={onDrop} />)
    const handle = screen.getByRole('button', { name: 'handle' })
    fireEvent.pointerDown(handle, { button: 2, pointerId: 1 })
    expect(screen.getByText('idle')).toBeInTheDocument()
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 })
    expect(screen.getByText('a')).toBeInTheDocument()
    fireEvent.pointerCancel(handle)
    expect(screen.getByText('idle')).toBeInTheDocument()
    expect(onDrop).not.toHaveBeenCalled()
  })
})
