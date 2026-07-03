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
