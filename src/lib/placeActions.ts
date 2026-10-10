import { createContext, useContext } from 'react';
import L from 'leaflet';
import { Id } from '../../convex/_generated/dataModel';

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

// Group-scoped actions available from any map popup. Provided once in App so
// popups deep inside react-leaflet layers (Wikipedia landmarks, searched
// landmark, dropped pins) don't need handlers threaded through as props.
export interface PlaceActionsValue {
  setMeetingPoint: (place: Place) => Promise<void>;
  sharePlace: (place: Place) => Promise<void>;
  removePin: (pinId: Id<'pins'>) => Promise<void>;
}

export const PlaceActionsContext = createContext<PlaceActionsValue | null>(null);

export function usePlaceActions(): PlaceActionsValue {
  const value = useContext(PlaceActionsContext);
  if (!value) throw new Error('usePlaceActions must be used inside PlaceActionsContext');
  return value;
}

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  return L.latLng(a.latitude, a.longitude).distanceTo(L.latLng(b.latitude, b.longitude));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}
