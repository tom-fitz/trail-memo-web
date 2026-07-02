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
