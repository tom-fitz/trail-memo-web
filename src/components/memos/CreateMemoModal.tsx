import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

interface CreateMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
  onSubmit: (data: { text: string; title?: string; park_name?: string }) => Promise<void>;
}

export const CreateMemoModal: React.FC<CreateMemoModalProps> = ({
  isOpen,
  onClose,
  location,
  onSubmit,
}) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [parkName, setParkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('Memo text is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit({
        text: text.trim(),
        title: title.trim() || undefined,
        park_name: parkName.trim() || undefined,
      });
      
      // Reset form
      setText('');
      setTitle('');
      setParkName('');
      onClose();
    } catch (err: any) {
      console.error('Create memo error:', err);
      setError(err.response?.data?.error?.message || 'Failed to create memo');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setText('');
      setTitle('');
      setParkName('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Memo">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location info */}
        {location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <MapPin className="w-4 h-4" />
            <span>
              Location: {location.lat.toFixed(6)}°, {location.lng.toFixed(6)}°
            </span>
          </div>
        )}

        {/* Title (optional) */}
        <Input
          label="Title (optional)"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Fallen tree on main trail"
          maxLength={255}
        />

        {/* Memo text (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Memo Text *
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your memo here..."
            required
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={5000}
          />
          <div className="text-xs text-gray-500 mt-1">
            {text.length} / 5000 characters
          </div>
        </div>

        {/* Park name (optional) */}
        <Input
          label="Park/Location Name (optional)"
          type="text"
          value={parkName}
          onChange={(e) => setParkName(e.target.value)}
          placeholder="e.g., Lindley Park"
          maxLength={255}
        />

        {/* Error message */}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !text.trim()}
          >
            {loading ? <Spinner size="sm" /> : 'Create Memo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

