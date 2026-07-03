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
