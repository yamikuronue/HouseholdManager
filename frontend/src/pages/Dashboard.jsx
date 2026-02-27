import React from 'react'
import CalendarWidget from '../components/CalendarWidget'
import './Dashboard.css'

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <section className="dashboard-section dashboard-calendar">
        <h2>Calendar</h2>
        <CalendarWidget />
      </section>
    </div>
  )
}
