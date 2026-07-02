import { useCallback, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export const useGeolocation = () => {
  const supported = 'geolocation' in navigator;
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback((): Promise<GeoPosition> => {
    setError(null);
    if (!('geolocation' in navigator)) {
      const message = 'Location is not supported by this browser.';
      setError(message);
      return Promise.reject(new Error(message));
    }
    setIsLocating(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          setIsLocating(false);
          const message =
            err.code === err.PERMISSION_DENIED
              ? 'Location access was denied. Enable it in your browser settings.'
              : 'Could not get your location. Try again.';
          setError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }, []);

  return { supported, locate, isLocating, error };
};
