import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}

export function useGeolocation(userId: Id<'users'> | null, intervalSeconds: number = 5) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
  });

  const updateLocation = useMutation(api.myFunctions.updateLocation);

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(() => ({
        latitude: null,
        longitude: null,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    // Function to get and send location
    const updatePosition = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setState(() => ({ latitude, longitude, error: null }));

          console.log('[useGeolocation] got position', { userId, latitude, longitude });

          // Send to Convex
          console.log('[useGeolocation] sending location to server', { userId, latitude, longitude });
          void updateLocation({ userId, latitude, longitude }).catch((err) => {
            console.error('[useGeolocation] Failed to update location:', err);
          });
        },
        (error) => {
          console.error('[useGeolocation] geolocation error', error.message);
          setState(() => ({
            latitude: null,
            longitude: null,
            error: error.message,
          }));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    };

    // Get initial position
    updatePosition();

    // Set up interval for regular updates
    const intervalId = setInterval(updatePosition, intervalSeconds * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [userId, intervalSeconds, updateLocation]);

  return state;
}
