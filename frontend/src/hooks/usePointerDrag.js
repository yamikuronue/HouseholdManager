import { useCallback, useRef, useState } from 'react'

function dropIdFromPoint(clientX, clientY) {
  const node = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null
  return node?.closest?.('[data-drop-id]')?.getAttribute('data-drop-id') ?? null
}

/**
 * Pointer-based drag (mouse + touch). HTML5 drag-and-drop does not fire in
 * Android WebView / iOS, so list and meal-planner moves use this instead.
 */
export default function usePointerDrag(onDrop) {
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)
  const dragRef = useRef(null)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const clear = useCallback(() => {
    dragRef.current = null
    setActiveId(null)
    setOverId(null)
  }, [])

  const bindHandle = useCallback(
    (id, payload) => ({
      onPointerDown: (event) => {
        if (event.button != null && event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const key = String(id)
        dragRef.current = { id: key, payload }
        setActiveId(key)
        setOverId(key)
        event.currentTarget.setPointerCapture?.(event.pointerId)
      },
      onPointerMove: (event) => {
        if (!dragRef.current) return
        setOverId(dropIdFromPoint(event.clientX, event.clientY))
      },
      onPointerUp: (event) => {
        if (!dragRef.current) return
        const from = dragRef.current
        const toId = dropIdFromPoint(event.clientX, event.clientY)
        clear()
        if (toId && toId !== from.id) {
          onDropRef.current?.(from.payload, toId)
        }
      },
      onPointerCancel: () => {
        clear()
      },
    }),
    [clear]
  )

  return { activeId, overId, bindHandle }
}

export async function persistReorder(items, fromIndex, toIndex, updateItem) {
  if (fromIndex == null || toIndex == null || fromIndex === toIndex) return items
  const reordered = [...items]
  const [removed] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, removed)
  const toUpdate = reordered
    .map((item, idx) => (item.position !== idx ? { item, newPosition: idx } : null))
    .filter(Boolean)
  await Promise.all(toUpdate.map(({ item, newPosition }) => updateItem(item.id, { position: newPosition })))
  return reordered
}
