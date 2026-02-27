import React, { useState, useEffect, useCallback } from 'react'
import { listTodos, createTodo, updateTodo, deleteTodo } from '../services/api'
import './TodoList.css'

export default function TodoList({ householdId, households = [] }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newIsSection, setNewIsSection] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!householdId) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await listTodos(householdId)
      setItems(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  const handleAddClick = () => {
    setAdding(true)
    setNewContent('')
    setNewIsSection(false)
  }

  const handleAddSubmit = async () => {
    const content = newContent.trim()
    if (!content || !householdId) {
      setAdding(false)
      return
    }
    setError('')
    try {
      await createTodo({
        household_id: householdId,
        content,
        is_section_header: newIsSection,
      })
      setNewContent('')
      setNewIsSection(false)
      setAdding(false)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleToggle = async (item) => {
    if (item.is_section_header) return
    setError('')
    try {
      await updateTodo(item.id, { is_checked: !item.is_checked })
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, is_checked: !i.is_checked, checked_at: !item.is_checked ? new Date().toISOString() : null }
            : i
        )
      )
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDelete = async (item, e) => {
    e.stopPropagation()
    if (!window.confirm('Remove this item?')) return
    setError('')
    try {
      await deleteTodo(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dropTargetIndex, setDropTargetIndex] = useState(null)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.setData('application/json', JSON.stringify({ index }))
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex === null || draggedIndex === index) return
    setDropTargetIndex(index)
  }

  const handleDragLeave = () => {
    setDropTargetIndex(null)
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDropTargetIndex(null)
    const dragIndex = draggedIndex
    setDraggedIndex(null)
    if (dragIndex == null || dragIndex === dropIndex) return
    const reordered = [...items]
    const [removed] = reordered.splice(dragIndex, 1)
    reordered.splice(dropIndex, 0, removed)
    setItems(reordered)
    setError('')
    const toUpdate = reordered
      .map((item, idx) => (item.position !== idx ? { item, newPosition: idx } : null))
      .filter(Boolean)
    try {
      await Promise.all(toUpdate.map(({ item, newPosition }) => updateTodo(item.id, { position: newPosition })))
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      load()
    }
  }

  if (!householdId) {
    return (
      <div className="todo-list todo-list-empty">
        <p className="todo-list-muted">Select a household to view the to-do list.</p>
      </div>
    )
  }

  return (
    <div className="todo-list">
      <h2 className="todo-list-title">To-do</h2>
      {error && <div className="todo-list-error">{error}</div>}
      {loading ? (
        <p className="todo-list-muted">Loading…</p>
      ) : (
        <>
          <ul className="todo-list-items">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`todo-item ${item.is_section_header ? 'todo-item-section' : ''} ${item.is_checked ? 'todo-item-checked' : ''} ${draggedIndex === index ? 'todo-item-dragging' : ''} ${dropTargetIndex === index ? 'todo-item-drop-target' : ''}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <span
                  className="todo-item-drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>
                {item.is_section_header ? (
                  <>
                    <span className="todo-item-section-text">{item.content || 'Section'}</span>
                    <button
                      type="button"
                      className="todo-item-delete"
                      onClick={(e) => handleDelete(item, e)}
                      aria-label="Delete section"
                      title="Remove section"
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="todo-item-check"
                      onClick={() => handleToggle(item)}
                      aria-label={item.is_checked ? 'Uncheck' : 'Check'}
                    >
                      {item.is_checked ? '✓' : ''}
                    </button>
                    <span
                      className="todo-item-label"
                      onClick={() => handleToggle(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleToggle(item)}
                    >
                      {item.content || 'New item'}
                    </span>
                    <button
                      type="button"
                      className="todo-item-delete"
                      onClick={(e) => handleDelete(item, e)}
                      aria-label="Delete"
                      title="Remove item"
                    >
                      🗑
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {adding ? (
            <div className="todo-add-row">
              <input
                type="text"
                className="todo-add-input"
                placeholder="Type item or section title…"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubmit()
                  if (e.key === 'Escape') setAdding(false)
                }}
                autoFocus
              />
              <label className="todo-add-section">
                <input
                  type="checkbox"
                  checked={newIsSection}
                  onChange={(e) => setNewIsSection(e.target.checked)}
                />
                Section header
              </label>
              <button type="button" className="todo-add-btn" onClick={handleAddSubmit}>
                Add
              </button>
              <button type="button" className="todo-add-cancel" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="todo-add-placeholder"
              onClick={handleAddClick}
            >
              Click to add item
            </button>
          )}
        </>
      )}
    </div>
  )
}
