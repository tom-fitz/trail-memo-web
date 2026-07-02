# Google SSO with Admin Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google-SSO-only login gated by a Postgres allowlist, managed from an in-app admin page.

**Architecture:** API enforces the allowlist (register + me endpoints return `403 NOT_APPROVED`); new `/api/v1/admin/approved-users` CRUD behind an `is_admin` middleware. Frontend replaces password auth with `signInWithPopup(GoogleAuthProvider)` in a rewritten `AuthContext` that also loads the backend profile, plus a new `/admin` page.

**Tech Stack:** Go/Gin/sqlx (trail-memo-api), Firebase Auth Google provider, React/react-query (trail-memo-web).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-google-sso-design.md`.
- No git commits; no app runs. Verification: `go build ./...` in trail-memo-api, `npx tsc --noEmit` in trail-memo-web.
- Emails stored/compared lowercase. Error envelope matches existing style: `{"error": {"code", "message"}}`.
- Fresh start: no data migration for existing beta accounts.

---

### Task 1: Backend — migration, models, repositories

**Files:**
- Create: `trail-memo-api/migrations/004_google_sso.sql`
- Modify: `trail-memo-api/internal/models/user.go`
- Create: `trail-memo-api/internal/repository/approved_user_repo.go`
- Modify: `trail-memo-api/internal/repository/user_repo.go` (add `is_admin` to both SELECTs)

**Interfaces:**
- Produces: `models.User.IsAdmin`, `models.ApprovedUser`, `ApprovedUserRepository{IsApproved, List, Add, Remove}` — consumed by Tasks 2.

- [ ] **Step 1:** `migrations/004_google_sso.sql`:

```sql
-- Google SSO: sign-in allowlist and admin flag

CREATE TABLE IF NOT EXISTS approved_users (
    email VARCHAR(255) PRIMARY KEY,
    added_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Bootstrap (manual, one time):
--   INSERT INTO approved_users (email) VALUES ('<your-google-email>');
--   -- after that account's first Google sign-in:
--   UPDATE users SET is_admin = TRUE WHERE email = '<your-google-email>';
```

- [ ] **Step 2:** In `models/user.go`, add `IsAdmin` to `User` (after `Color`) and append the allowlist model:

```go
	IsAdmin     bool      `json:"is_admin" db:"is_admin"`
```

```go
// ApprovedUser is a sign-in allowlist entry with registration status
type ApprovedUser struct {
	Email       string    `json:"email" db:"email"`
	AddedBy     *string   `json:"added_by" db:"added_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	Registered  bool      `json:"registered" db:"registered"`
	DisplayName *string   `json:"display_name" db:"display_name"`
}
```

- [ ] **Step 3:** Create `repository/approved_user_repo.go`:

```go
package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/tom-fitz/trailmemo-api/internal/models"
)

// ApprovedUserRepository handles the sign-in allowlist
type ApprovedUserRepository struct {
	db *sqlx.DB
}

// NewApprovedUserRepository creates a new approved user repository
func NewApprovedUserRepository(db *sqlx.DB) *ApprovedUserRepository {
	return &ApprovedUserRepository{db: db}
}

// IsApproved reports whether an email is on the allowlist (case-insensitive)
func (r *ApprovedUserRepository) IsApproved(ctx context.Context, email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS (SELECT 1 FROM approved_users WHERE email = $1)`
	if err := r.db.GetContext(ctx, &exists, query, strings.ToLower(email)); err != nil {
		return false, fmt.Errorf("error checking approved email: %v", err)
	}
	return exists, nil
}

// List returns all approved emails with registration status
func (r *ApprovedUserRepository) List(ctx context.Context) ([]models.ApprovedUser, error) {
	approved := []models.ApprovedUser{}
	query := `
		SELECT a.email, a.added_by, a.created_at,
		       (u.user_id IS NOT NULL) AS registered,
		       u.display_name AS display_name
		FROM approved_users a
		LEFT JOIN users u ON LOWER(u.email) = a.email
		ORDER BY a.created_at DESC
	`
	if err := r.db.SelectContext(ctx, &approved, query); err != nil {
		return nil, fmt.Errorf("error listing approved users: %v", err)
	}
	return approved, nil
}

// Add puts an email on the allowlist (idempotent)
func (r *ApprovedUserRepository) Add(ctx context.Context, email, addedBy string) error {
	query := `INSERT INTO approved_users (email, added_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`
	if _, err := r.db.ExecContext(ctx, query, strings.ToLower(email), addedBy); err != nil {
		return fmt.Errorf("error adding approved user: %v", err)
	}
	return nil
}

// Remove deletes an email from the allowlist
func (r *ApprovedUserRepository) Remove(ctx context.Context, email string) error {
	query := `DELETE FROM approved_users WHERE email = $1`
	if _, err := r.db.ExecContext(ctx, query, strings.ToLower(email)); err != nil {
		return fmt.Errorf("error removing approved user: %v", err)
	}
	return nil
}
```

- [ ] **Step 4:** In `repository/user_repo.go`, both `GetByID` and `GetByEmail` SELECT column lists become:

```sql
		SELECT user_id, email, display_name, department, color, is_admin, created_at
```

---

### Task 2: Backend — middleware, handlers, wiring

**Files:**
- Create: `trail-memo-api/internal/middleware/admin.go`
- Create: `trail-memo-api/internal/handlers/admin.go`
- Modify: `trail-memo-api/internal/handlers/auth.go`
- Modify: `trail-memo-api/cmd/server/main.go`

**Interfaces:**
- Consumes: Task 1 repo/model.
- Produces: `403 {code: NOT_APPROVED}` from register/me (frontend Task 3 matches on this exact code); admin endpoints per spec.

- [ ] **Step 1:** Create `middleware/admin.go`:

```go
package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tom-fitz/trailmemo-api/internal/repository"
)

