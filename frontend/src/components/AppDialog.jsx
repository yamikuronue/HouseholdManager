import React, { useEffect, useRef } from 'react'
import './AppDialog.css'

function getFocusables(container) {
  if (!container) return []
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  return [...container.querySelectorAll(sel)].filter(
    (el) => el instanceof HTMLElement && !el.hasAttribute('disabled')
  )
}

export default function AppDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  prompt = false,
  promptLabel = '',
  promptDefault = '',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  const onConfirmRef = useRef(onConfirm)
  onCancelRef.current = onCancel
  onConfirmRef.current = onConfirm
  const [promptValue, setPromptValue] = React.useState(promptDefault)

  useEffect(() => {
    if (open) setPromptValue(promptDefault)
  }, [open, promptDefault])

  useEffect(() => {
    if (!open) return undefined
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = dialogRef.current
    if (!el) return undefined
    const focusables = getFocusables(el)
    if (prompt && inputRef.current) inputRef.current.focus()
    else if (focusables.length > 0) focusables[0].focus()

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const list = getFocusables(el)
      if (list.length === 0) return
      const i = list.indexOf(document.activeElement)
      const next = event.shiftKey
        ? i <= 0
          ? list.length - 1
          : i - 1
        : i >= list.length - 1
          ? 0
          : i + 1
      event.preventDefault()
      list[next].focus()
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus?.()
    }
  }, [open, prompt])

  if (!open) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    if (prompt) onConfirmRef.current?.(promptValue)
    else onConfirmRef.current?.()
  }

  return (
    <div className="app-dialog-overlay" onClick={onCancel} role="presentation">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="app-dialog-title" className="app-dialog-title">
          {title}
        </h2>
        {message && <p className="app-dialog-message">{message}</p>}
        <form onSubmit={handleSubmit}>
          {prompt && (
            <label className="app-dialog-prompt">
              {promptLabel ? <span className="app-dialog-prompt-label">{promptLabel}</span> : null}
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                aria-label={promptLabel || title}
              />
            </label>
          )}
          <div className="app-dialog-actions">
            <button
              type="submit"
              className={danger ? 'app-dialog-confirm-danger' : 'app-dialog-confirm'}
            >
              {confirmLabel}
            </button>
            <button type="button" className="app-dialog-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
