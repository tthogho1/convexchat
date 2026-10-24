import { useState } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Doc } from '../../convex/_generated/dataModel';
import { distanceMeters, formatDistance, usePlaceActions } from '../lib/placeActions';
import { meetingPinIcon } from './icon/MeetingPinIcon';

interface MemberLocation {
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
}

interface MeetingPinsLayerProps {
  pins: Doc<'pins'>[];
  // Already group-filtered (from getLocationsForGroup), so distances cover
  // exactly the people who can see the pin.
  locations: MemberLocation[];
  currentUserId: string;
}

export function MeetingPinsLayer({ pins, locations, currentUserId }: MeetingPinsLayerProps) {
  return (
    <>
      {pins.map((pin) => (
        <Marker key={pin._id} position={[pin.latitude, pin.longitude]} icon={meetingPinIcon}>
          <Popup>
            <PinPopup pin={pin} locations={locations} currentUserId={currentUserId} />
          </Popup>
        </Marker>
      ))}
      <DropPin />
    </>
  );
}

function PinPopup({
  pin,
  locations,
  currentUserId,
}: {
  pin: Doc<'pins'>;
  locations: MemberLocation[];
  currentUserId: string;
}) {
  const map = useMap();
  const { sharePlace, removePin } = usePlaceActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = locations
    .map((loc) => ({ ...loc, meters: distanceMeters(loc, pin) }))
    .sort((a, b) => a.meters - b.meters);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      map.closePopup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minWidth: 160, maxWidth: 220 }}>
      <div className="text-center">
        <strong>📌 {pin.name}</strong>
        <div className="text-xs text-gray-500">
          Set by {pin.username} · {new Date(pin.createdAt).toLocaleTimeString()}
        </div>
      </div>
      {members.length > 0 && (
        <ul className="text-xs mt-2 space-y-0.5">
          {members.map((m) => (
            <li key={m.userId} className="flex justify-between gap-2">
              <span className={m.userId === currentUserId ? 'font-semibold text-blue-600' : ''}>
                {m.userId === currentUserId ? 'You' : m.username}
              </span>
              <span className="text-gray-600">{formatDistance(m.meters)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1 justify-center mt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(() => sharePlace({ name: pin.name, latitude: pin.latitude, longitude: pin.longitude }))
          }
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded"
        >
          💬 Share
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removePin(pin._id))}
          className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-2 py-1 rounded"
        >
          Remove
        </button>
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

// Right-click (desktop) or long-press (touch; Leaflet maps it to
// `contextmenu`) anywhere on the map to drop a named meeting point.
function DropPin() {
  const map = useMap();
  const { setMeetingPoint } = usePlaceActions();
  // Stored as a tuple (not rebuilt in render) so its identity is stable:
  // react-leaflet's Popup re-runs its open/remove effect whenever `position`
  // changes identity, which would close the popup on every keystroke.
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMapEvents({
    contextmenu: (e) => {
      setPosition([e.latlng.lat, e.latlng.lng]);
      setName('');
      setError(null);
    },
  });

  if (!position) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setMeetingPoint({ name: trimmed, latitude: position[0], longitude: position[1] });
      map.closePopup();
      setPosition(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popup position={position} eventHandlers={{ remove: () => setPosition(null) }}>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ minWidth: 180 }}>
        <div className="text-xs font-semibold mb-1">New meeting point</div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Station east exit"
          maxLength={100}
          className="w-full text-xs px-2 py-1 border rounded mb-1"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="w-full text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-2 py-1 rounded"
        >
          📌 Set meeting point
        </button>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </form>
    </Popup>
  );
}
