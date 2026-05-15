import { useEffect, useRef, useState } from 'react';
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

  // StrictMode dedup: track whether the watcher is already running for this
  // hook instance, plus a deferred cleanup id so a fast unmount→remount cycle
  // (React 18 StrictMode dev double-invocation) can be coalesced into one
  // logical subscription instead of two parallel geolocation requests.
  const startedRef = useRef(false);
  const pendingCleanupRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    // If a deferred cleanup from a StrictMode-triggered unmount is pending,
    // cancel it: we're remounting and want to keep the existing watcher.
    if (pendingCleanupRef.current !== null) {
      window.clearTimeout(pendingCleanupRef.current);
      pendingCleanupRef.current = null;
    }
    if (startedRef.current) {
      // Already running — don't start a second watchPosition.
      return;
    }
    startedRef.current = true;

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

    let lastSentAt = 0;
    // Cache the most recent coords so a heartbeat timer can re-send them
    // even when watchPosition stops firing (common on stationary desktops).
    let lastCoords: { latitude: number; longitude: number } | null = null;

    const sendToServer = (latitude: number, longitude: number) => {
      lastSentAt = Date.now();
      console.log('[useGeolocation] sending location to server', { userId, latitude, longitude });
      void updateLocation({ userId, latitude, longitude }).catch((err) => {
        console.error('[useGeolocation] Failed to update location:', err);
      });
    };

    const handleSuccess: PositionCallback = (position) => {
      const { latitude, longitude } = position.coords;
      lastCoords = { latitude, longitude };
      setState(() => ({ latitude, longitude, error: null }));

      // Throttle server updates from watchPosition to roughly the desired
      // interval; the heartbeat below guarantees we keep the row alive.
      const now = Date.now();
      if (now - lastSentAt < intervalSeconds * 1000) return;
      sendToServer(latitude, longitude);
    };

    const handleError: PositionErrorCallback = (error) => {
      const codeName =
        error.code === error.PERMISSION_DENIED
          ? 'Permission denied'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Position unavailable'
            : error.code === error.TIMEOUT
              ? 'Timeout expired (no GPS fix yet)'
              : 'Unknown error';
      console.error('[useGeolocation] geolocation error', { code: error.code, message: error.message });
      // Keep previous coordinates if we already had a fix; only update the error.
      setState((prev) => ({
        latitude: prev.latitude,
        longitude: prev.longitude,
        error: `${codeName}${error.message ? `: ${error.message}` : ''}`,
      }));
    };

    const options: PositionOptions = {
      // Desktop browsers (incl. Comet/Chromium) often have no GPS and rely on
      // Wi-Fi/IP lookup which can be slow on the first call. Give it more time
      // and allow a recent cached fix to satisfy quick re-reads.
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: intervalSeconds * 1000,
    };

    // Subscribe to position changes. watchPosition fires its callback once
    // shortly after registration with the current position, so we don't need
    // a separate getCurrentPosition() call (which would be a duplicate
    // network/location lookup on desktop browsers).
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    // Heartbeat: every `intervalSeconds`, re-send the last known coords so
    // the server-side cleanup cron (which deletes locations older than ~60s)
    // doesn't remove us from the map while we're stationary.
    const heartbeatId = window.setInterval(() => {
      if (!lastCoords) return;
      const now = Date.now();
      // Avoid double-send right after a watchPosition tick.
      if (now - lastSentAt < intervalSeconds * 1000) return;
      sendToServer(lastCoords.latitude, lastCoords.longitude);
    }, intervalSeconds * 1000);

    const teardown = () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeatId);
      startedRef.current = false;
    };

    return () => {
      // Defer real teardown so React 18 StrictMode's synchronous
      // unmount→remount in dev doesn't cause us to clear the watch and
      // immediately re-create it (which would issue two geolocation requests
      // in quick succession). On a real unmount, no remount happens within
      // the delay, so teardown executes normally.
      pendingCleanupRef.current = window.setTimeout(() => {
        pendingCleanupRef.current = null;
        teardown();
      }, 200);
    };
  }, [userId, intervalSeconds, updateLocation]);

  return state;
}
