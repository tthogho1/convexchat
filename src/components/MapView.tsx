import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Location {
  _id: string;
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  group?: string;
}

interface MapViewProps {
  locations: Location[];
  currentUserId: string;
  currentUserGroup?: string;
}

// Component to recenter map when user's location changes
function RecenterMap({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

export function MapView({ locations, currentUserId, currentUserGroup }: MapViewProps) {
  // Filter locations: show only users in the same group when currentUserGroup is provided,
  // but always include the current user's own location.
  const visibleLocations = locations.filter(
    (loc) => loc.userId === currentUserId || !currentUserGroup || loc.group === currentUserGroup,
  );

  // Find current user's location or use default
  const currentUserLocation = visibleLocations.find((loc) => loc.userId === currentUserId) ||
    locations.find((loc) => loc.userId === currentUserId);
  const center: LatLngExpression = currentUserLocation
    ? [currentUserLocation.latitude, currentUserLocation.longitude]
    : [37.7749, -122.4194]; // Default: San Francisco

  // Create custom icons for current user vs others
  const currentUserIcon = new L.Icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'current-user-marker',
  });

  return (
    <div className="w-full h-full">
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
        <RecenterMap center={center} />
        {visibleLocations.map((location) => {
          const isCurrentUser = location.userId === currentUserId;
          return (
            <Marker
              key={location._id}
              position={[location.latitude, location.longitude]}
              icon={isCurrentUser ? currentUserIcon : new L.Icon.Default()}
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
