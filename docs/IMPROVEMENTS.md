# TrailMemo — Improvement Backlog

Assessment from 2026-07-02 code review (all three repos). Ordered by priority within each section.

## Fix

1. **Audio files are publicly accessible.** API stores plain `https://storage.googleapis.com/<bucket>/<file>` URLs, requiring a public bucket. Voice recordings + GPS = privacy issue. Switch to signed URLs or Firebase download tokens generated at fetch time.
2. **Remove the silent-audio hack.** The API treats audio as optional (placeholder URL when absent) but the web uploads a fake base64 "silent m4a". Frontend should omit the audio field for text memos; make `audio_url` nullable in the DB instead of storing `https://placeholder.com/audio.m4a`.
3. **No password reset flow.** ~~Add Firebase `sendPasswordResetEmail` + "forgot password" link.~~ Superseded by Google-SSO-only login (2026-07-02).
4. **Stale team data.** React Query `staleTime: 5min`, `refetchOnWindowFocus: false` — coworkers' memos take up to 5 min to appear. Refetch on focus/visibility, shorten stale time.
5. **Makefile migrate bug** (trail-memo-api): `migrate` target reads JDBC-format `DATABASE_PUBLIC_URL` instead of the psql-compatible `DATABASE_URL`. Swap the variable.
6. **Debug logging in production paths.** axios interceptor logs every memo response; `useMemos`/`MapPage` log every render; create flow logs payloads. Strip them.

## Add

7. **Offline capture (highest value).** Queue memos/recordings in IndexedDB when offline, sync on reconnect. Service worker (`src/sw.ts`) already structured for it. The app's core use case is places without signal.
8. **Wire up unused backend features.** `/memos/search` and `/memos/nearby` have no frontend; add search box + "near me" filter. `PUT /memos/:id` only used for location — add memo text editing.
9. **Auto-fill park name** via Mapbox reverse geocoding from the pin coordinates.
10. **Marker clustering** (Mapbox clusters) before memo count makes the map unreadable.
11. **Tests + CI.** Zero automated tests in any repo; add a GitHub Action with lint + `tsc --noEmit` + `go test` as a floor.

12. **Run migrations on deploy.** Code ships to Railway automatically but schema changes are manual (bit us 2026-07-02: deployed SSO code before migration 004 existed in prod → `column "is_admin" does not exist`). Run migrations at API startup or as a Railway pre-deploy step; fix the `make migrate` `DATABASE_PUBLIC_URL`/JDBC variable bug at the same time.

## Honorable mentions

- Marker `lighterColor` trick assumes HSL-string user colors; silently no-ops otherwise.
- MediaRecorder + live speech recognition sharing the iOS Safari mic is known-flaky; degradation path exists, needs a real-device test.
- Push notifications (planned future; SW hooks in place).
