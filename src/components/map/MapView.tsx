import React, { useState, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, ScaleControl } from 'react-map-gl';
import { Layers, Filter } from 'lucide-react';
import { Memo } from '@/types/memo';
import { getUserColor } from '@/lib/utils/formatters';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  memos: Memo[];
  onMemoClick: (memo: Memo) => void;
  onMapClick?: (lat: number, lng: number) => void;
  isPlacementMode?: boolean;
  editingMemoId?: string;
  onMarkerDrag?: (memoId: string, lat: number, lng: number) => void;
  currentUserId?: string;
  tempEditedLocation?: { lat: number; lng: number } | null;
  uniqueUsers: { id: string; name: string }[];
  selectedUserIds: Set<string>;
  onToggleUserFilter: (userId: string) => void;
}

// Map style options optimized for park workers
const MAP_STYLES = {
  outdoors: {
    url: 'mapbox://styles/mapbox/outdoors-v12',
    name: 'Outdoors',
    description: 'Parks & trails highlighted',
  },
  satellite: {
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    name: 'Satellite',
    description: 'Aerial view with labels',
  },
  streets: {
    url: 'mapbox://styles/mapbox/streets-v12',
    name: 'Streets',
    description: 'Standard street map',
  },
};

export const MapView: React.FC<MapViewProps> = ({
  memos,
  onMemoClick,
  onMapClick,
  isPlacementMode = false,
  editingMemoId,
  onMarkerDrag,
  tempEditedLocation,
  uniqueUsers,
  selectedUserIds,
  onToggleUserFilter,
}) => {
  // Default map center (can be configured via env)
  const defaultLat = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '45.6789');
  const defaultLng = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '-111.0517');
  const defaultZoom = parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM || '12');

  const [popupInfo, setPopupInfo] = useState<Memo | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('outdoors');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showUserFilter, setShowUserFilter] = useState(false);
  
  // Enhance map style when it loads
  const handleMapLoad = useCallback((event: any) => {
    const map = event.target;
    
    // Only enhance the outdoors style
    if (mapStyle === 'outdoors') {
      // Make parks MUCH more vibrant and prominent
      if (map.getLayer('landuse')) {
        map.setPaintProperty('landuse', 'fill-color', [
          'match',
          ['get', 'class'],
          'park', '#4ade80',           // Bright green for parks
          'pitch', '#86efac',          // Light green for sports fields
          'playground', '#86efac',     // Light green for playgrounds
          'cemetery', '#a7f3d0',       // Pale green for cemeteries
          'hospital', '#fecaca',       // Light red for hospitals
          'school', '#fed7aa',         // Light orange for schools
          '#f3f4f6'                    // Default light gray
        ]);
        map.setPaintProperty('landuse', 'fill-opacity', 0.5); // More visible
      }

      // Make trails MUCH thicker and more vibrant
      if (map.getLayer('road')) {
        map.setPaintProperty('road', 'line-width', [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          12, ['match', ['get', 'class'], 
            ['path', 'track'], 2.5,    // Trails thicker at low zoom
            ['footway', 'pedestrian'], 2,
            1
          ],
          18, ['match', ['get', 'class'],
            ['path', 'track'], 8,      // Even thicker at high zoom
            ['footway', 'pedestrian'], 6,
            2
          ]
        ]);
        
        // Make trail colors more vibrant
        map.setPaintProperty('road', 'line-color', [
          'match',
          ['get', 'class'],
          'path', '#fb923c',           // Bright orange for paths
          'track', '#f97316',          // Darker orange for tracks
          'footway', '#fdba74',        // Light orange for footways
          'pedestrian', '#fed7aa',     // Pale orange for pedestrian
          '#94a3b8'                    // Default gray for other roads
        ]);
      }

      // Add glow effect to trails
      if (map.getLayer('road')) {
        // Add a wider, semi-transparent line underneath for glow effect
        map.setPaintProperty('road', 'line-blur', 1.5);
      }

      // Make park boundaries more visible
      if (map.getLayer('landuse-outline')) {
        map.setPaintProperty('landuse-outline', 'line-color', '#22c55e');
        map.setPaintProperty('landuse-outline', 'line-width', 2);
        map.setPaintProperty('landuse-outline', 'line-opacity', 0.8);
      }

      // Enhance water bodies
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#3b82f6'); // Brighter blue
        map.setPaintProperty('water', 'fill-opacity', 0.6);
      }

      // Make park/trail labels larger and more prominent
      if (map.getLayer('place-label')) {
        map.setPaintProperty('place-label', 'text-halo-width', 2);
        map.setPaintProperty('place-label', 'text-halo-color', '#ffffff');
        map.setPaintProperty('place-label', 'text-halo-blur', 1);
      }

      // Enhance POI (points of interest) icons
      if (map.getLayer('poi-label')) {
        map.setLayoutProperty('poi-label', 'icon-size', [
          'interpolate',
          ['linear'],
          ['zoom'],
          12, 1.2,    // Larger icons
          18, 1.8
        ]);
        map.setPaintProperty('poi-label', 'text-halo-width', 2);
        map.setPaintProperty('poi-label', 'text-halo-color', '#ffffff');
      }
    }
  }, [mapStyle]);
  
  // Get center from memos if available
  const initialViewState = {
    latitude: memos.length > 0 && memos[0].location 
      ? memos[0].location.latitude 
      : defaultLat,
    longitude: memos.length > 0 && memos[0].location 
      ? memos[0].location.longitude 
      : defaultLng,
    zoom: defaultZoom,
  };

  const handleMarkerClick = useCallback((memo: Memo) => {
    setPopupInfo(memo);
  }, []);

  const handleViewDetails = useCallback((memo: Memo) => {
    setPopupInfo(null);
    onMemoClick(memo);
  }, [onMemoClick]);

  // Get user initials from name
  const getUserInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="h-full w-full relative">
      <Map
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLES[mapStyle].url}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        maxZoom={22}
        minZoom={1}
        onLoad={handleMapLoad}
        onClick={(e) => {
          if (isPlacementMode && onMapClick) {
            onMapClick(e.lngLat.lat, e.lngLat.lng);
          }
        }}
        cursor={isPlacementMode ? 'crosshair' : 'grab'}
        // Optimized settings for outdoor/park use
        terrain={{ source: 'mapbox-dem', exaggeration: 2.0 }} // More dramatic terrain
        fog={{
          'range': [0.5, 10],
          'color': '#e0f2fe',
          'horizon-blend': 0.1
        }} // Enhanced atmospheric effect
      >
        {/* Map Controls */}
        <NavigationControl position="top-right" showCompass={true} />
        <ScaleControl position="bottom-right" />

        {/* Style Selector and Filter Buttons */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {/* Style Selector Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStyleSelector(!showStyleSelector);
                setShowUserFilter(false);
              }}
              className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
              title="Change map style"
            >
              <Layers className="w-5 h-5 text-gray-700" />
            </button>
            
            {showStyleSelector && (
              <div className="absolute top-14 left-0 bg-white rounded-lg shadow-xl p-2 min-w-[200px]">
                {Object.entries(MAP_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setMapStyle(key as keyof typeof MAP_STYLES);
                      setShowStyleSelector(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      mapStyle === key
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{style.name}</div>
                    <div className="text-xs text-gray-500">{style.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserFilter(!showUserFilter);
                setShowStyleSelector(false);
              }}
              className={`bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors ${
                selectedUserIds.size > 0 ? 'ring-2 ring-blue-500' : ''
              }`}
              title="Filter by user"
            >
              <Filter className="w-5 h-5 text-gray-700" />
              {selectedUserIds.size > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {selectedUserIds.size}
                </span>
              )}
            </button>
            
            {showUserFilter && (
              <div className="absolute top-14 left-0 bg-white rounded-lg shadow-xl p-2 min-w-[240px] max-h-[400px] overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200">
                  <div className="font-semibold text-gray-900">Filter by User</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {selectedUserIds.size === 0 
                      ? 'Showing all users' 
                      : `Showing ${selectedUserIds.size} user${selectedUserIds.size !== 1 ? 's' : ''}`
                    }
                  </div>
                </div>
                
                {uniqueUsers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                    No users to filter
                  </div>
                ) : (
                  <div className="py-1">
                    {uniqueUsers.map((user) => {
                      const isSelected = selectedUserIds.has(user.id);
                      const userColor = getUserColor(user.id);
                      const userInitials = getUserInitials(user.name);
                      
                      return (
                        <button
                          key={user.id}
                          onClick={() => onToggleUserFilter(user.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-900'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* User avatar with initials */}
                          <div 
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: userColor }}
                          >
                            {userInitials}
                          </div>
                          
                          {/* User info */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-sm truncate">{user.name}</div>
                          </div>
                          
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected 
                              ? 'bg-blue-500 border-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {selectedUserIds.size > 0 && (
                  <div className="px-2 py-2 border-t border-gray-200">
                    <button
                      onClick={() => {
                        uniqueUsers.forEach(user => {
                          if (selectedUserIds.has(user.id)) {
                            onToggleUserFilter(user.id);
                          }
                        });
                      }}
                      className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend for parks/trails (only show on outdoors style) */}
        {mapStyle === 'outdoors' && (
          <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-lg p-3 text-xs z-10">
            <div className="font-semibold text-gray-800 mb-2">Map Legend</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                <span className="text-gray-700">Parks & Recreation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-orange-500"></div>
                <span className="text-gray-700">Trails & Paths</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1)' }}></div>
                <span className="text-gray-700">Memo Locations</span>
              </div>
            </div>
          </div>
        )}

        {/* Render sleek waypoint markers with initials */}
        {memos.map((memo) => {
          if (!memo.location) return null;

          const markerColor = getUserColor(memo.user_id);
          const initials = getUserInitials(memo.user_name);
          
          // Create a lighter tint for gradient
          const lighterColor = markerColor.replace('50%', '65%');
          
          const isEditing = editingMemoId === memo.memo_id;
          
          // Use temp location if this marker is being edited, otherwise use memo location
          const markerLat = isEditing && tempEditedLocation ? tempEditedLocation.lat : memo.location.latitude;
          const markerLng = isEditing && tempEditedLocation ? tempEditedLocation.lng : memo.location.longitude;

          return (
            <Marker
              key={memo.memo_id}
              latitude={markerLat}
              longitude={markerLng}
              anchor="bottom"
              draggable={isEditing}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (!isEditing) {
                  handleMarkerClick(memo);
                }
              }}
              onDragEnd={(e) => {
                if (isEditing && onMarkerDrag) {
                  onMarkerDrag(memo.memo_id, e.lngLat.lat, e.lngLat.lng);
                }
              }}
            >
              {/* Professional waypoint badge */}
              <div
                className={`waypoint-marker ${isEditing ? 'cursor-move' : 'cursor-pointer'}`}
                style={{
                  width: '44px',
                  height: '52px',
                  position: 'relative',
                  filter: isEditing 
                    ? 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.5))'
                    : 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
                  transform: isEditing ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg
                  width="44"
                  height="52"
                  viewBox="0 0 44 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    {/* Gradient for depth */}
                    <linearGradient id={`grad-${memo.memo_id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: lighterColor, stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: markerColor, stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  
                  {/* Outer ring for depth */}
                  <path
                    d="M22 3L39 9.5V24C39 32.5 34.5 39 22 47.5C9.5 39 5 32.5 5 24V9.5L22 3Z"
                    fill="white"
                    opacity="0.95"
                  />
                  
                  {/* Main shield with gradient */}
                  <path
                    d="M22 5L37 10.5V24C37 31.5 33 37.5 22 45.5C11 37.5 7 31.5 7 24V10.5L22 5Z"
                    fill={`url(#grad-${memo.memo_id})`}
                    stroke={isEditing ? '#3b82f6' : 'white'}
                    strokeWidth={isEditing ? '3' : '2'}
                    strokeLinejoin="round"
                  />
                  
                  {/* Pin point */}
                  <path
                    d="M22 45.5L22 49L19.5 47L22 45.5L24.5 47L22 49Z"
                    fill={markerColor}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </svg>

                {/* Initials with modern styling */}
                <div
                  style={{
                    position: 'absolute',
                    top: '15px',
                    left: '0',
                    width: '44px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '700',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
                      letterSpacing: '1px',
                    }}
                  >
                    {initials}
                  </span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Popup */}
        {popupInfo && popupInfo.location && (
          <Popup
            latitude={popupInfo.location.latitude}
            longitude={popupInfo.location.longitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            offset={[0, -45] as [number, number]}
            maxWidth="300px"
          >
            <div className="p-2">
              <div className="flex items-start gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full mt-1"
                  style={{ backgroundColor: getUserColor(popupInfo.user_id) }}
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{popupInfo.user_name}</h3>
                  {popupInfo.park_name && (
                    <p className="text-sm text-green-700 font-medium">
                      📍 {popupInfo.park_name}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                {popupInfo.text}
              </p>
              <button
                onClick={() => handleViewDetails(popupInfo)}
                className="w-full mt-3 text-blue-600 text-sm hover:bg-blue-50 font-medium py-2 px-3 rounded transition-colors"
              >
                View Full Details →
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};
