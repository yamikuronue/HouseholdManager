# Privacy Policy

**Last updated:** March 13, 2026

## Your data stays yours

We built HouseholdManager to help you manage your household. We take your privacy seriously.

### We do not sell your data

**We will never sell your personal data.** Not to advertisers, not to data brokers, not to anyone.

### We do not share your data with third parties

**We do not give your data to anyone else.** We don’t share it for marketing, analytics, or any other purpose. Your information is used only to run this app and provide the services you use.

### What we collect and why

We collect only what’s needed to run the app and keep your account secure, such as:

- **Account information** (e.g. email, Google profile fields) — so you can sign in and manage your account.
- **Data you create** (e.g. calendars, events, grocery lists) — so the app can store and show it to you.

### Sensitive data protection (Google user data and tokens)

When you sign in with Google, we receive and store some data that can be considered sensitive, including:

- Your Google profile information used by the app (e.g. Google account id, email, display name, avatar URL).
- **Google OAuth tokens** used to access Google Calendar on your behalf (an access token and, when provided, a refresh token).

We protect this sensitive data with the following mechanisms:

1. **Encryption in transit**: all traffic to and from our service uses HTTPS (TLS).
2. **Encryption at rest for OAuth tokens**: when `ENCRYPTION_KEY` is configured in the server environment, we encrypt OAuth tokens before storing them in our database. This includes the stored `refresh_token` and `access_token`. Token encryption is implemented server-side and decryption happens only when the backend needs to call the Google APIs.
3. **Key rotation support**: if `ENCRYPTION_KEY_PREVIOUS` is set, the service can decrypt tokens encrypted with an older key while encrypting new tokens with the current key.

4. **Server-side access controls**: OAuth tokens are stored and used on the server. The frontend does not receive Google OAuth tokens directly.

### Retention and deletion of Google user data

We retain Google user data only as long as needed to provide HouseholdManager functionality:

1. **Google profile information** (id/email/display name/avatar) is retained while your HouseholdManager account exists.
2. **Google OAuth tokens** (access token and refresh token when present) are retained to enable access to the Google Calendar APIs and to refresh access tokens when they expire.
3. **Session and sign-in flow data** is short-lived:
   - Our login/session token cookie is valid for up to **7 days**.
   - OAuth `state` / PKCE verifier cookies are valid for up to **10 minutes**.
   - One-time exchange codes are valid for up to **2 minutes**.

If you want your Google user data deleted from our service, you can request deletion through the contact method provided in the app or on the project. After we verify the request, we will delete your stored HouseholdManager account record and associated Google data from our database (including stored OAuth tokens).

Note: we may retain deleted data in backup or operational logs for a short period needed to manage systems and backups; we will not use that data for providing the service after deletion.

### Changes to this policy

If we update this privacy policy, we’ll change the “Last updated” date above. We encourage you to check this page from time to time.

### Questions

If you have questions about your privacy or this policy, please reach out through the contact method provided in the app or on the project.

---

*Simple summary: we don’t sell your data and we don’t give it to anyone else.*
