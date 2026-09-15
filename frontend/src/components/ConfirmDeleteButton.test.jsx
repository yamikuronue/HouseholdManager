import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDeleteButton from './ConfirmDeleteButton'

afterEach(() => {
  vi.useRealTimers()
})

describe('ConfirmDeleteButton', () => {
  it('does not call onConfirm on the first tap', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} idleLabel="Delete" idleTitle="Remove item" />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Confirm delete?')
  })

  it('calls onConfirm when Delete is tapped while pending', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
  })

  it('restores the trash icon when Cancel is tapped', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} idleLabel="Delete section" />)

    await user.click(screen.getByRole('button', { name: 'Delete section' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete section' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
  })

  it('restores the trash icon when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.keyboard('{Escape}')

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('restores the trash icon after the timeout', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} timeoutMs={400} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('arms only one instance at a time', async () => {
    const user = userEvent.setup()
    const firstConfirm = vi.fn()
    const secondConfirm = vi.fn()
    render(
      <>
        <ConfirmDeleteButton onConfirm={firstConfirm} idleLabel="Delete first" />
        <ConfirmDeleteButton onConfirm={secondConfirm} idleLabel="Delete second" />
      </>
    )

    await user.click(screen.getByRole('button', { name: 'Delete first' }))
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete second' }))

    expect(screen.getByRole('button', { name: 'Delete first' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete second' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Confirm delete' })).toHaveLength(1)
    expect(firstConfirm).not.toHaveBeenCalled()
    expect(secondConfirm).not.toHaveBeenCalled()
  })

  it('ignores non-Escape keys while pending', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.keyboard('a')

    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('focuses the confirm action when armed', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteButton onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('button', { name: 'Confirm delete' })).toHaveFocus()
  })

  it('stops click propagation so parent handlers do not fire', async () => {
    const user = userEvent.setup()
    const onParentClick = vi.fn()
    const onConfirm = vi.fn()
    render(
      <div onClick={onParentClick}>
        <ConfirmDeleteButton onConfirm={onConfirm} />
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(onParentClick).not.toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
