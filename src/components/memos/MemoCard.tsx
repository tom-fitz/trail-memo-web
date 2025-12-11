import React from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { Memo } from '@/types/memo';
import { formatRelativeTime, formatCoordinates, getUserColor } from '@/lib/utils/formatters';

interface MemoCardProps {
  memo: Memo;
}

export const MemoCard: React.FC<MemoCardProps> = ({ memo }) => {
  const userColor = getUserColor(memo.user_id, memo.user_color);
  
  // Get user initials from name
  const getUserInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  
  return (
    <div className="space-y-4">
      {/* User and Date Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: userColor }}
          >
            {getUserInitials(memo.user_name)}
          </div>
          <span className="font-semibold text-gray-900">{memo.user_name}</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>{formatRelativeTime(memo.created_at)}</span>
        </div>
      </div>

      {/* Park Name */}
      {memo.park_name && (
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-600" />
          <span className="text-lg font-medium text-gray-800">{memo.park_name}</span>
        </div>
      )}

      {/* Memo Text */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-gray-800 whitespace-pre-wrap">{memo.text}</p>
      </div>

      {/* Location Details */}
      {memo.location && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Location</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Coordinates: {formatCoordinates(memo.location.latitude, memo.location.longitude)}
            </p>
            {memo.location.accuracy && (
              <p>Accuracy: ±{memo.location.accuracy.toFixed(1)}m</p>
            )}
            {memo.location.address && (
              <p>Address: {memo.location.address}</p>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="border-t pt-4 text-xs text-gray-500 space-y-1">
        <p>Created: {new Date(memo.created_at).toLocaleString()}</p>
        {memo.duration_seconds && (
          <p>Duration: {Math.floor(memo.duration_seconds / 60)}m {memo.duration_seconds % 60}s</p>
        )}
      </div>
    </div>
  );
};

