import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import './ConfirmDeleteButton.css'

export const DEFAULT_CONFIRM_TIMEOUT_MS = 5000

const armListeners = new Set()

function notifyArmed(instanceId) {
  armListeners.forEach((listener) => listener(instanceId))
}

export default function ConfirmDeleteButton({
  onConfirm,
  idleLabel = 'Delete',
  idleTitle,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  className = '',
  timeoutMs = DEFAULT_CONFIRM_TIMEOUT_MS,
}) {
  const instanceId = useId()
  const [pending, setPending] = useState(false)
  const timeoutRef = useRef(null)
  const confirmBtnRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const disarm = useCallback(() => {
    clearTimer()
    setPending(false)
  }, [clearTimer])

  const arm = useCallback(() => {
    notifyArmed(instanceId)
    setPending(true)
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setPending(false)
    }, timeoutMs)
  }, [clearTimer, instanceId, timeoutMs])

  useEffect(() => {
    const onOtherArmed = (armedId) => {
      if (armedId === instanceId) return
      clearTimer()
      setPending(false)
    }
    armListeners.add(onOtherArmed)
    return () => {
      armListeners.delete(onOtherArmed)
      clearTimer()
    }
  }, [clearTimer, instanceId])

  useEffect(() => {
    if (!pending) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      disarm()
    }
    document.addEventListener('keydown', onKeyDown)
    confirmBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [disarm, pending])

  const stop = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleIdleClick = (event) => {
    stop(event)
    arm()
  }

  const handleConfirmClick = async (event) => {
    stop(event)
    disarm()
    await onConfirm?.(event)
  }

  const handleCancelClick = (event) => {
    stop(event)
    disarm()
  }

  if (!pending) {
    return (
      <button
        type="button"
        className={`confirm-delete-idle ${className}`.trim()}
        onClick={handleIdleClick}
        aria-label={idleLabel}
        title={idleTitle || idleLabel}
      >
        🗑
      </button>
    )
  }

  return (
    <span className="confirm-delete-pending" role="group" aria-label="Confirm delete">
      <span className="confirm-delete-live vis-hidden" role="status" aria-live="polite">
        Confirm delete?
      </span>
      <button
        ref={confirmBtnRef}
        type="button"
        className="confirm-delete-confirm"
        onClick={handleConfirmClick}
        aria-label="Confirm delete"
      >
        {confirmLabel}
      </button>
      <button type="button" className="confirm-delete-cancel" onClick={handleCancelClick}>
        {cancelLabel}
      </button>
    </span>
  )
}