// AdminMiddleware requires the authenticated user to be an admin.
// Must run after AuthMiddleware.
func AdminMiddleware(userRepo *repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := GetUserID(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "AUTHENTICATION_ERROR",
					"message": "Authentication required",
				},
			})
			c.Abort()
			return
		}

		user, err := userRepo.GetByID(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": "Error fetching user",
				},
			})
			c.Abort()
			return
		}

		if user == nil || !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "FORBIDDEN",
					"message": "Admin access required",
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
```

- [ ] **Step 2:** Create `handlers/admin.go`:

```go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tom-fitz/trailmemo-api/internal/middleware"
	"github.com/tom-fitz/trailmemo-api/internal/repository"
)

// AdminHandler handles allowlist management
type AdminHandler struct {
	approvedRepo *repository.ApprovedUserRepository
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(approvedRepo *repository.ApprovedUserRepository) *AdminHandler {
	return &AdminHandler{approvedRepo: approvedRepo}
}

// ListApprovedUsers returns the sign-in allowlist
// GET /api/v1/admin/approved-users
func (h *AdminHandler) ListApprovedUsers(c *gin.Context) {
	approved, err := h.approvedRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Error listing approved users",
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"approved_users": approved})
}

type addApprovedUserRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// AddApprovedUser adds an email to the allowlist (idempotent)
// POST /api/v1/admin/approved-users
func (h *AdminHandler) AddApprovedUser(c *gin.Context) {
	var req addApprovedUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "A valid email is required",
			},
		})
		return
	}

	adminID, _ := middleware.GetUserID(c)
	if err := h.approvedRepo.Add(c.Request.Context(), req.Email, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Error adding approved user",
			},
		})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"email": req.Email})
}

