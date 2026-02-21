import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { UsernameInput } from './components/UsernameInput';
import { MapView } from './components/MapView';
import { Chat } from './components/Chat';
import { useGeolocation } from './hooks/useGeolocation';

// Do not persist username/userId to localStorage; keep in-memory only

export default function App() {
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);

  const createUser = useMutation(api.myFunctions.createUser);
  const locations = useQuery(api.myFunctions.getLocations) ?? [];
  const users = useQuery(api.myFunctions.getUsers) ?? [];

  // Use geolocation hook (updates every 5 seconds)
  const { latitude, longitude, error: geoError } = useGeolocation(userId, 5);

  const handleUsernameSubmit = async (newUsername: string, newGroup?: string) => {
    try {
      const payload: Record<string, unknown> = { username: newUsername };
      if (newGroup) payload.group = newGroup;
      const newUserId = await createUser(payload as any);
      setUsername(newUsername);
      setGroup(newGroup ?? null);
      setUserId(newUserId);
      // Do not persist credentials to localStorage; keep session in-memory
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleLogout = () => {
    setUsername(null);
    setUserId(null);
  };

  // Show username input if not logged in
  if (!username || !userId) {
    return <UsernameInput onSubmit={(name, grp) => void handleUsernameSubmit(name, grp)} />;
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

        {/* Status Messages */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
      </header>

      {/* Map */}
      <main className="flex-1 relative">
        <MapView locations={locations} currentUserId={userId} currentUserGroup={group ?? undefined} />
      </main>

      {/* Chat */}
      <Chat userId={userId} username={username} />
    </div>
  );
}
