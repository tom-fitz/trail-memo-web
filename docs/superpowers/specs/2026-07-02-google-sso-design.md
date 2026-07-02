# TrailMemo — Google SSO with Admin Allowlist

**Date:** 2026-07-02
**Status:** Approved (admin page in app; fresh start — no migration of existing beta accounts)

## Goal

Replace email/password auth with Google SSO only, gated by an admin-controlled allowlist:

- Approved users click "Continue with Google" and go through normal SSO; first sign-in auto-creates their backend account (name from Google profile).
- Unapproved users complete Google SSO but are rejected by the backend with a "contact your administrator" message and signed out.
- Admins manage the approved list from a page in the web app.

App is in beta: existing email/password accounts are not migrated. Enforcement lives in the API (frontend checks alone are bypassable).

## Backend (trail-memo-api)

**Migration `004_google_sso.sql`:** `approved_users` table (`email` varchar PK — stored lowercase, `added_by`, `created_at`), plus `users.is_admin boolean NOT NULL DEFAULT FALSE`. Idempotent (`IF NOT EXISTS`). Bootstrap is manual and documented in the migration comments: insert the first admin's email into `approved_users`, sign in once, then `UPDATE users SET is_admin = TRUE WHERE email = ...`.

**`ApprovedUserRepository`** (new): `IsApproved(email)` (case-insensitive), `List()` (LEFT JOIN `users` to report which approved emails have registered, with display name), `Add(email, addedBy)` (lowercased, `ON CONFLICT DO NOTHING` — idempotent), `Remove(email)`.

**`AuthHandler` changes:** `Register` checks `IsApproved(firebaseUser.Email)` after fetching the Firebase user; rejects with `403 {code: NOT_APPROVED}` before creating anything. `GetMe` also returns `403 NOT_APPROVED` when the user's email is no longer on the list — removal locks a user out at their next app launch, not just at registration. Handler constructor gains the approved repo.

**`AdminMiddleware`** (new): runs after `AuthMiddleware`; loads the user row and requires `is_admin`, else `403 {code: FORBIDDEN}`.

**Admin routes** under `/api/v1/admin` (auth + admin middleware):
- `GET /admin/approved-users` → `{approved_users: [{email, added_by, created_at, registered, display_name}]}`
- `POST /admin/approved-users` `{email}` (validated as email) → 201
- `DELETE /admin/approved-users?email=<email>` → 204 (query param avoids `@`/`.` path-encoding pitfalls)

**`models.User`** gains `IsAdmin`; user repo SELECTs include it.

## Frontend (trail-memo-web)

**`AuthContext` rewrite:** exposes `{user, profile, isAdmin, loading, loginWithGoogle, logout}`. `loginWithGoogle` runs `signInWithPopup(GoogleAuthProvider)`, then `GET /auth/me`; on 404 it calls `register` with `display_name` from the Google profile (email prefix fallback). A `NOT_APPROVED` response from either call signs the user out and throws `NotApprovedError` for the login page. On app startup with an existing session, the profile is fetched once; failure (stale/unapproved/removed) signs out. A ref guards against the startup fetch racing the login flow. Unapproved Firebase accounts are left orphaned (harmless — no backend row, every API call rejected).

**`LoginPage` rewrite:** mic branding stays; the form is replaced by a "Continue with Google" button (inline Google G logo). Not-approved shows: "Your Google account isn't on the approved list. Contact your administrator for access." Popup-closed/blocked and network errors get friendly messages.

**`RegisterPage` deleted;** `/register` redirects to `/login`.

**`AdminPage` (new, `/admin`):** behind `ProtectedRoute` plus an in-page `isAdmin` gate (redirects home otherwise). Lists approved emails (with registered status/name), add-by-email form, per-row remove with inline confirm. Mobile-friendly; back link to the map. React-query with an `adminApi` module.

**MapPage header:** a Users icon button, rendered only for admins, navigates to `/admin`.

**`types/user.ts`:** `User` gains `is_admin: boolean`.

## Manual steps (owner, Firebase console + DB)

1. Enable the **Google** sign-in provider (Authentication → Sign-in method). Production domain must be in Authorized domains.
2. After rollout, disable the **Email/Password** provider (also ends iOS app logins — intended).
3. Bootstrap: `INSERT INTO approved_users (email) VALUES ('<your-google-email>');` then after first sign-in `UPDATE users SET is_admin = TRUE WHERE email = '<your-google-email>';`

## Error handling

- Unapproved at register or at `GetMe` → 403 `NOT_APPROVED` → frontend signs out + message.
- Non-admin hitting `/admin/*` → 403 `FORBIDDEN`; frontend hides the entry point and redirects.
- Popup closed by user → quiet no-op message ("Sign-in was cancelled").
- Emails normalized to lowercase on both write and check.

## Out of scope

Firebase blocking functions, deleting orphaned Firebase accounts, roles beyond a single admin flag, iOS app changes, email invitations/notifications.

## Testing

Owner verifies: approved email signs in and lands on the map with a created profile; unapproved email gets the contact-admin message and no session; admin sees the Users button, adds/removes emails; removed registered user is signed out on next launch; non-admin gets no button and `/admin` redirects; `/register` redirects.
