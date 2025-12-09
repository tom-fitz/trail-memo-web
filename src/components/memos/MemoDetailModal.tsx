import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MemoCard } from './MemoCard';
import { Memo } from '@/types/memo';
import { useAuth } from '@/contexts/AuthContext';
import { useMemos } from '@/hooks/useMemos';

interface MemoDetailModalProps {
  memo: Memo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemoDetailModal: React.FC<MemoDetailModalProps> = ({
  memo,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { deleteMemo, isDeleting } = useMemos();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!memo) return null;

  const isOwner = user?.uid === memo.user_id;

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    deleteMemo(memo.memo_id, {
      onSuccess: () => {
        onClose();
        setShowDeleteConfirm(false);
      },
      onError: (error) => {
        console.error('Failed to delete memo:', error);
        alert('Failed to delete memo. Please try again.');
        setShowDeleteConfirm(false);
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Memo Details">
      <MemoCard memo={memo} />

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3 justify-end border-t pt-4">
        {isOwner && (
          <>
            {showDeleteConfirm ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600">Are you sure?</span>
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Spinner size="sm" /> : 'Confirm Delete'}
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Memo
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

