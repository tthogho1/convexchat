import { useState, useRef, useEffect } from 'react';

const SEARCH_API_URL = import.meta.env.VITE_SEARCH_API_URL ;

interface SearchResult {
  title: string;
  content: string;
}

interface SearchResponse {
  results: SearchResult[];
  summary: string;
}

export function WikivoyageChat() {
  const [query, setQuery] = useState('');
  const [numResults, setNumResults] = useState(3);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new results arrive
  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(SEARCH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, numResults }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as SearchResponse;
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Collapsed state: show a floating icon button, right-aligned and stacked
  // above the Chat icon so the two don't overlap.
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed right-2 sm:right-4 bottom-20 sm:bottom-24 w-14 h-14 rounded-full
                   bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl
                   flex items-center justify-center transition-colors"
        style={{ zIndex: 9999 }}
        title="Open Wikivoyage search"
        aria-label="Open Wikivoyage search"
      >
        {/* Search icon */}
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
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-0 right-0 left-0 sm:left-auto m-2 sm:m-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl
                  border-2 border-gray-200 dark:border-gray-700 transition-all duration-300
                  z-50 w-auto sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-96
                  h-[min(500px,calc(100vh-1rem))] sm:h-[500px]`}
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b-2 border-gray-200
                    dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          <span className="font-semibold text-gray-900 dark:text-white">Wikivoyage</span>
        </div>
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          −
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* Results */}
          <div className="h-[calc(100%-7.5rem)] sm:h-[380px] overflow-y-auto p-4 space-y-3">
            {isLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400">Searching…</div>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {response?.summary && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm">
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Summary
                </div>
                {response.summary}
              </div>
            )}

            {response?.results.map((result, idx) => (
              <div
                key={idx}
                className="bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 rounded-lg"
              >
                <div className="font-semibold text-sm mb-1">{result.title}</div>
                <div className="text-xs whitespace-pre-line text-gray-700 dark:text-gray-300">
                  {result.content}
                </div>
              </div>
            ))}

            {!isLoading && !error && !response && (
              <div className="text-sm text-gray-400 text-center mt-8">
                Ask about places to visit ✈️
              </div>
            )}

            <div ref={resultsEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="best places to visit in Japan"
                className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-emerald-500 dark:bg-slate-700 dark:text-white text-sm"
                maxLength={500}
              />
              <select
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
                className="px-2 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-slate-700 dark:text-white text-sm"
                title="Number of results"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400
                         text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                {isLoading ? '…' : 'Search'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
