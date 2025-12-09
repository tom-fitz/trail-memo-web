import React, { useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMemos } from '@/hooks/useMemos';
import { MapView } from '@/components/map/MapView';
import { MemoDetailModal } from '@/components/memos/MemoDetailModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Memo } from '@/types/memo';

export const MapPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { memos, isLoading, error, refetch } = useMemos();
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMemoClick = (memo: Memo) => {
    setSelectedMemo(memo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMemo(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">TrailMemo</h1>
            {isLoading && <Spinner size="sm" />}
            {!isLoading && (
              <div className="text-sm text-gray-600">
                {memos.length} memo{memos.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh memos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <div className="text-sm text-gray-600 hidden sm:block">
              {user?.email}
            </div>
            
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg">
            <p className="font-medium">Failed to load memos</p>
            <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button variant="secondary" onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Always show the map, with a loading overlay if needed */}
        {isLoading && memos.length === 0 ? (
          <div className="h-full relative">
            <MapView
              memos={[]}
              onMemoClick={handleMemoClick}
              selectedMemoId={selectedMemo?.memo_id}
            />
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[1000] pointer-events-none">
              <div className="text-center bg-white p-6 rounded-lg shadow-lg pointer-events-auto">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-600">Loading memos...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <MapView
              memos={memos}
              onMemoClick={handleMemoClick}
              selectedMemoId={selectedMemo?.memo_id}
            />
            {/* Show info message if no memos, but keep map visible */}
            {memos.length === 0 && !isLoading && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-md pointer-events-auto">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    No Memos Yet
                  </h2>
                  <p className="text-gray-600">
                    The map is ready. Memos will appear here when they're created from the mobile app.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Memo Detail Modal */}
      <MemoDetailModal
        memo={selectedMemo}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

