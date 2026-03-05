import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="app-footer" role="contentinfo">
      <Link to="/privacy">Privacy</Link>
    </footer>
  )
}
