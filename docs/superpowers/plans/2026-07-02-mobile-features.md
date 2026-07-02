# iOS Mobile Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voice recording with live transcription, GPS memo creation, on-map user location, and audio playback in the trail-memo-web PWA.

**Architecture:** Three browser-API hooks (`useAudioRecorder`, `useSpeechRecognition`, `useGeolocation`) feeding two new components (`AudioRecorder` in the create modal, `AudioPlayer` in the detail modal). The API layer's `create()` uploads real audio when present, keeping the silent-placeholder fallback. Map gets react-map-gl's `GeolocateControl` and a "Memo Here" GPS entry point.

**Tech Stack:** MediaRecorder + WebAudio AnalyserNode, Web Speech API (`webkitSpeechRecognition`), Geolocation API, react-map-gl v7, existing axios/react-query/Tailwind stack.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-mobile-features-design.md`.
- **No git commits by the implementer** (owner handles git). **No app builds/dev-server runs** (owner tests); `npx tsc --noEmit` at the end is the only verification run.
- No automated test framework exists; do not add one. Per-task "Verify (owner)" notes replace test steps.
- Match existing style: `React.FC` components, named exports, `@/` path alias, Tailwind utilities, blue-600 primary.
- Text is always required for submission; recording never blocks the typed path.
- Before using any lucide icon, confirm the export exists: `grep -c '"<IconName>"' node_modules/lucide-react/dist/lucide-react.d.ts` (fallbacks: `CheckCircle` for `CheckCircle2`, `Crosshair` for `LocateFixed`).

---

### Task 1: `useAudioRecorder` hook

**Files:**
- Create: `src/hooks/useAudioRecorder.ts`

**Interfaces:**
- Produces: `useAudioRecorder(): { supported: boolean; state: 'idle'|'recording'|'stopped'; start(): Promise<void>; stop(): Promise<AudioRecording>; reset(): void; elapsedSeconds: number; audioLevel: number; error: string | null }` and `export interface AudioRecording { blob: Blob; mimeType: string; durationSeconds: number }`. Tasks 4, 6, 7 consume `AudioRecording`.

- [ ] **Step 1: Create the hook** (full file):

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioRecording {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

type RecorderState = 'idle' | 'recording' | 'stopped';

// Safari records AAC in an mp4 container; Chrome/Edge/Firefox record webm/opus
const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

const pickMimeType = (): string =>
  MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

export const useAudioRecorder = () => {
  const supported =
    typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    recorderRef.current = null;
    setAudioLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);

      // Level meter for the waveform, like the iOS averagePower loop
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);

      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      tickRef.current = window.setInterval(() => {
        setElapsedSeconds((Date.now() - startedAtRef.current) / 1000);
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample - 128) / 128);
        }
        setAudioLevel(peak);
      }, 100);

      setState('recording');
    } catch (err) {
      cleanup();
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Enable it in your browser settings to record.'
          : 'Could not start recording.'
      );
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<AudioRecording> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('Not recording'));
        return;
      }
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        setState('stopped');
        resolve({ blob, mimeType, durationSeconds });
      };
      recorder.stop();
    });
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setElapsedSeconds(0);
    setError(null);
  }, [cleanup]);

  return { supported, state, start, stop, reset, elapsedSeconds, audioLevel, error };
};
```

**Verify (owner):** covered by the create-flow test in Task 6.

---

### Task 2: `useSpeechRecognition` hook

**Files:**
- Create: `src/hooks/useSpeechRecognition.ts`

**Interfaces:**
- Produces: `useSpeechRecognition(): { supported: boolean; isListening: boolean; transcript: string; start(): void; stop(): void; reset(): void }`. Task 4 consumes it.

