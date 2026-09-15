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
import ConfirmDeleteButton from './ConfirmDeleteButton'
import AppDialog from './AppDialog'
import usePointerDrag, { persistReorder } from '../hooks/usePointerDrag'
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
  const [listDialog, setListDialog] = useState(null)
  const [clearingChecked, setClearingChecked] = useState(false)

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

  const applyReorder = useCallback(
    async (fromIndex, toId) => {
      const toIndex = Number(toId)
      setError('')
      try {
        const reordered = await persistReorder(items, fromIndex, toIndex, updateGroceryListItem)
        setItems(reordered)
      } catch (err) {
        setError(err.response?.data?.detail || err.message)
        loadItems()
      }
    },
    [items, loadItems]
  )

  const { activeId, overId, bindHandle } = usePointerDrag(applyReorder)

  // Move focus to the active tab when it changes (e.g. after Arrow key navigation)
  useEffect(() => {
    if (activeListId) {
      const tabEl = document.getElementById(`grocery-tab-${activeListId}`)
      if (tabEl && document.activeElement?.closest?.('.grocery-lists-tabs')) {
        tabEl.focus()
      }
    }
  }, [activeListId])

  const handleAddList = () => {
    if (!householdId) return
    setListDialog({ type: 'prompt' })
  }

  const submitNewList = async (name) => {
    const trimmed = (name || '').trim()
    setListDialog(null)
    if (!trimmed || !householdId) return
    setError('')
    try {
      const created = await createGroceryList({ household_id: householdId, name: trimmed })
      setLists((prev) => [...prev, created])
      setActiveListId(created.id)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteList = (listId, e) => {
    e.stopPropagation()
    if (lists.length <= 1) return
    setListDialog({ type: 'confirm-delete', listId })
  }

  const confirmDeleteList = async () => {
    const listId = listDialog?.listId
    setListDialog(null)
    if (!listId) return
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

  const handleDeleteItem = async (item) => {
    setError('')
    try {
      await deleteGroceryListItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleToggleItem = async (item) => {
    if (item.is_section_header) return
    setError('')
    try {
      await updateGroceryListItem(item.id, { is_checked: !item.is_checked })
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_checked: !item.is_checked } : i))
      )
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  const handleDeleteCrossedOut = async () => {
    const toRemove = items.filter((i) => !i.is_section_header && i.is_checked)
    if (toRemove.length === 0) {
      setError('No crossed-out items to remove.')
      return
    }
    setError('')
    setClearingChecked(true)
    try {
      await Promise.all(toRemove.map((i) => deleteGroceryListItem(i.id)))
      setItems((prev) => prev.filter((i) => i.is_section_header || !i.is_checked))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      loadItems()
    } finally {
      setClearingChecked(false)
    }
  }

  const canDeleteList = lists.length > 1
  const hasCrossedOutItems = items.some((i) => !i.is_section_header && i.is_checked)

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
          <div className="grocery-lists-tabs" role="tablist" aria-label="Grocery lists">
            {lists.map((list, index) => (
              <div
                key={list.id}
                id={`grocery-tab-${list.id}`}
                role="tab"
                aria-selected={activeListId === list.id}
                aria-controls={`grocery-tabpanel-${list.id}`}
                tabIndex={activeListId === list.id ? 0 : -1}
                className={`grocery-lists-tab ${activeListId === list.id ? 'grocery-lists-tab-active' : ''}`}
                onClick={() => setActiveListId(list.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    const prev = index > 0 ? lists[index - 1] : lists[lists.length - 1]
                    if (prev) setActiveListId(prev.id)
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    const next = index < lists.length - 1 ? lists[index + 1] : lists[0]
                    if (next) setActiveListId(next.id)
                  } else if (e.key === 'Home') {
                    e.preventDefault()
                    if (lists[0]) setActiveListId(lists[0].id)
                  } else if (e.key === 'End') {
                    e.preventDefault()
                    if (lists.length) setActiveListId(lists[lists.length - 1].id)
                  }
                }}
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
            <div
              id={`grocery-tabpanel-${activeListId}`}
              role="tabpanel"
              aria-labelledby={`grocery-tab-${activeListId}`}
              className="grocery-lists-panel"
            >
              {loading ? (
                <p className="grocery-lists-muted">Loading…</p>
              ) : (
                <>
                  <ul className="grocery-lists-items">
                    {items.map((item, index) => (
                      <li
                        key={item.id}
                        data-drop-id={String(index)}
                        className={`grocery-list-item ${item.is_section_header ? 'grocery-list-item-section' : ''} ${!item.is_section_header && item.is_checked ? 'grocery-list-item-checked' : ''} ${activeId === String(index) ? 'grocery-list-item-dragging' : ''} ${overId === String(index) && activeId && activeId !== String(index) ? 'grocery-list-item-drop-target' : ''}`}
                      >
                        <span
                          className="grocery-list-item-drag-handle"
                          {...bindHandle(index, index)}
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
                            <ConfirmDeleteButton
                              className="grocery-list-item-delete"
                              idleLabel="Delete section"
                              idleTitle="Remove section"
                              onConfirm={() => handleDeleteItem(item)}
                            />
                          </>
                        ) : (
                          <>
                            <span
                              className="grocery-list-item-stripe"
                              style={{ backgroundColor: item.member_color || '#888' }}
                              title={item.member_display_name || ''}
                              aria-hidden
                            />
                            <button
                              type="button"
                              className="grocery-list-item-check"
                              onClick={() => handleToggleItem(item)}
                              aria-label={item.is_checked ? 'Mark not done' : 'Cross out'}
                            >
                              {item.is_checked ? '✓' : ''}
                            </button>
                            <span
                              className="grocery-list-item-label"
                              onClick={() => handleToggleItem(item)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleToggleItem(item)
                                }
                              }}
                            >
                              {item.content || 'New item'}
                            </span>
                            <ConfirmDeleteButton
                              className="grocery-list-item-delete"
                              idleLabel="Delete"
                              idleTitle="Remove item"
                              onConfirm={() => handleDeleteItem(item)}
                            />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {hasCrossedOutItems && (
                    <div className="grocery-lists-clear-checked-wrap">
                      <button
                        type="button"
                        className="grocery-lists-clear-checked"
                        onClick={handleDeleteCrossedOut}
                        disabled={clearingChecked}
                      >
                        {clearingChecked ? 'Deleting…' : `Delete crossed-out items (${items.filter((i) => !i.is_section_header && i.is_checked).length})`}
                      </button>
                    </div>
                  )}
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
      <AppDialog
        open={listDialog?.type === 'prompt'}
        title="New grocery list"
        message="Store or list name (e.g. Costco)"
        prompt
        promptLabel="List name"
        confirmLabel="Add"
        onCancel={() => setListDialog(null)}
        onConfirm={submitNewList}
      />
      <AppDialog
        open={listDialog?.type === 'confirm-delete'}
        title="Remove grocery list"
        message="Remove this list and all its items?"
        confirmLabel="Remove"
        danger
        onCancel={() => setListDialog(null)}
        onConfirm={confirmDeleteList}
      />
    </div>
  )
}
