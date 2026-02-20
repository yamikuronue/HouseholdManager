import React from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/dashboard" className="layout-logo">
          HouseholdManager
        </Link>
        <nav className="layout-nav">
          {user && (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <span className="layout-user">{user.display_name || user.email}</span>
              <button type="button" className="layout-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