- [ ] **Step 1: Create the hook** (full file — includes minimal Web Speech typings since TS's DOM lib lacks them):

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API is not in TypeScript's DOM lib — minimal declarations.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const SpeechRecognitionImpl: SpeechRecognitionConstructor | undefined =
  (window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition ??
  (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
    .webkitSpeechRecognition;

export const useSpeechRecognition = () => {
  const supported = !!SpeechRecognitionImpl;
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const activeRef = useRef(false);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl || activeRef.current) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((finalTextRef.current + interim).trim());
    };
    recognition.onerror = () => {
      // e.g. 'no-speech' — onend fires next and restarts while active
    };
    recognition.onend = () => {
      // Chrome ends recognition after silence; keep it running while recording
      if (activeRef.current) {
        try {
          recognition.start();
        } catch {
          // already restarted
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    finalTextRef.current = '';
    setTranscript('');
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
    },
    []
  );

  return { supported, isListening, transcript, start, stop, reset };
};
```

**Verify (owner):** covered by the create-flow test in Task 6 (Chrome shows live words; Firefox shows the unsupported note).

---

### Task 3: `useGeolocation` hook

**Files:**
- Create: `src/hooks/useGeolocation.ts`

**Interfaces:**
- Produces: `useGeolocation(): { supported: boolean; locate(): Promise<GeoPosition>; isLocating: boolean; error: string | null }` and `export interface GeoPosition { lat: number; lng: number; accuracy: number }`. Task 7 consumes it.

- [ ] **Step 1: Create the hook** (full file):

```ts
import { useCallback, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export const useGeolocation = () => {
  const supported = 'geolocation' in navigator;
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback((): Promise<GeoPosition> => {
    setError(null);
    if (!('geolocation' in navigator)) {
      const message = 'Location is not supported by this browser.';
      setError(message);
      return Promise.reject(new Error(message));
    }
    setIsLocating(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          setIsLocating(false);
          const message =
            err.code === err.PERMISSION_DENIED
              ? 'Location access was denied. Enable it in your browser settings.'
              : 'Could not get your location. Try again.';
          setError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }, []);

  return { supported, locate, isLocating, error };
};
```

**Verify (owner):** covered by the "Memo Here" test in Task 7.

---

### Task 4: `AudioRecorder` component

**Files:**
- Create: `src/components/memos/AudioRecorder.tsx`

**Interfaces:**
- Consumes: `useAudioRecorder` (Task 1), `useSpeechRecognition` (Task 2).
- Produces: `AudioRecorder: React.FC<{ onTranscriptChange: (text: string) => void; onRecordingChange: (recording: AudioRecording | null) => void }>`. Task 6 consumes it.

- [ ] **Step 1: Confirm lucide exports** for `Mic`, `Square`, `RotateCcw`, `CheckCircle2` (see Global Constraints), adjust imports if needed.

- [ ] **Step 2: Create the component** (full file):

```tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mic, RotateCcw, Square } from 'lucide-react';
import { AudioRecording, useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface AudioRecorderProps {
  onTranscriptChange: (text: string) => void;
  onRecordingChange: (recording: AudioRecording | null) => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Static weights give the level bars an organic waveform shape
const LEVEL_BARS = [0.15, 0.4, 0.7, 1, 0.85, 0.55, 0.3, 0.65, 0.9, 0.45];

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptChange,
  onRecordingChange,
}) => {
  const recorder = useAudioRecorder();
  const speech = useSpeechRecognition();
  const [recording, setRecording] = useState<AudioRecording | null>(null);

  // Live transcript fills the memo text while recording (like iOS)
  useEffect(() => {
    if (recorder.state === 'recording' && speech.transcript) {
      onTranscriptChange(speech.transcript);
    }
  }, [speech.transcript, recorder.state, onTranscriptChange]);

  if (!recorder.supported) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        Voice recording isn't supported in this browser — type your memo below.
      </p>
    );
  }

  const handleStart = async () => {
    await recorder.start();
    if (speech.supported) {
      speech.start();
    }
  };

  const handleStop = async () => {
    speech.stop();
    try {
      const rec = await recorder.stop();
      setRecording(rec);
      onRecordingChange(rec);
    } catch {
      // stop() rejected because recording never started
    }
  };

  const handleDiscard = () => {
    setRecording(null);
    onRecordingChange(null);
    speech.reset();
    recorder.reset();
  };

  return (
    <div className="bg-gray-50 p-3 rounded-lg space-y-3">
      {recorder.state === 'idle' && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Mic className="w-4 h-4" />
          Record Voice Memo
        </button>
      )}

      {recorder.state === 'recording' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              Recording
            </div>
            <span className="font-mono text-lg">{formatDuration(recorder.elapsedSeconds)}</span>
          </div>
          <div className="flex items-end justify-center gap-1 h-10">
            {LEVEL_BARS.map((weight, i) => (
              <span
                key={i}
                className="w-2 bg-blue-600 rounded transition-all duration-100"
                style={{
                  height: `${Math.max(15, Math.min(100, recorder.audioLevel * weight * 160))}%`,
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            {speech.supported
              ? 'Listening — your words appear in the text box below'
              : "Live transcription isn't supported in this browser — type your memo below"}
          </p>
          <button
            type="button"
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        </>
      )}

      {recorder.state === 'stopped' && recording && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Recording ready ({formatDuration(recording.durationSeconds)})
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-record
          </button>
        </div>
      )}

      {recorder.error && <p className="text-sm text-red-600">{recorder.error}</p>}
    </div>
  );
};
```

**Verify (owner):** covered by the create-flow test in Task 6.

---

### Task 5: API layer — upload real audio

**Files:**
- Modify: `src/lib/api/memos.ts`

**Interfaces:**
- Produces: extended `CreateMemoData` with `accuracy?: number; audio?: Blob; audioMimeType?: string; durationSeconds?: number`. Tasks 6–7 rely on these exact field names.

- [ ] **Step 1: Extend `CreateMemoData`** (replace the existing interface):

```ts
export interface CreateMemoData {
  text: string;
  title?: string;
  park_name?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  audio?: Blob;
  audioMimeType?: string;
  durationSeconds?: number;
}
```

- [ ] **Step 2: Replace the body of `create()`** so a real recording is used when present (silent placeholder otherwise), keeping the same request shape iOS uses:

```ts
  // Create new memo (typed text, optionally with a voice recording)
  create: async (data: CreateMemoData): Promise<Memo> => {
    const hasRecording = !!data.audio;
    const audioBlob = data.audio ?? createSilentAudio();
    const filename = hasRecording
      ? data.audioMimeType?.includes('mp4')
        ? 'memo.m4a'
        : 'memo.webm'
      : 'memo.m4a';

    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    formData.append('text', data.text);
    formData.append(
      'duration_seconds',
      String(hasRecording ? data.durationSeconds ?? 1 : 1)
    );
    formData.append('latitude', data.latitude.toString());
    formData.append('longitude', data.longitude.toString());

    if (data.accuracy !== undefined) {
      formData.append('location_accuracy', data.accuracy.toString());
    }
    if (data.title) {
      formData.append('title', data.title);
    }
    if (data.park_name) {
      formData.append('park_name', data.park_name);
    }

    const response = await apiClient.post('/memos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
```

**Verify (owner):** create a recorded memo, confirm the network request carries the real audio file and duration; the created memo's `audio_url` plays back (Task 8's player).

---

### Task 6: Create modal — recording section + accuracy display

**Files:**
- Modify: `src/components/memos/CreateMemoModal.tsx`

**Interfaces:**
- Consumes: `AudioRecorder` (Task 4), `AudioRecording` (Task 1).
- Produces: prop changes Task 7 must match — `location: { lat: number; lng: number; accuracy?: number } | null`; `onSubmit(data: { text: string; title?: string; park_name?: string; audio?: AudioRecording }): Promise<void>`.

- [ ] **Step 1: Update imports and props:**

```tsx
import { AudioRecorder } from './AudioRecorder';
import { AudioRecording } from '@/hooks/useAudioRecorder';
```

```tsx
interface CreateMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number; accuracy?: number } | null;
  onSubmit: (data: {
    text: string;
    title?: string;
    park_name?: string;
    audio?: AudioRecording;
  }) => Promise<void>;
}
```

- [ ] **Step 2: Add recording state and wire it through submit/close.** Add alongside the existing state:

```tsx
const [recording, setRecording] = useState<AudioRecording | null>(null);
```

In `handleSubmit`, pass it and clear it on success (with the other resets):

```tsx
      await onSubmit({
        text: text.trim(),
        title: title.trim() || undefined,
        park_name: parkName.trim() || undefined,
        audio: recording ?? undefined,
      });

      // Reset form
      setText('');
      setTitle('');
      setParkName('');
      setRecording(null);
      onClose();
```

In `handleClose`, add `setRecording(null);` with the other resets.

- [ ] **Step 3: Render the recorder above the title field and show accuracy on the location line.** Location line becomes:

```tsx
        {location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <MapPin className="w-4 h-4" />
            <span>
              Location: {location.lat.toFixed(6)}°, {location.lng.toFixed(6)}°
              {location.accuracy !== undefined && ` (±${Math.round(location.accuracy)}m)`}
            </span>
          </div>
        )}
```

Directly below it, before the Title input:

```tsx
        {/* Voice recording (optional) — live transcript fills the text box */}
        <AudioRecorder
          onTranscriptChange={setText}
          onRecordingChange={setRecording}
        />
```

**Verify (owner):** Chrome — record, speak, watch words fill the text box live, stop, edit text, submit; memo uploads real audio. Firefox — recording works, note explains typing. Deny mic — inline error, typed flow still submits.

---

### Task 7: MapPage — "Memo Here" GPS entry point

**Files:**
- Modify: `src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: `useGeolocation`/`GeoPosition` (Task 3), modal props (Task 6), `CreateMemoData` fields (Task 5).
- Produces: nothing downstream.

- [ ] **Step 1: Confirm the `LocateFixed` lucide export** (fallback `Crosshair`), then update imports:

```tsx
import { LogOut, RefreshCw, Plus, Save, X, LocateFixed } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { AudioRecording } from '@/hooks/useAudioRecorder';
```

- [ ] **Step 2: Extend state and add the locate handler.** Change `newMemoLocation`'s type and add geolocation wiring:

```tsx
  const [newMemoLocation, setNewMemoLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const { locate, isLocating } = useGeolocation();
  const [geoError, setGeoError] = useState<string | null>(null);
```

```tsx
  const handleCreateAtMyLocation = async () => {
    setGeoError(null);
    setIsPlacementMode(false);
    try {
      const position = await locate();
      setNewMemoLocation(position);
      setIsCreateModalOpen(true);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Could not get your location.');
    }
  };
```

- [ ] **Step 3: Pass audio + accuracy through `handleCreateMemo`:**

```tsx
  const handleCreateMemo = async (data: {
    text: string;
    title?: string;
    park_name?: string;
    audio?: AudioRecording;
  }) => {
    if (!newMemoLocation) return;

    await createMemo({
      text: data.text,
      title: data.title,
      park_name: data.park_name,
      latitude: newMemoLocation.lat,
      longitude: newMemoLocation.lng,
      accuracy: newMemoLocation.accuracy,
      audio: data.audio?.blob,
      audioMimeType: data.audio?.mimeType,
      durationSeconds: data.audio?.durationSeconds,
    });

    setNewMemoLocation(null);
  };
```

- [ ] **Step 4: Add the "Memo Here" button** next to "New Memo" in the header center block:

```tsx
          <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              variant={isPlacementMode ? 'danger' : 'primary'}
              onClick={isPlacementMode ? handleCancelPlacement : handleStartPlacement}
              title={isPlacementMode ? 'Cancel placement' : 'Create new memo'}
              className="flex items-center whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>New Memo</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateAtMyLocation}
              disabled={isLocating}
              title="Create a memo at your current location"
              className="flex items-center whitespace-nowrap"
            >
              {isLocating ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <LocateFixed className="w-4 h-4 mr-2" />
                  <span>Memo Here</span>
                </>
              )}
            </Button>
          </div>
```

- [ ] **Step 5: Render the geolocation error banner** after the placement-mode indicator block:

```tsx
      {/* Geolocation error */}
      {geoError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <p className="text-sm font-medium">{geoError}</p>
          <button onClick={() => setGeoError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
```

**Verify (owner):** "Memo Here" prompts for location, opens the modal at your position with ±accuracy shown; denying shows the dismissible banner; map-click flow unchanged.

---

### Task 8: Map user location + audio playback

**Files:**
- Modify: `src/components/map/MapView.tsx`
- Create: `src/components/memos/AudioPlayer.tsx`
- Modify: `src/components/memos/MemoDetailModal.tsx`

**Interfaces:**
- Consumes: `Memo.audio_url`, `Memo.duration_seconds` (existing type).
- Produces: `AudioPlayer: React.FC<{ src: string; durationSeconds: number }>`.

- [ ] **Step 1: Add `GeolocateControl` to `MapView.tsx`.** Extend the react-map-gl import and render it with the other controls:

```tsx
import Map, { Marker, Popup, NavigationControl, ScaleControl, GeolocateControl } from 'react-map-gl';
```

```tsx
        {/* Map Controls */}
        <GeolocateControl
          position="top-right"
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation
          showUserHeading
        />
        <NavigationControl position="top-right" showCompass={true} />
```

- [ ] **Step 2: Confirm lucide exports** for `Play`, `Pause`, `RotateCcw`, `RotateCw`, then create `src/components/memos/AudioPlayer.tsx` (full file):

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  durationSeconds: number;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, durationSeconds }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onError = () => setError(true);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setError(true));
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(duration, time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  if (error) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        Unable to load audio for this memo.
      </p>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full accent-blue-600"
        aria-label="Seek"
      />
      <div className="flex justify-between text-xs text-gray-500 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => seek(currentTime - 15)}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          aria-label="Back 15 seconds"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-xs">15</span>
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => seek(currentTime + 15)}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          aria-label="Forward 15 seconds"
        >
          <span className="text-xs">15</span>
          <RotateCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Render the player in `MemoDetailModal.tsx`.** Import it and add below `<MemoCard memo={memo} />` (memos with `duration_seconds <= 1` are web text-only placeholders — no player):

```tsx
import { AudioPlayer } from './AudioPlayer';
```

```tsx
      <MemoCard memo={memo} />

      {/* Voice recording playback (hidden for text-only placeholder audio) */}
      {memo.audio_url && memo.duration_seconds > 1 && (
        <div className="mt-4">
          <AudioPlayer src={memo.audio_url} durationSeconds={memo.duration_seconds} />
        </div>
      )}
```

- [ ] **Step 4: Run `npx tsc --noEmit`** — expected: no output (clean).

**Verify (owner):** blue dot + center-on-me button on the map; an iOS-recorded (or newly web-recorded) memo shows the player and plays with seek/±15s; a text-only memo shows no player.