// RemoveApprovedUser removes an email from the allowlist
// DELETE /api/v1/admin/approved-users?email=<email>
func (h *AdminHandler) RemoveApprovedUser(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "email query parameter is required",
			},
		})
		return
	}

	if err := h.approvedRepo.Remove(c.Request.Context(), email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Error removing approved user",
			},
		})
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 3:** In `handlers/auth.go`: `AuthHandler` struct and `NewAuthHandler` gain `approvedRepo *repository.ApprovedUserRepository` (field + parameter + assignment). In `Register`, directly after the firebaseUser fetch succeeds, insert:

```go
	// Enforce the sign-in allowlist
	approved, err := h.approvedRepo.IsApproved(c.Request.Context(), firebaseUser.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Error checking approval status",
			},
		})
		return
	}
	if !approved {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"code":    "NOT_APPROVED",
				"message": "This account is not approved. Contact your administrator.",
			},
		})
		return
	}
```

In `GetMe`, after the `user == nil` check, insert the same block but checking `user.Email` (removal from the list locks the user out at next launch).

- [ ] **Step 4:** In `cmd/server/main.go`: after `userRepo :=` add `approvedRepo := repository.NewApprovedUserRepository(db)`; change `authHandler := handlers.NewAuthHandler(userRepo, firebaseService)` → `handlers.NewAuthHandler(userRepo, approvedRepo, firebaseService)`; add `adminHandler := handlers.NewAdminHandler(approvedRepo)`; after the memos group add:

```go
		// Admin routes (allowlist management)
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(firebaseService), middleware.AdminMiddleware(userRepo))
		{
			admin.GET("/approved-users", adminHandler.ListApprovedUsers)
			admin.POST("/approved-users", adminHandler.AddApprovedUser)
			admin.DELETE("/approved-users", adminHandler.RemoveApprovedUser)
		}
```

- [ ] **Step 5:** Run `go build ./...` in trail-memo-api. Expected: clean.

---

### Task 3: Frontend — types, admin API, AuthContext rewrite

**Files:**
- Modify: `trail-memo-web/src/types/user.ts`
- Create: `trail-memo-web/src/lib/api/admin.ts`
- Rewrite: `trail-memo-web/src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: `useAuth(): {user, profile, isAdmin, loading, loginWithGoogle, logout}` and exported `NotApprovedError` (Task 4 consumes); `adminApi` + `ApprovedUser` (Task 5 consumes). `login`/`register` removed from the context.

- [ ] **Step 1:** `types/user.ts` — `User` gains `is_admin: boolean;` after `color`.

- [ ] **Step 2:** Create `lib/api/admin.ts`:

```ts
import apiClient from './client';

export interface ApprovedUser {
  email: string;
  added_by: string | null;
  created_at: string;
  registered: boolean;
  display_name: string | null;
}

export const adminApi = {
  listApprovedUsers: async (): Promise<ApprovedUser[]> => {
    const response = await apiClient.get('/admin/approved-users');
    return response.data.approved_users;
  },

  addApprovedUser: async (email: string): Promise<void> => {
    await apiClient.post('/admin/approved-users', { email });
  },

  removeApprovedUser: async (email: string): Promise<void> => {
    await apiClient.delete('/admin/approved-users', { params: { email } });
  },
};
```

- [ ] **Step 3:** Rewrite `contexts/AuthContext.tsx` (full file):

```tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
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
  loginWithGoogle: () => Promise<void>;
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

  const loginWithGoogle = async () => {
    loginInProgressRef.current = true;
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
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
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

---

### Task 4: Frontend — LoginPage rewrite, RegisterPage removal, routes

**Files:**
- Rewrite: `trail-memo-web/src/pages/LoginPage.tsx`
- Delete: `trail-memo-web/src/pages/RegisterPage.tsx`
- Modify: `trail-memo-web/src/App.tsx`

- [ ] **Step 1:** Rewrite `pages/LoginPage.tsx` (full file):

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth, NotApprovedError } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';

const GoogleLogo: React.FC = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      const code = (err as { code?: string }).code;
      if (err instanceof NotApprovedError) {
        setError(err.message);
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled.');
      } else if (code === 'auth/popup-blocked') {
        setError('Your browser blocked the sign-in popup. Allow popups and try again.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg bg-white font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <GoogleLogo />
                Continue with Google
              </>
            )}
          </button>

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

