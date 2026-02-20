import React, { createContext, useContext, useEffect, useState } from 'react'
import { getAuthMe } from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await getAuthMe()
      setUser(data)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  const login = () => {
    window.location.href = getGoogleAuthUrl()
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const setToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token)
    loadUser()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setToken, loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
