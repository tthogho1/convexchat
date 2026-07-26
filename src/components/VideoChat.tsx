import { useState, useCallback } from 'react';
import { useAction } from 'convex/react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { api } from '../../convex/_generated/api';

interface Connection {
  token: string;
  url: string;
  room: string;
  identity: string;
}

interface VideoChatProps {
  username: string;
  group?: string | null;
}

export function VideoChat({ username, group }: VideoChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [room, setRoom] = useState(group?.trim() || 'demo-room');
  const [name, setName] = useState(username);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useAction(api.livekit.token);

  const handleJoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void (async () => {
        setError(null);
        setLoading(true);
        try {
          const displayName = name.trim() || username;
          const roomName = room.trim() || 'demo-room';
          // Keep identity unique so the same display name can join twice.
          const identity = `${displayName}-${Math.random().toString(36).slice(2, 8)}`;
          const data = await getToken({ room: roomName, identity, name: displayName });
          setConnection(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to join');
        } finally {
          setLoading(false);
        }
      })();
    },
    [room, name, username, getToken],
  );

  const handleDisconnect = useCallback(() => {
    setConnection(null);
  }, []);

  // Collapsed state: floating camera icon, stacked above the other panels.
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed right-2 sm:right-4 bottom-40 sm:bottom-44 w-14 h-14 rounded-full
                   bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl
                   flex items-center justify-center transition-colors"
        style={{ zIndex: 9999 }}
        title="Open video chat"
        aria-label="Open video chat"
      >
        {/* Video camera icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 left-0 sm:left-auto m-2 sm:m-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl
                 border-2 border-gray-200 dark:border-gray-700 transition-all duration-300
                 w-auto sm:w-[560px] max-w-[calc(100vw-1rem)]
                 h-[min(600px,calc(100vh-1rem))]"
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b-2 border-gray-200
                    dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
        onClick={() => setIsExpanded(false)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
          <span className="font-semibold text-gray-900 dark:text-white">Video Chat</span>
          {connection && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              · {connection.room}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connection && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDisconnect();
              }}
              className="text-xs text-red-500 hover:text-red-700 px-1"
              title="Leave room"
            >
              Leave
            </button>
          )}
          <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            −
          </button>
        </div>
      </div>

      {/* Body */}
      {connection ? (
        <div className="h-[calc(100%-3.5rem)]" data-lk-theme="default">
          <LiveKitRoom
            serverUrl={connection.url}
            token={connection.token}
            connect={true}
            video={true}
            audio={true}
            onDisconnected={handleDisconnect}
            style={{ height: '100%' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      ) : (
        <form
          onSubmit={handleJoin}
          className="p-4 space-y-3 h-[calc(100%-3.5rem)] flex flex-col justify-center"
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter a room name and display name to join.
          </p>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Room
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="demo-room"
              required
              className="mt-1 w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                       focus:outline-none focus:border-indigo-500 dark:bg-slate-700 dark:text-white text-sm"
            />
          </label>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Display name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1 w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                       focus:outline-none focus:border-indigo-500 dark:bg-slate-700 dark:text-white text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400
                     text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Connecting…' : 'Join room'}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
