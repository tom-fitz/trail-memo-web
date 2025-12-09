import React, { useState, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, ScaleControl, Layer, Source } from 'react-map-gl';
import { Layers } from 'lucide-react';
import { Memo } from '@/types/memo';
import { getUserColor } from '@/lib/utils/formatters';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  memos: Memo[];
  onMemoClick: (memo: Memo) => void;
  selectedMemoId?: string | null;
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
  selectedMemoId,
}) => {
  // Default map center (can be configured via env)
  const defaultLat = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '45.6789');
  const defaultLng = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '-111.0517');
  const defaultZoom = parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM || '12');

  const [popupInfo, setPopupInfo] = useState<Memo | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('outdoors');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  
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

  return (
    <div className="h-full w-full relative">
      <Map
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLES[mapStyle].url}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        maxZoom={22}
        minZoom={1}
        // Optimized settings for outdoor/park use
        terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }} // Show terrain elevation
        fog={{}} // Add atmospheric fog for depth
      >
        {/* Map Controls */}
        <NavigationControl position="top-right" showCompass={true} />
        <ScaleControl position="bottom-right" />

        {/* Style Selector Button */}
        <div className="absolute top-4 left-4 z-10">
          <div className="relative">
            <button
              onClick={() => setShowStyleSelector(!showStyleSelector)}
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

        {/* Render memo markers */}
        {memos.map((memo) => {
          if (!memo.location) return null;

          const markerColor = getUserColor(memo.user_id);

          return (
            <Marker
              key={memo.memo_id}
              latitude={memo.location.latitude}
              longitude={memo.location.longitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(memo);
              }}
            >
              {/* Custom colored marker with enhanced visibility */}
              <div
                className="cursor-pointer transition-transform hover:scale-110 drop-shadow-lg"
                style={{
                  width: '30px',
                  height: '45px',
                }}
              >
                <svg
                  viewBox="0 0 30 45"
                  width="30"
                  height="45"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Shadow for better visibility */}
                  <ellipse
                    cx="15"
                    cy="42"
                    rx="8"
                    ry="3"
                    fill="rgba(0,0,0,0.3)"
                  />
                  {/* Main pin */}
                  <path
                    d="M15 0C9.5 0 5 4.5 5 10c0 7.5 10 25 10 25s10-17.5 10-25c0-5.5-4.5-10-10-10z"
                    fill={markerColor}
                    stroke="white"
                    strokeWidth="2.5"
                  />
                  {/* Inner circle */}
                  <circle cx="15" cy="10" r="4" fill="white" />
                </svg>
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
