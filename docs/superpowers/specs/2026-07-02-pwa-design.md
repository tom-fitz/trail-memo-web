# TrailMemo PWA Design

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## Goal

Turn trail-memo-web into an installable PWA so the iOS native app can be retired for this use case:

1. Users who haven't installed the app are prompted to add it to their home screen, with platform-appropriate instructions.
2. Deployed updates reach installed users automatically — silently in the background by default, with a one-tap reload offered to users who are mid-session. No manual re-download ever.

**Explicitly deferred (but designed for):** offline data/tiles, push notifications. The service worker structure chosen below makes both incremental additions later, not rewrites.

## Current state

Vite 5 + React 18 + TypeScript SPA, Tailwind, Firebase, Mapbox GL. Deployed via `serve -s dist` (SPA rewrite in `serve.json`). No manifest, no service worker, no app icons (only `vite.svg`).

## Approach

Use `vite-plugin-pwa` in **`injectManifest`** mode with a minimal custom service worker (`src/sw.ts`).

- Rejected: hand-rolled SW (update lifecycle is the easiest part to get wrong, and it's the part that matters most here).
- Rejected: `generateSW` mode (simplest today, but adding push notifications later would force a migration to `injectManifest` anyway; the custom SW is ~25 lines).

## Components

### 1. Manifest, icons, and HTML head

- Web app manifest via plugin config: name/short_name "TrailMemo", `display: standalone`, `start_url: /`, theme + background color matching the app.
- Icon set generated as placeholders (mountain/pin motif), swappable later: `pwa-192x192.png`, `pwa-512x512.png`, `pwa-512x512-maskable.png`, `apple-touch-icon.png` (180×180) in `public/`.
- `index.html` additions: `apple-touch-icon` link, `theme-color` meta, `apple-mobile-web-app-*` metas for iOS standalone chrome.

### 2. Service worker (`src/sw.ts`)

Minimal Workbox SW, structured for future growth:

- `precacheAndRoute(self.__WB_MANIFEST)` — precaches the hashed app shell (JS/CSS/HTML/icons).
- `cleanupOutdatedCaches()`.
- Navigation route falls back to precached `index.html` (SPA routing).
- `message` listener for `{type: 'SKIP_WAITING'}` — this is what powers the update toast.
- **Not cached (network-only by default):** Mapbox tile/API requests, Firebase/Firestore, any non-precached cross-origin request. No runtime caching routes at all in v1.
- Future hooks (comments only, no code): runtime caching routes here for offline; `push`/`notificationclick` listeners here for notifications.

### 3. Update flow (`src/components/pwa/UpdateToast.tsx`)

Registration via `useRegisterSW` from `virtual:pwa-register/react` (prompt-style lifecycle):

- New version downloads silently in the background whenever the app is open.
- If the user closes/backgrounds away and relaunches, the waiting worker activates automatically — next launch is the new version, zero UI.
- If the user is mid-session when the download completes, a small dismissible toast renders: "Update available — Reload". Tapping it messages SKIP_WAITING and reloads into the new version.
- Update checks: on registration, then every 60 minutes, plus on `visibilitychange` → visible (home-screen apps are often suspended, not closed).

### 4. Install prompt (`src/components/pwa/InstallPrompt.tsx`)

Rendered only when NOT already installed (`display-mode: standalone` media query and `navigator.standalone` both false):

- **iOS Safari** (no `beforeinstallprompt` exists): dismissible bottom banner with concrete steps — tap Share (icon drawn inline), then "Add to Home Screen" (icon inline).
- **Android/desktop Chrome:** capture `beforeinstallprompt`, show an "Install app" banner whose button fires the captured native prompt.
- Other browsers (e.g. iOS Chrome, Firefox): no banner.
- Dismissal stored in `localStorage` with a timestamp; re-offered after 30 days. Accepting install (or being in standalone mode) suppresses it permanently.

### 5. Mounting

Both components mount once in `App.tsx`, inside the router but outside routes (visible on all pages). Styled with existing Tailwind utilities to match `ui/` components.

### 6. Serving headers (`serve.json`)

Correct cache headers are what make updates actually flow:

- `sw.js`, `manifest.webmanifest`, `index.html` → `Cache-Control: no-cache` (always revalidate).
- `/assets/**` (content-hashed) → `Cache-Control: public, max-age=31536000, immutable`.

## Error handling

- SW registration failure (old browser, private mode): app works exactly as today; components render nothing.
- `beforeinstallprompt` never fires (already installed, unsupported): Android banner simply never shows.
- Update check failures are silent; the next scheduled check retries.

## Testing

Owner will run/build locally (dev server already running). Verification plan: `npm run build && npm start`, install locally, deploy a second build, confirm (a) mid-session toast appears and reload swaps versions, (b) close-and-relaunch activates silently. Lighthouse PWA audit as a sanity check. No automated test suite exists in the repo; none added.

## Out of scope

- Offline memo data / map tiles (future: runtime caching routes in `src/sw.ts`).
- Push notifications (future: `push` + `notificationclick` listeners in `src/sw.ts`, plus server-side sender).
- Real branding/icons (placeholders shipped, drop-in replaceable in `public/`).
- Git commits and deployment (owner handles).
