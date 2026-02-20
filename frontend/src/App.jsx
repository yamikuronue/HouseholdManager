import React from 'react'
import CalendarWidget from './components/CalendarWidget'
import CalendarList from './components/CalendarList'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>HouseholdManager</h1>
        <CalendarList />
      </header>
      <main>
        <CalendarWidget />
      </main>
    </div>
  )
}

export default App
