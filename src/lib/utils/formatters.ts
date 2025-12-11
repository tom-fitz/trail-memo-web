import { formatDistanceToNow } from 'date-fns';

export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Unknown date';
  }
};

export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
};

export const getUserColor = (userId: string, userColor?: string): string => {
  // Use the backend-provided color if available
  if (userColor) {
    return userColor;
  }
  
  // Fallback: Generate a consistent color based on user ID (for backwards compatibility)
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
};

