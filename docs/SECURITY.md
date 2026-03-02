# Security Audit & Recommendations

Assessment of the Household Manager app against modern security practices (OWASP, CWE, and common deployment guidance).

---

## What’s in good shape

| Area | Status |
|------|--------|
| **Secrets** | `SECRET_KEY`, Google client secret, DB URL, and mail keys come from environment variables; no hardcoded secrets. Production validation warns if `SECRET_KEY` is missing or default. |
| **SQL injection** | SQLAlchemy ORM and parameterized queries used throughout; risk is low. |
| **Input validation** | FastAPI + Pydantic validate request bodies and types. |
| **Auth algorithm** | JWT with HS256 and server-side secret; expiration (e.g. 1 week) is set. |
| **CORS** | Allow list uses `FRONTEND_URL` and specific localhost origins; no wildcard `*` for credentials. |
| **Sensitive data in responses** | `/api/auth/me` does not return tokens; user schema excludes refresh/access tokens. |
| **Invite tokens** | Invitation tokens generated with `secrets.token_urlsafe(32)`. |
| **Destructive actions** | Delete household restricted to owner; delete member restricted to owners. |

---

## Gaps and risks (before fixes)

1. **Unprotected API routes**  
   Many routes did not require authentication or authorization:
   - **Households**: list, create, get, update were unauthenticated; anyone could list/change any household.
   - **Members**: list, create, get, update were unauthenticated; anyone could add/change members.
   - **Invitations**: list, create, resend, delete were unauthenticated; only accept and get-by-token had some checks.
   - **Calendars**: list, create, get, update, delete were unauthenticated; anyone could manage any calendar.

2. **JWT in URL**  
   After OAuth, the app redirects to `.../login/callback?token=<jwt>`. Query strings are logged and can leak (history, Referer). Prefer a one-time code in the URL and exchange it for a token via a server-side or backend-for-frontend call.

3. **Token storage**  
   JWT is stored in `localStorage`. If the site is vulnerable to XSS, the token can be stolen. HttpOnly cookies (with Secure, SameSite) are a stronger option for session tokens.

4. **Secure headers**  
   No `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, or similar. Adding security headers (e.g. via middleware) is recommended.

5. **Rate limiting**  
   No rate limiting on login, callback, or API. Allows brute force and abuse; recommend throttling per IP and per user on auth and sensitive endpoints.

6. **OAuth state / PKCE**  
   No `state` (CSRF) or PKCE in the Google OAuth flow. State is recommended to tie the callback to the same browser session; PKCE is recommended for public clients.

7. **Refresh token storage**  
   DB comment says “Store encrypted in production” for refresh tokens; implementation does not encrypt them at rest. Encrypting sensitive tokens in the DB is recommended.

---

## Fixes applied in codebase

- **API authorization**: Household, member, invitation, and calendar routes now require `get_current_user` and scope data to the current user:
  - **Households**: List/get/update only for households the user is a member of; create allowed for any authenticated user.
  - **Members**: List/get only for households the user is in; create only for self (e.g. when creating a new household); update/delete with existing owner/self rules.
  - **Invitations**: List/create/resend/delete only for households the user is in (and create only as the inviter); accept only for self (`user_id == current_user.id`).
  - **Calendars**: List only for households the user is in; create only for the current user’s member; get/update/delete only for the current user’s own calendars.

---

## Implemented (next steps 1–5)

1. **JWT no longer in URL**: OAuth callback redirects with a one-time `?code=`. Frontend calls `POST /api/auth/exchange` with the code; backend sets an **HttpOnly, Secure, SameSite=Lax** cookie with the JWT and returns 204. Token is never in the URL or in JS.
2. **Token storage**: Session is stored only in the **HttpOnly cookie**; frontend uses `withCredentials: true` and does not read or store the token. `POST /api/auth/logout` clears the cookie.
3. **Secure headers**: Middleware sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a **Content-Security-Policy** allowing `self`, Google OAuth/APIs, and Mailjet.
4. **Rate limiting**: Only `/api/auth/*` is rate-limited (in-memory: 20 requests per 60 seconds per IP). Returns 429 when exceeded.
5. **OAuth state + PKCE**: Initiate sets `oauth_state` and `oauth_verifier` cookies; redirect includes `state` and `code_challenge` (S256). Callback verifies `state` and sends `code_verifier` when exchanging the code with Google.
6. **Encryption at rest**: When `ENCRYPTION_KEY` (Fernet key) is set, **refresh_token** and **access_token** are encrypted before saving to the DB and decrypted when read. Set in production: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

### Rotating the encryption key

- **Without rotation support:** If you change `ENCRYPTION_KEY` and do nothing else, existing encrypted tokens in the DB can no longer be decrypted. Users will see "Sign out and sign in again" for calendar/refresh until they re-authenticate with Google; after that, new tokens are stored with the new key.
- **With rotation (recommended):** Set `ENCRYPTION_KEY_PREVIOUS` to the **old** key and `ENCRYPTION_KEY` to the **new** key. Deploy. Decrypt tries the current key first, then the previous key, so existing tokens keep working. New logins and refreshed tokens are encrypted with the new key. After enough time (e.g. all active users have refreshed or you’re comfortable), remove `ENCRYPTION_KEY_PREVIOUS` and redeploy.

## Recommended next steps

- **Dependency scanning**: Run `pip audit` and `npm audit` in CI and fix high/critical issues.

---

## Testing security

- Run authenticated and unauthenticated requests against each API route; confirm 401/403 where expected.
- Verify that users cannot read or modify other users’ households, members, invitations, or calendars.
- Use OWASP ZAP or similar for baseline scans and fix reported issues.
