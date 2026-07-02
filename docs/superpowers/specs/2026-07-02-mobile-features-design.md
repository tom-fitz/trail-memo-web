# TrailMemo Web — iOS Mobile Feature Parity

**Date:** 2026-07-02
**Status:** Approved (approach #1: hybrid live transcription, editable everywhere)

## Goal

Bring the iOS app's mobile-specific functionality into the PWA so it can replace the iOS app:

1. **Voice recording with live transcription** in the create-memo flow (MediaRecorder + Web Speech API), uploading real audio.
2. **Create a memo at the user's GPS location** (Geolocation API, with accuracy), alongside the existing click-the-map flow.
3. **Show the user's location on the map** (blue dot + center-on-me).
4. **Audio playback** in the memo detail modal (play/pause, scrubber, ±15s skip).

Both create entry points (map click and "at my location") use the same modal, which offers recording in either case.

## Key decisions

- **Transcription is best-effort, text always editable.** When the browser supports Web Speech (`webkitSpeechRecognition`: Chrome, Safari), the live transcript fills the memo text field while recording, mirroring iOS. Where unsupported (Firefox), recording still works and the user types the text. Submission requires text (API requirement), never requires a transcript.
- **Live transcript overwrites the text field during recording**; after stopping, the field is freely editable. (iOS behaves the same — transcript is the source.)
- **Recording is optional everywhere.** The typed-text-only path (with the existing silent-audio placeholder) remains the universal fallback and is unchanged.
- **Accuracy handling mirrors iOS loosely:** iOS discards fixes worse than 50 m; the web shows the accuracy (e.g. "±120 m") and lets the user decide, rather than blocking.
- **Playback hidden for placeholder audio:** memos with `duration_seconds <= 1` are web text-only memos with the silent placeholder file; the detail modal shows no player for them.
- **Audio format is per-browser:** first supported of `audio/mp4` (Safari → `.m4a`), `audio/webm;codecs=opus`, `audio/webm` (Chrome/Edge → `.webm`). The API stores/serves the file as-is; `<audio>` handles both formats on modern browsers.

## Components

### Hooks (`src/hooks/`)

**`useAudioRecorder.ts`** — wraps `getUserMedia` + `MediaRecorder`.
Returns `{ supported, state: 'idle'|'recording'|'stopped', start(), stop(): Promise<{blob, mimeType, durationSeconds}>, reset(), elapsedSeconds, audioLevel (0–1 via WebAudio AnalyserNode, ~10 Hz), error }`. Releases mic tracks and closes the AudioContext on stop/unmount.

**`useSpeechRecognition.ts`** — wraps `SpeechRecognition`/`webkitSpeechRecognition` (minimal TS declarations included; not in DOM lib).
Returns `{ supported, isListening, transcript, start(), stop(), reset() }`. `continuous` + `interimResults`; accumulates finalized segments plus current interim; auto-restarts on premature `end` while active (Chrome stops on silence).

**`useGeolocation.ts`** — wraps `navigator.geolocation.getCurrentPosition`.
Returns `{ supported, locate(): Promise<{lat, lng, accuracy}>, isLocating, error }`. High accuracy, 15 s timeout, 30 s maximumAge.

### UI

**`src/components/memos/AudioRecorder.tsx`** — self-contained recording section used inside the create modal. Owns the recorder + speech hooks. States: idle (record button) → recording (pulsing dot, mm:ss timer, level bars, stop button) → stopped (duration + re-record/discard). Props: `onTranscriptChange(text)` (live), `onRecordingChange(rec: {blob, mimeType, durationSeconds} | null)`. Unsupported-browser and permission-denied cases render inline notices; never blocks the form.

**`CreateMemoModal.tsx` (modified)** — gains the `AudioRecorder` section above the text area; location line shows accuracy when present. `onSubmit` payload gains optional `audio: {blob, mimeType, durationSeconds}`.

**`src/components/memos/AudioPlayer.tsx`** — custom controls over a hidden `<audio>`: play/pause, seek slider, current/total time, −15 s/+15 s. Props `{ src, durationSeconds }`. Load errors render a small inline message.

**`MemoDetailModal.tsx` (modified)** — renders `AudioPlayer` under the memo card when `memo.audio_url` exists and `memo.duration_seconds > 1`.

**`MapView.tsx` (modified)** — adds react-map-gl `GeolocateControl` (top-right, `trackUserLocation`) for the blue dot + center-on-me.

**`MapPage.tsx` (modified)** — adds a "Memo Here" header button beside "New Memo": calls `locate()`, opens the create modal with the GPS position (lat/lng/accuracy). Geolocation errors surface in the existing banner pattern. `handleCreateMemo` forwards accuracy and audio to the API layer.

### API layer

**`memos.ts` (modified)** — `CreateMemoData` gains `accuracy?`, `audio?: Blob`, `audioMimeType?`, `durationSeconds?`. `create()` appends the real recording (filename `memo.m4a`/`memo.webm` by MIME, real `duration_seconds`, `location_accuracy` when present) and falls back to the existing silent placeholder when no recording was made. No backend changes; iOS already uploads this exact multipart shape.

## Error handling

- Mic denied / MediaRecorder missing → inline notice in the recorder section; typed flow unaffected.
- Speech unsupported → recording UI shows "transcription isn't supported in this browser — type your memo below".
- Geolocation denied/timeout → error banner; map-click flow unaffected.
- Audio playback failure → inline "Unable to load audio" in the player.
- All device APIs require HTTPS (or localhost) — already true for the PWA.

## Out of scope

- Server-side transcription; offline recording queue; waveform rendered from real audio data (bars are level-driven like iOS); park-name auto-detection from coordinates; RegisterView parity (already exists).

## Testing

Owner verifies locally (no automated suite in repo): record+transcribe in Chrome, record-without-transcript in Firefox, typed-only flow, GPS create outdoors vs. denied permission, playback of an iOS-created memo and absence of player on text-only memos, blue-dot control.
