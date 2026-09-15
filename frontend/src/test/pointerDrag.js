import { fireEvent } from '@testing-library/react'

export function pointerDragTo(source, target, { clientX = 40, clientY = 40 } = {}) {
  fireEvent.pointerDown(source, { button: 0, pointerId: 1, clientX: 8, clientY: 8 })
  const original = document.elementFromPoint
  document.elementFromPoint = () => target
  try {
    fireEvent.pointerMove(source, { pointerId: 1, clientX, clientY })
    fireEvent.pointerUp(source, { pointerId: 1, clientX, clientY })
  } finally {
    document.elementFromPoint = original
  }
}
