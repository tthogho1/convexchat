import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface LandmarkTarget {
  latitude: number;
  longitude: number;
  displayName: string;
  // Bumped on every successful search so the map re-flies even when the user
  // searches the same landmark twice.
  key: number;
}

interface LandmarkSearchProps {
  onLocate: (target: LandmarkTarget) => void;
}

export function LandmarkSearch({ onLocate }: LandmarkSearchProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocode = useAction(api.geocode.landmark);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch();
  };

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await geocode({ query: trimmed });
      if (!result) {
        setError(`No match for "${trimmed}"`);
        return;
      }
      onLocate({ ...result, key: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800
                 border-b-2 border-gray-200 dark:border-gray-700"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Go to a landmark (e.g. 東京タワー)"
        className="flex-1 px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                   focus:outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
        maxLength={200}
      />
      <button
        type="submit"
        disabled={!query.trim() || isLoading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white
                   font-semibold px-4 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap"
      >
        {isLoading ? 'Searching…' : 'Go'}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400 truncate">{error}</span>
      )}
    </form>
  );
}
