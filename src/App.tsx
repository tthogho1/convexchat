import { useState } from 'react';
import { useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { UsernameInput } from './components/UsernameInput';
import { MapView } from './components/MapView';
import { Chat } from './components/Chat';
import { WikivoyageChat } from './components/WikivoyageChat';
import { VideoChat } from './components/VideoChat';
import { LandmarkSearch, type LandmarkTarget } from './components/LandmarkSearch';
import { useGeolocation } from './hooks/useGeolocation';

// Do not persist username/userId to localStorage; keep in-memory only

// Build the HTTP Actions origin from the Convex deployment URL.
// Convex serves regular API calls on `*.convex.cloud` and HTTP actions on
// `*.convex.site` (same deployment, different host). Locally (`127.0.0.1`)
// HTTP actions are exposed on the same origin.
function getConvexHttpUrl(path: string): string {
  const base = (import.meta.env.VITE_CONVEX_URL ?? '') as string;
  if (!base) return path;
  const url = base.replace('.convex.cloud', '.convex.site');
  return url.replace(/\/$/, '') + path;
}

// Best-effort: tell the server to delete this user. Used by the explicit
// Logout button (where we can await) AND by `pagehide` (where we must use
// sendBeacon because the page is being torn down).
function beaconDeleteUser(userId: string): void {
  try {
    const url = getConvexHttpUrl('/deleteUser');
    const body = JSON.stringify({ userId });
    // text/plain avoids a CORS preflight for sendBeacon.
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    const ok = navigator.sendBeacon(url, blob);
    if (!ok) {
      // Fallback: fire-and-forget fetch with keepalive.
      void fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[beaconDeleteUser] failed', e);
  }
}

export default function App() {
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<LandmarkTarget | null>(null);

  const createUser = useMutation(api.myFunctions.createUser);
  const deleteUser = useMutation(api.myFunctions.deleteUser);
  const locations = useQuery(api.myFunctions.getLocationsForGroup, {
    currentUserId: userId ?? undefined,
    currentUserGroup: group ?? undefined,
  }) ?? [];
  const users = useQuery(api.myFunctions.getUsers, {}) ?? [];

  // Use geolocation hook (updates every 5 seconds)
  const { latitude, longitude, error: geoError } = useGeolocation(userId, 5);

  // When the tab/browser is closed (or the user navigates away), fire a
  // beacon to delete the user. `pagehide` is more reliable than
  // `beforeunload` on mobile Safari / when the page is bfcached.
  useEffect(() => {
    if (!userId) return;
    const handler = () => {
      beaconDeleteUser(userId);
    };
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
    };
  }, [userId]);

  const handleUsernameSubmit = async (newUsername: string, newGroup?: string) => {
    try {
      const newUserId = await createUser({ username: newUsername, group: newGroup });
      setUsername(newUsername);
      setGroup(newGroup ?? null);
      setUserId(newUserId);
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    const idToDelete = userId;
    // Optimistically clear local state so the UI returns to the login screen
    // immediately; the server delete continues in the background.
    setUsername(null);
    setUserId(null);
    setGroup(null);
    if (idToDelete) {
      void deleteUser({ userId: idToDelete }).catch((err) => {
        console.error('[handleLogout] deleteUser failed', err);
      });
    }
  };

  // Show username input if not logged in
  if (!username || !userId) {
    return <UsernameInput onSubmit={handleUsernameSubmit} />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b-2 border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              MapChat
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{users.length} user{users.length !== 1 ? 's' : ''} online</span>
            </div>

            {/* Geolocation status */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {latitude && longitude ? (
                <span className="text-green-600 dark:text-green-400">
                  Location tracking active ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                </span>
              ) : geoError ? (
                <span className="text-red-600 dark:text-red-400">
                  Location error: {geoError}
                </span>
              ) : (
                <span>Requesting location access...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Logged in as <strong>{username}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Landmark search: flies the map to the entered place */}
      <LandmarkSearch onLocate={setLandmark} />

      {/* Map */}
      <main className="flex-1 relative">
        <MapView
          locations={locations}
          currentUserId={userId}
          liveLatitude={latitude}
          liveLongitude={longitude}
          landmark={landmark}
        />
      </main>

      {/* Chat */}
      <Chat userId={userId} userGroup={group} />

      {/* Wikivoyage search (chat-style) */}
      <WikivoyageChat />

      {/* Video chat (LiveKit) */}
      <VideoChat username={username} group={group} />
    </div>
  );
}
