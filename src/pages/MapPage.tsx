import React, { useState, useMemo } from 'react';
import { LogOut, RefreshCw, Plus, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMemos } from '@/hooks/useMemos';
import { MapView } from '@/components/map/MapView';
import { MemoDetailModal } from '@/components/memos/MemoDetailModal';
import { CreateMemoModal } from '@/components/memos/CreateMemoModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Memo } from '@/types/memo';

export const MapPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { memos, isLoading, error, refetch, createMemo, updateMemoLocation } = useMemos();
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMemoLocation, setNewMemoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [editedLocation, setEditedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Get unique users from memos
  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; color: string }>();
    console.log('memos', memos);
    memos.forEach((memo) => {
      if (!userMap.has(memo.user_id)) {
        userMap.set(memo.user_id, {
          id: memo.user_id,
          name: memo.user_name || 'Unknown User',
          color: memo.user_color,
        });
      }
    });
    return Array.from(userMap.values());
  }, [memos]);

  // Filter memos based on selected users
  const filteredMemos = useMemo(() => {
    if (selectedUserIds.size === 0) {
      return memos; // Show all if no filter selected
    }
    return memos.filter((memo) => selectedUserIds.has(memo.user_id));
  }, [memos, selectedUserIds]);

  // Toggle user filter
  const toggleUserFilter = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleMemoClick = (memo: Memo) => {
    setSelectedMemo(memo);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedMemo(null);
  };

  const handleStartPlacement = () => {
    setIsPlacementMode(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isPlacementMode) {
      setNewMemoLocation({ lat, lng });
      setIsCreateModalOpen(true);
      setIsPlacementMode(false);
    }
  };

  const handleCancelPlacement = () => {
    setIsPlacementMode(false);
  };

  const handleCreateMemo = async (data: { text: string; title?: string; park_name?: string }) => {
    if (!newMemoLocation) return;

    await createMemo({
      ...data,
      latitude: newMemoLocation.lat,
      longitude: newMemoLocation.lng,
    });

    setNewMemoLocation(null);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewMemoLocation(null);
  };

  const handleStartEditLocation = (memo: Memo) => {
    setEditingMemo(memo);
    setEditedLocation(null);
  };

  const handleCancelEdit = () => {
    setEditingMemo(null);
    setEditedLocation(null);
  };

  const handleMarkerDrag = (memoId: string, lat: number, lng: number) => {
    if (editingMemo && editingMemo.memo_id === memoId) {
      setEditedLocation({ lat, lng });
    }
  };

  const handleSaveLocation = async () => {
    if (!editingMemo || !editedLocation) return;

    setIsSaving(true);
    try {
      await updateMemoLocation({
        id: editingMemo.memo_id,
        latitude: editedLocation.lat,
        longitude: editedLocation.lng,
      });
      setEditingMemo(null);
      setEditedLocation(null);
    } catch (err) {
      console.error('Failed to update location:', err);
      alert('Failed to update location. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
          {/* Left side - Logo and memo count */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">TrailMemo</h1>
            {isLoading && <Spinner size="sm" />}
            {!isLoading && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-600">
                  {memos.length} {memos.length !== 1 ? 'memos' : 'memo'}
                </span>
              </div>
            )}
          </div>

          {/* Center - New Memo button */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Button
              variant={isPlacementMode ? 'danger' : 'primary'}
              onClick={isPlacementMode ? handleCancelPlacement : handleStartPlacement}
              title={isPlacementMode ? 'Cancel placement' : 'Create new memo'}
              className="flex items-center whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>New Memo</span>
            </Button>
          </div>

          {/* Right side - Actions and user info */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh memos"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <span className="text-sm text-gray-600 hidden sm:inline-block px-2">
              {user?.email}
            </span>
            
            <Button variant="secondary" onClick={handleLogout} className="flex items-center whitespace-nowrap">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Placement mode indicator */}
      {isPlacementMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
          <p className="font-medium">📍 Click anywhere on the map to place your memo</p>
        </div>
      )}

      {/* Edit mode controls */}
      {editingMemo && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-6 py-4 rounded-lg shadow-xl border-2 border-blue-500">
          <p className="font-medium text-gray-800 mb-3">🎯 Drag the marker to a new location</p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveLocation}
              disabled={!editedLocation || isSaving}
            >
              {isSaving ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Location
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div 
        className="flex-1 relative"
        style={{ cursor: isPlacementMode ? 'crosshair' : editingMemo ? 'move' : 'default' }}
      >
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
              onMapClick={handleMapClick}
              isPlacementMode={isPlacementMode}
              editingMemoId={editingMemo?.memo_id}
              onMarkerDrag={handleMarkerDrag}
              currentUserId={user?.uid}
              uniqueUsers={[]}
              selectedUserIds={selectedUserIds}
              onToggleUserFilter={toggleUserFilter}
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
              memos={filteredMemos}
              onMemoClick={handleMemoClick}
              onMapClick={handleMapClick}
              isPlacementMode={isPlacementMode}
              editingMemoId={editingMemo?.memo_id}
              onMarkerDrag={handleMarkerDrag}
              currentUserId={user?.uid}
              tempEditedLocation={editedLocation}
              uniqueUsers={uniqueUsers}
              selectedUserIds={selectedUserIds}
              onToggleUserFilter={toggleUserFilter}
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
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onEditLocation={handleStartEditLocation}
      />

      {/* Create Memo Modal */}
      <CreateMemoModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        location={newMemoLocation}
        onSubmit={handleCreateMemo}
      />
    </div>
  );
};

