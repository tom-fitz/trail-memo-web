# GIS Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `signInWithPopup` with Google Identity Services + `signInWithCredential` so sign-in works in iOS Safari and the installed PWA.

**Architecture:** One new GIS loader module; `AuthContext.loginWithGoogle` → `loginWithGoogleIdToken(idToken)`; LoginPage renders the official GIS button. Backend untouched.

**Tech Stack:** GIS (`accounts.google.com/gsi/client`), firebase/auth `signInWithCredential`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-gis-signin-design.md`.
- No commits; verification is `npx tsc --noEmit`.
- `NOT_APPROVED` handling and messages unchanged.

---

### Task 1: GIS loader module + env plumbing

**Files:**
- Create: `src/lib/auth/googleIdentity.ts`
- Modify: `src/vite-env.d.ts` (add `VITE_GOOGLE_CLIENT_ID`)
- Modify: `.env.example` (document the new var)

**Interfaces:**
- Produces: `renderGoogleSignInButton(container: HTMLElement, onIdToken: (idToken: string) => void): Promise<void>` (rejects if the GIS script fails to load). Task 2/3 consume.

- [ ] **Step 1:** Create `src/lib/auth/googleIdentity.ts`:

```ts
// Google Identity Services (GIS) sign-in.
// Gets the Google ID token in the same window, avoiding Firebase's
// cross-origin auth handler, which breaks under iOS Safari storage
// partitioning and never returns inside installed PWAs.

interface CredentialResponse {
  credential: string;
}

interface GsiIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      width?: number;
    }
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GsiIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;

const loadGsiScript = (): Promise<void> => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Failed to load Google sign-in'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

// Renders the official Google button into `container`; every completed
// sign-in invokes onIdToken with the Google ID token (a JWT).
export const renderGoogleSignInButton = async (
  container: HTMLElement,
  onIdToken: (idToken: string) => void
): Promise<void> => {
  await loadGsiScript();
  const id = window.google?.accounts?.id;
  if (!id) {
    throw new Error('Google sign-in unavailable');
  }
  id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: (response) => onIdToken(response.credential),
  });
  id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 280,
  });
};
```

- [ ] **Step 2:** `src/vite-env.d.ts`: add `readonly VITE_GOOGLE_CLIENT_ID: string` after the Firebase vars.
- [ ] **Step 3:** `.env.example`: after the Firebase block add:

```
# Google OAuth web client ID (Firebase console → Auth → Google → Web SDK configuration).
# The app's origins must be in this client's "Authorized JavaScript origins" (GCP console).
VITE_GOOGLE_CLIENT_ID=000000000000-xxxxxxxx.apps.googleusercontent.com
```

---

### Task 2: AuthContext — credential exchange

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: context method renamed `loginWithGoogle` → `loginWithGoogleIdToken(idToken: string): Promise<void>`; `NotApprovedError` unchanged.

- [ ] **Step 1:** Imports: replace `signInWithPopup` with `signInWithCredential` (GoogleAuthProvider stays).
- [ ] **Step 2:** Interface: `loginWithGoogle: () => Promise<void>` → `loginWithGoogleIdToken: (idToken: string) => Promise<void>`; same rename in the `value` object.
- [ ] **Step 3:** Replace the function body's first line only — the rest (getMe / register-on-404 / NOT_APPROVED sign-out) is unchanged:

```tsx
  const loginWithGoogleIdToken = async (idToken: string) => {
    loginInProgressRef.current = true;
    try {
      const credential = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(idToken)
      );
      // ... existing getMe/register/NOT_APPROVED logic, unchanged ...
    } finally {
      loginInProgressRef.current = false;
    }
  };
```

---

### Task 3: LoginPage — GIS button

**Files:**
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1:** Replace the custom button + `handleGoogleLogin` with a GIS-rendered button. Full replacement body:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth, NotApprovedError } from '@/contexts/AuthContext';
import { renderGoogleSignInButton } from '@/lib/auth/googleIdentity';
import { Spinner } from '@/components/ui/Spinner';

export const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithGoogleIdToken } = useAuth();
  const navigate = useNavigate();
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  const handleIdToken = async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogleIdToken(idToken);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof NotApprovedError) {
        setError(err.message);
      } else {
        const code = (err as { code?: string }).code;
        const detail = err instanceof Error ? err.message : String(err);
        setError(`Failed to sign in${code ? ` (${code})` : ''}: ${detail}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // GIS initializes once; route sign-ins through a ref so the callback
  // always sees the latest handler without re-rendering the button.
  const handleIdTokenRef = useRef(handleIdToken);
  handleIdTokenRef.current = handleIdToken;

  useEffect(() => {
    const container = buttonContainerRef.current;
    if (!container) return;
    renderGoogleSignInButton(container, (idToken) => {
      void handleIdTokenRef.current(idToken);
    }).catch((err) => {
      console.error('Google sign-in init error:', err);
      setError('Could not load Google sign-in. Check your connection and reload.');
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600">
              <Mic size={40} className="text-white" />
            </div>
          </div>
          <h1 className="mt-4 text-4xl font-bold text-center text-gray-900">
            TrailMemo
          </h1>
          <p className="mt-2 text-center text-gray-600">
            Sign in to view memos on the map
          </p>
        </div>

        <div className="mt-8 space-y-4 bg-white p-8 rounded-lg shadow">
          {/* Container stays mounted — GIS renders into it once; hide during the exchange */}
          <div
            ref={buttonContainerRef}
            className={`justify-center min-h-[44px] ${loading ? 'hidden' : 'flex'}`}
          />
          {loading && (
            <div className="flex items-center justify-center gap-3 py-2 text-gray-600">
              <Spinner size="sm" />
              <span>Signing you in…</span>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <p className="text-center text-xs text-gray-500">
            Access is limited to approved users. Contact your administrator if
            you need access.
          </p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: clean.

**Verify (owner):** set `VITE_GOOGLE_CLIENT_ID` locally + hosted; add origins to the OAuth client; redeploy. Sign in from desktop, phone Safari, and the installed PWA.