- [ ] **Step 2:** Delete `src/pages/RegisterPage.tsx` (`rm`).

- [ ] **Step 3:** In `App.tsx`: remove the `RegisterPage` import; add `import { AdminPage } from '@/pages/AdminPage';` (created in Task 5); replace the `/register` route with a redirect and add `/admin`:

```tsx
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
```

---

### Task 5: Frontend — AdminPage + header entry point

**Files:**
- Create: `trail-memo-web/src/pages/AdminPage.tsx`
- Modify: `trail-memo-web/src/pages/MapPage.tsx` (admin button)

- [ ] **Step 1:** Confirm lucide exports `Users`, `ArrowLeft` exist (fallbacks: `User`, `ChevronLeft`).

- [ ] **Step 2:** Create `pages/AdminPage.tsx` (full file):

```tsx
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

export const AdminPage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data: approvedUsers, isLoading, error } = useQuery({
    queryKey: ['approved-users'],
    queryFn: adminApi.listApprovedUsers,
    enabled: isAdmin,
  });

  const addMutation = useMutation({
    mutationFn: adminApi.addApprovedUser,
    onSuccess: () => {
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['approved-users'] });
    },
    onError: () => setFormError('Failed to add email. Please try again.'),
  });

  const removeMutation = useMutation({
    mutationFn: adminApi.removeApprovedUser,
    onSuccess: () => {
      setConfirmRemove(null);
      queryClient.invalidateQueries({ queryKey: ['approved-users'] });
    },
  });

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError('Enter a valid email address.');
      return;
    }
    addMutation.mutate(trimmed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back to map">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Approved Users</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-lg shadow space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Add an approved email
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@gmail.com"
              required
            />
            <Button
              type="submit"
              disabled={addMutation.isPending || !email.trim()}
              className="flex items-center whitespace-nowrap"
            >
              {addMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </>
              )}
            </Button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <p className="text-xs text-gray-500">
            Approved users can sign in with the Google account matching this email.
          </p>
        </form>

        <div className="bg-white rounded-lg shadow divide-y">
          {isLoading && (
            <div className="p-6 flex justify-center">
              <Spinner size="lg" />
            </div>
          )}
          {error != null && (
            <p className="p-4 text-sm text-red-600">Failed to load the approved list.</p>
          )}
          {approvedUsers?.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No approved users yet.</p>
          )}
          {approvedUsers?.map((approved) => (
            <div key={approved.email} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{approved.email}</p>
                <p className="text-xs text-gray-500">
                  {approved.registered
                    ? `Registered${approved.display_name ? ` as ${approved.display_name}` : ''}`
                    : 'Not signed in yet'}
                </p>
              </div>
              {confirmRemove === approved.email ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmRemove(null)}
                    disabled={removeMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => removeMutation.mutate(approved.email)}
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? <Spinner size="sm" /> : 'Remove'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmRemove(approved.email)}
                  aria-label={`Remove ${approved.email}`}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
```

- [ ] **Step 3:** In `MapPage.tsx`: import `Users` from lucide and `useNavigate` from react-router-dom; destructure `isAdmin` from `useAuth()`; add `const navigate = useNavigate();`; in the header's right-side action group, before the refresh button:

```tsx
            {isAdmin && (
              <Button
                variant="ghost"
                onClick={() => navigate('/admin')}
                title="Manage approved users"
              >
                <Users className="w-5 h-5" />
              </Button>
            )}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` in trail-memo-web. Expected: clean.

**Verify (owner):** enable the Google provider in Firebase console; run migration 004; insert your email into `approved_users`; sign in with Google; `UPDATE users SET is_admin = TRUE WHERE email = '...'`; reload → Users button appears; add/remove teammates; try an unapproved account → contact-admin message and no session; `/register` redirects to login. Then disable the Email/Password provider.
