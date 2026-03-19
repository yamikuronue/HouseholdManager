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
        <p className="privacy-updated"><strong>Last updated:</strong> March 13, 2026</p>

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
            <li><strong>Account information</strong> (e.g. email, Google profile fields) — so you can sign in and manage your account.</li>
            <li><strong>Data you create</strong> (e.g. calendars, events, grocery lists) — so the app can store and show it to you.</li>
          </ul>
          <p>
            This data is stored securely and is not sold or shared with third parties.
          </p>
        </section>

        <section>
          <h3>Sensitive data protection (Google user data and tokens)</h3>
          <p>
            When you sign in with Google, we receive and store some data that can be considered sensitive, including:
          </p>
          <ul>
            <li>
              Your Google profile information used by the app (e.g. Google account id, email, display name, avatar URL).
            </li>
            <li>
              <strong>Google OAuth tokens</strong> used to access Google Calendar on your behalf (an access token and, when provided, a refresh token).
            </li>
          </ul>
          <p>We protect this sensitive data with the following mechanisms:</p>
          <ul>
            <li><strong>Encryption in transit:</strong> all traffic to and from our service uses HTTPS (TLS).</li>
            <li>
              <strong>Encryption at rest for OAuth tokens:</strong> when <code>ENCRYPTION_KEY</code> is configured in the server environment,
              we encrypt OAuth tokens before storing them in our database (including the stored <code>refresh_token</code> and <code>access_token</code>).
            </li>
            <li>
              <strong>Key rotation support:</strong> if <code>ENCRYPTION_KEY_PREVIOUS</code> is set, the service can decrypt tokens encrypted with an older key while encrypting new tokens with the current key.
            </li>
            <li><strong>Server-side access controls:</strong> OAuth tokens are stored and used on the server; the frontend does not receive Google OAuth tokens directly.</li>
          </ul>
        </section>

        <section>
          <h3>Retention and deletion of Google user data</h3>
          <p>We retain Google user data only as long as needed to provide HouseholdManager functionality:</p>
          <ul>
            <li><strong>Google profile information</strong> is retained while your HouseholdManager account exists.</li>
            <li><strong>Google OAuth tokens</strong> (access token and refresh token when present) are retained to enable access to the Google Calendar APIs and to refresh access tokens when they expire.</li>
            <li><strong>Session and sign-in flow data</strong> is short-lived: our login/session token cookie is valid for up to <strong>7 days</strong>; OAuth <code>state</code> / PKCE verifier cookies are valid for up to <strong>10 minutes</strong>; one-time exchange codes are valid for up to <strong>2 minutes</strong>.</li>
          </ul>
          <p>
            If you want your Google user data deleted from our service, you can request deletion through the contact method provided in the app or on the project.
            After we verify the request, we will delete your stored HouseholdManager account record and associated Google data from our database (including stored OAuth tokens).
          </p>
          <p>
            Note: we may retain deleted data in backup or operational logs for a short period needed to manage systems and backups; we will not use that data for providing the service after deletion.
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
