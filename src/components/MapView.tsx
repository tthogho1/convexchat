import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createPersonIcon, colorForUserId } from './icon/PersonIcon';

interface Location {
  _id: string;
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  group?: string;
}

interface LandmarkTarget {
  latitude: number;
  longitude: number;
  displayName: string;
  key: number;
}

interface MapViewProps {
  locations: Location[];
  currentUserId: string;
  // Live coordinates from the browser Geolocation API. These drive the map
  // center immediately, without waiting for the Convex round-trip.
  liveLatitude?: number | null;
  liveLongitude?: number | null;
  // Set when the user searches a landmark; the map flies there.
  landmark?: LandmarkTarget | null;
}

// Leaflet's default marker pulls in PNG assets that break under bundlers, so
// draw the landmark pin as an inline-SVG divIcon like the person markers do.
const landmarkIcon = L.divIcon({
  className: 'landmark-marker',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
         fill="#dc2626" stroke="#ffffff" stroke-width="1.5" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" fill="#ffffff" stroke="none" />
    </svg>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -30],
});

// Fly to a searched landmark. Keyed on `landmark.key` (not the coordinates) so
// searching the same place twice still re-triggers the animation.
function FlyToLandmark({ landmark }: { landmark?: LandmarkTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!landmark) return;
    map.flyTo([landmark.latitude, landmark.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.75,
    });
  }, [landmark, map]);

  return null;
}

// Auto-center the map only the FIRST time we receive valid coordinates so
// the user can freely pan/zoom afterwards. Subsequent recentering is done
// manually via the RecenterButton, mimicking Google Maps' “my location” UX.
//
// Important: `lat`/`lng` may be `null`/`undefined` while we're still waiting
// for the browser geolocation fix. We must NOT center on the fallback
// default coordinates — otherwise the "first valid value" would be the
// default and we'd never move to the user's real location after login.
function InitialCenter({
  lat,
  lng,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
}) {
  const map = useMap();
  const didCenterRef = useRef(false);

  useEffect(() => {
    if (didCenterRef.current) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
    didCenterRef.current = true;
  }, [lat, lng, map]);

  return null;
}

// Floating button placed on the right side of the map. Clicking it animates
// the map back to the user's current location, like Google Maps.
function RecenterButton({
  lat,
  lng,
  disabled,
}: {
  lat: number;
  lng: number;
  disabled?: boolean;
}) {
  const map = useMap();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.75,
    });
  };

  // Stop Leaflet from interpreting clicks/scrolls on the button as map drags.
  const stopRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (stopRef.current) {
      L.DomEvent.disableClickPropagation(stopRef.current);
      L.DomEvent.disableScrollPropagation(stopRef.current);
    }
  }, []);

  return (
    <button
      ref={stopRef}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title="Center on my location"
      aria-label="Center on my location"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'white',
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Crosshair / “my location” icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1f6feb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" fill="#1f6feb" stroke="none" />
        <circle cx="12" cy="12" r="8" />
        <line x1="12" y1="1" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="23" />
        <line x1="1" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="23" y2="12" />
      </svg>
    </button>
  );
}

export function MapView({
  locations,
  currentUserId,
  liveLatitude,
  liveLongitude,
  landmark,
}: MapViewProps) {
  // Prefer the live browser coordinates (instant) over the server-echoed
  // location (delayed by the Convex round-trip). Fall back to the server
  // location, then to a default.
  const serverLocation = locations.find((loc) => loc.userId === currentUserId);
  const centerLat =
    typeof liveLatitude === 'number'
      ? liveLatitude
      : serverLocation?.latitude ?? 37.7749;
  const centerLng =
    typeof liveLongitude === 'number'
      ? liveLongitude
      : serverLocation?.longitude ?? -122.4194;
  const center: LatLngExpression = [centerLat, centerLng];

  const hasLiveCoords =
    typeof liveLatitude === 'number' && typeof liveLongitude === 'number';

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        style={{ background: '#e5e7eb' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InitialCenter
          lat={
            typeof liveLatitude === 'number'
              ? liveLatitude
              : serverLocation?.latitude ?? null
          }
          lng={
            typeof liveLongitude === 'number'
              ? liveLongitude
              : serverLocation?.longitude ?? null
          }
        />
        <RecenterButton lat={centerLat} lng={centerLng} disabled={!hasLiveCoords} />
        <FlyToLandmark landmark={landmark} />
        {landmark && (
          <Marker position={[landmark.latitude, landmark.longitude]} icon={landmarkIcon}>
            <Popup>
              <div className="text-center">
                <strong>{landmark.displayName}</strong>
              </div>
            </Popup>
          </Marker>
        )}
        {locations.map((location) => {
          const isCurrentUser = location.userId === currentUserId;
          const markerColor = isCurrentUser ? '#1f6feb' : colorForUserId(location.userId);
          const icon = createPersonIcon(markerColor, isCurrentUser);
          return (
            <Marker
              key={location._id}
              position={[location.latitude, location.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="text-center">
                  <strong className={isCurrentUser ? 'text-blue-600' : ''}>
                    {location.username}
                  </strong>
                  {isCurrentUser && <div className="text-sm text-blue-600">(You)</div>}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(location.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
