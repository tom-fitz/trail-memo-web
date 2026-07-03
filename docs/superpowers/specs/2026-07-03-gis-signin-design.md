# Google Sign-In via GIS + signInWithCredential

**Date:** 2026-07-03
**Status:** Approved (option 1 from the storage-partitioning diagnosis)

## Problem

`signInWithPopup` relies on Firebase's cross-origin auth handler (`trail-memo.firebaseapp.com/__/auth/handler`). iOS Safari's storage partitioning breaks it ("missing initial state"), and the installed home-screen PWA hangs forever (popup can't message back). Works on desktop/localhost only.

## Fix

Obtain the Google ID token in the same window using Google Identity Services (GIS), then `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` — no cross-origin handler, no popup messaging. Standard pattern for PWAs.

## Changes (trail-memo-web only)

- **`src/lib/auth/googleIdentity.ts`** (new): loads `https://accounts.google.com/gsi/client` once (with minimal TS typings for `google.accounts.id`), exposes `renderGoogleSignInButton(container, onIdToken)` which initializes GIS with `VITE_GOOGLE_CLIENT_ID` and renders the official Google button; each completed sign-in invokes `onIdToken(response.credential)`.
- **`AuthContext`**: `loginWithGoogle()` becomes `loginWithGoogleIdToken(idToken)` — swaps `signInWithPopup` for `signInWithCredential`; the getMe → register-on-404 → NOT_APPROVED handling is unchanged.
- **`LoginPage`**: custom Google button replaced by the GIS-rendered button (mounted via ref + one-time effect; latest-handler ref avoids re-init). Post-credential exchange shows a "Signing you in…" state. GIS script-load failure shows an inline error. Popup-specific error branches removed; NOT_APPROVED and detailed fallback messages stay.
- **Env**: new `VITE_GOOGLE_CLIENT_ID` (Web client ID) in `vite-env.d.ts` + `.env.example`.

## Manual steps (owner)

1. Firebase console → Authentication → Sign-in method → Google → Web SDK configuration → copy the **Web client ID**; set `VITE_GOOGLE_CLIENT_ID` locally and in the hosted env; redeploy.
2. GCP console → APIs & Services → Credentials → that OAuth web client → **Authorized JavaScript origins**: add `http://localhost:5173` and the hosted app origin.

## Out of scope

One Tap prompt, FedCM tuning, removing the now-unused popup helpers beyond the touched files.

## Testing

Owner: sign-in on desktop, phone Safari, and the installed home-screen app (the failing case); unapproved account still gets the contact-admin message.
