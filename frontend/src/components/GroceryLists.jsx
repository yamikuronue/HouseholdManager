import React, { useState, useEffect, useCallback } from 'react'
import {
  listGroceryLists,
  createGroceryList,
  deleteGroceryList,
  listGroceryListItems,
  createGroceryListItem,
  updateGroceryListItem,
  deleteGroceryListItem,
} from '../services/api'
import './GroceryLists.css'

export default function GroceryLists({ householdId, myMemberId }) {
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newIsSection, setNewIsSection] = useState(false)
  const [error, setError] = useState('')
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dropTargetIndex, setDropTargetIndex] = useState(null)

  const loadLists = useCallback(async () => {
    if (!householdId) {
      setLists([])
      setActiveListId(null)
      return
    }
    setError('')
    try {
      const data = await listGroceryLists(householdId)
      setLists(data)
      if (data.length > 0 && !data.some((l) => l.id === activeListId)) {
        setActiveListId(data[0].id)
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }, [householdId])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  const loadItems = useCallback(async () => {
    if (!activeListId) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await listGroceryListItems(activeListId)
      setItems(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [activeListId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleAddList = async () => {
    const name = window.prompt('Store or list name (e.g. Costco):', '')
    if (name == null || !name.trim() || !householdId) return
    setError('')
    try {
      const created = await createGroceryList({ household_id: householdId, name: name.trim() })
      setLists((prev) => [...prev, created])
      setActiveListId(created.id)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteList = async (listId, e) => {
    e.stopPropagation()
    if (lists.length <= 1) return
    if (!window.confirm('Remove this list and all its items?')) return
    setError('')
    try {
      await deleteGroceryList(listId)
      const data = await listGroceryLists(householdId)
      setLists(data)
      if (activeListId === listId) setActiveListId(data.length ? data[0].id : null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleAddItemClick = () => {
    setAdding(true)
    setNewContent('')
    setNewIsSection(false)
  }

  const handleAddItemSubmit = async () => {
    const content = newContent.trim()
    if (!content || !activeListId) {
      setAdding(false)
      return
    }
    setError('')
    try {
      await createGroceryListItem({
        grocery_list_id: activeListId,
        content,
        is_section_header: newIsSection,
        member_id: myMemberId ?? undefined,
      })
      setNewContent('')
      setNewIsSection(false)
      setAdding(false)
      loadItems()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteItem = async (item, e) => {
    e.stopPropagation()
    if (!window.confirm('Remove this item?')) return
    setError('')
    try {
      await deleteGroceryListItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
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

  const handleDragLeave = () => setDropTargetIndex(null)

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
      await Promise.all(
        toUpdate.map(({ item, newPosition }) =>
          updateGroceryListItem(item.id, { position: newPosition })
        )
      )
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      loadItems()
    }
  }

  const canDeleteList = lists.length > 1

  if (!householdId) {
    return (
      <div className="grocery-lists grocery-lists-empty">
        <p className="grocery-lists-muted">Select a household to view grocery lists.</p>
      </div>
    )
  }

  return (
    <div className="grocery-lists">
      <div className="grocery-lists-header">
        <h2 className="grocery-lists-title">Grocery lists</h2>
        <button type="button" className="grocery-lists-add-list" onClick={handleAddList}>
          + Add list
        </button>
      </div>
      {lists.length === 0 ? (
        <p className="grocery-lists-muted">Loading…</p>
      ) : (
        <>
          <div className="grocery-lists-tabs" role="tablist">
            {lists.map((list) => (
              <div
                key={list.id}
                role="tab"
                aria-selected={activeListId === list.id}
                className={`grocery-lists-tab ${activeListId === list.id ? 'grocery-lists-tab-active' : ''}`}
                onClick={() => setActiveListId(list.id)}
              >
                <span className="grocery-lists-tab-label">{list.name}</span>
                {canDeleteList && (
                  <button
                    type="button"
                    className="grocery-lists-tab-delete"
                    onClick={(e) => handleDeleteList(list.id, e)}
                    aria-label={`Delete ${list.name}`}
                    title="Remove list"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && <div className="grocery-lists-error">{error}</div>}
          {activeListId && (
            <div className="grocery-lists-panel">
              {loading ? (
                <p className="grocery-lists-muted">Loading…</p>
              ) : (
                <>
                  <ul className="grocery-lists-items">
                    {items.map((item, index) => (
                      <li
                        key={item.id}
                        className={`grocery-list-item ${item.is_section_header ? 'grocery-list-item-section' : ''} ${draggedIndex === index ? 'grocery-list-item-dragging' : ''} ${dropTargetIndex === index ? 'grocery-list-item-drop-target' : ''}`}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <span
                          className="grocery-list-item-drag-handle"
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
                            <span className="grocery-list-item-section-text">
                              {item.content || 'Section'}
                            </span>
                            <button
                              type="button"
                              className="grocery-list-item-delete"
                              onClick={(e) => handleDeleteItem(item, e)}
                              aria-label="Delete section"
                            >
                              🗑
                            </button>
                          </>
                        ) : (
                          <>
                            {item.member_color && (
                              <span
                                className="grocery-list-item-dot"
                                style={{ backgroundColor: item.member_color }}
                                title={item.member_display_name || ''}
                              />
                            )}
                            <span className="grocery-list-item-label">
                              {item.content || 'New item'}
                            </span>
                            <button
                              type="button"
                              className="grocery-list-item-delete"
                              onClick={(e) => handleDeleteItem(item, e)}
                              aria-label="Delete"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {adding ? (
                    <div className="grocery-lists-add-row">
                      <input
                        type="text"
                        className="grocery-lists-add-input"
                        placeholder="Item or section title…"
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddItemSubmit()
                          if (e.key === 'Escape') setAdding(false)
                        }}
                        autoFocus
                      />
                      <label className="grocery-lists-add-section">
                        <input
                          type="checkbox"
                          checked={newIsSection}
                          onChange={(e) => setNewIsSection(e.target.checked)}
                        />
                        Section header
                      </label>
                      <button type="button" className="grocery-lists-add-btn" onClick={handleAddItemSubmit}>
                        Add
                      </button>
                      <button type="button" className="grocery-lists-add-cancel" onClick={() => setAdding(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="grocery-lists-add-placeholder"
                      onClick={handleAddItemClick}
                    >
                      Click to add item
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
