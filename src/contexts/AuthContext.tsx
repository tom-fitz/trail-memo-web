import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { isAxiosError } from 'axios';
import { auth } from '@/lib/firebase/config';
import { authApi } from '@/lib/api/auth';
import { User } from '@/types/user';

export class NotApprovedError extends Error {
  constructor() {
    super("Your Google account isn't on the approved list. Contact your administrator for access.");
    this.name = 'NotApprovedError';
  }
}

const isNotApproved = (err: unknown): boolean =>
  isAxiosError(err) &&
  err.response?.status === 403 &&
  err.response.data?.error?.code === 'NOT_APPROVED';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  isAdmin: boolean;
  loading: boolean;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // loginWithGoogle drives its own profile fetch; skip the listener's
  const loginInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      if (loginInProgressRef.current) {
        setLoading(false);
        return;
      }
      try {
        setProfile(await authApi.getMe());
      } catch {
        // stale session, unapproved, or removed from the allowlist
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loginWithGoogleIdToken = async (idToken: string) => {
    loginInProgressRef.current = true;
    try {
      const credential = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(idToken)
      );
      try {
        let me: User;
        try {
          me = await authApi.getMe();
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 404) {
            // First sign-in: create the backend account from the Google profile
            me = await authApi.register({
              display_name:
                credential.user.displayName ||
                credential.user.email?.split('@')[0] ||
                'Unknown User',
              department: '',
            });
          } else {
            throw err;
          }
        }
        setProfile(me);
      } catch (err) {
        await signOut(auth);
        if (isNotApproved(err)) {
          throw new NotApprovedError();
        }
        throw err;
      }
    } finally {
      loginInProgressRef.current = false;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    profile,
    isAdmin: profile?.is_admin ?? false,
    loading,
    loginWithGoogleIdToken,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
