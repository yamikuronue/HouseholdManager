import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppDialog from './AppDialog'

describe('AppDialog', () => {
  it('does not render when closed', () => {
    render(<AppDialog open={false} title="Closed" onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirms and cancels a message dialog', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AppDialog
        open
        title="Remove member"
        message="They will lose access."
        confirmLabel="Remove"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Remove member' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and overlay click', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AppDialog open title="Confirm" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()

    onCancel.mockClear()
    fireEvent.click(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('submits prompt text', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <AppDialog
        open
        title="New grocery list"
        prompt
        promptLabel="List name"
        promptDefault=""
        confirmLabel="Add"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    await user.type(screen.getByLabelText('List name'), 'Costco')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith('Costco')
  })
})
