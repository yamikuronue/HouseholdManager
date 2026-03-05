import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import './Privacy.css'

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy - Lionfish'
    return () => { document.title = 'Lionfish' }
  }, [])

  return (
    <div className="privacy-page">
      <main className="privacy-main">
        <Link to="/login" className="privacy-back">← Back to Lionfish</Link>
        <h1>Privacy Policy</h1>
        <p className="privacy-updated"><strong>Last updated:</strong> March 5, 2025</p>

        <section>
          <h2>Your data stays yours</h2>
          <p>
            We built HouseholdManager to help you manage your household. We take your privacy seriously.
          </p>
        </section>

        <section>
          <h3>We do not sell your data</h3>
          <p>
            <strong>We will never sell your personal data.</strong> Not to advertisers, not to data brokers, not to anyone.
          </p>
        </section>

        <section>
          <h3>We do not share your data with third parties</h3>
          <p>
            <strong>We do not give your data to anyone else.</strong> We don’t share it for marketing, analytics, or any other purpose. Your information is used only to run this app and provide the services you use.
          </p>
        </section>

        <section>
          <h3>What we collect and why</h3>
          <p>
            We collect only what’s needed to run the app and keep your account secure, such as:
          </p>
          <ul>
            <li><strong>Account information</strong> (e.g. email, username) — so you can sign in and manage your account.</li>
            <li><strong>Data you create</strong> (e.g. calendars, events, grocery lists) — so the app can store and show it to you.</li>
          </ul>
          <p>
            This data is stored securely and is not sold or shared with third parties.
          </p>
        </section>

        <section>
          <h3>Changes to this policy</h3>
          <p>
            If we update this privacy policy, we’ll change the “Last updated” date above. We encourage you to check this page from time to time.
          </p>
        </section>

        <section>
          <h3>Questions</h3>
          <p>
            If you have questions about your privacy or this policy, please reach out through the contact method provided in the app or on the project.
          </p>
        </section>

        <p className="privacy-summary">
          <em>Simple summary: we don’t sell your data and we don’t give it to anyone else.</em>
        </p>
      </main>
      <Footer />
    </div>
  )
}
