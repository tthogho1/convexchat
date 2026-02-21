import { useState } from 'react';

interface UsernameInputProps {
  onSubmit: (username: string, group?: string) => void;
}

export function UsernameInput({ onSubmit }: UsernameInputProps) {
  const [username, setUsername] = useState('');
  const [group, setGroup] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      const groupValue = group.trim() || undefined;
      onSubmit(username.trim(), groupValue);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Welcome to MapChat
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Enter your username to start tracking your location and chatting with others.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                     focus:outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white mb-4"
            maxLength={20}
            autoFocus
          />
          <input
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group (optional)"
            className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                     focus:outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white mb-4"
            maxLength={30}
          />
          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                     text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
