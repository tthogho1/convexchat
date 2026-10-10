import { useState } from 'react';
import { useMap } from 'react-leaflet';
import { usePlaceActions, type Place } from '../lib/placeActions';

// "Meeting point" / "Share" buttons shown inside a map popup for any place.
export function PlaceActions({ place }: { place: Place }) {
  const map = useMap();
  const { setMeetingPoint, sharePlace } = usePlaceActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: (p: Place) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action(place);
      map.closePopup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-1 justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(setMeetingPoint)}
          className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-2 py-1 rounded"
          title="Set as a meeting point for your group"
        >
          📌 Meeting point
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(sharePlace)}
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded"
          title="Share this place in group chat"
        >
          💬 Share
        </button>
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
