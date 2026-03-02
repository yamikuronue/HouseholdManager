import React, { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="layout">
      <a href="#main-content" className="layout-skip-link">
        Skip to main content
      </a>
      <header className="layout-header">
        <Link to="/dashboard" className="layout-logo" onClick={closeMenu}>
          <img src="/logo.jpg" alt="Lionfish" className="layout-logo-img" />
          <span className="layout-logo-text">Lionfish</span>
        </Link>
        <button
          type="button"
          className="layout-hamburger"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="layout-hamburger-bar" />
          <span className="layout-hamburger-bar" />
          <span className="layout-hamburger-bar" />
        </button>
        <nav className={`layout-nav ${menuOpen ? 'layout-nav-open' : ''}`}>
          {user && (
            <>
              <Link to="/dashboard" onClick={closeMenu}>Dashboard</Link>
              <Link to="/settings" onClick={closeMenu}>Settings</Link>
              <span className="layout-user">{user.display_name || user.email}</span>
              <button type="button" className="layout-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>
      <main id="main-content" className="layout-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
