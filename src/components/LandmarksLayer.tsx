import { useCallback, useEffect, useRef, useState } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { searchLandmarksNearby, fetchLandmarkDetails } from '../lib/wikimediaClient';
import type { Landmark } from '../types/landmark';
import { poiIcon } from './icon/LandmarkPoiIcon';

// Search radius: distance from the map center to the viewport edge, so
// panning/zooming naturally widens or narrows the search. Wikimedia's
// nearcoord search caps out well beyond this, but a huge radius on a
// zoomed-out map returns mostly-irrelevant results, so we still cap it.
function radiusForViewport(map: L.Map): number {
  const bounds = map.getBounds();
  const center = map.getCenter();
  const edge = L.latLng(center.lat, bounds.getEast());
  return Math.min(10000, Math.max(300, Math.round(center.distanceTo(edge))));
}

const MAX_LANDMARKS = 25;
const FETCH_DEBOUNCE_MS = 500;

// Fetches nearby Wikimedia landmarks around the current map viewport and
// renders them as markers. Runs its own debounced search on `moveend` so it
// stays independent of the person-location markers in MapView.
export function LandmarksLayer() {
  const map = useMap();
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [details, setDetails] = useState<Record<number, Partial<Landmark>>>({});
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const center = map.getCenter();
    const radius = radiusForViewport(map);

    void searchLandmarksNearby({
      lat: center.lat,
      lon: center.lng,
      radius,
      limit: MAX_LANDMARKS,
    }).then((results) => {
      // Ignore stale responses from a since-superseded map move.
      if (requestId !== requestIdRef.current) return;
      setLandmarks(results);
    });
  }, [map]);

  const scheduleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSearch, FETCH_DEBOUNCE_MS);
  }, [runSearch]);

  // Initial load.
  useEffect(() => {
    scheduleSearch();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scheduleSearch]);

  useMapEvents({ moveend: scheduleSearch });

  const handlePopupOpen = (pageId: number) => {
    if (details[pageId]) return;
    void fetchLandmarkDetails(pageId).then((detail) => {
      if (!detail) return;
      setDetails((prev) => ({ ...prev, [pageId]: detail }));
    });
  };

  return (
    <>
      {landmarks.map((landmark) => {
        const thumbnailUrl = details[landmark.pageId]?.thumbnailUrl ?? landmark.thumbnailUrl;
        return (
          <Marker
            key={landmark.pageId}
            position={[landmark.lat, landmark.lon]}
            icon={poiIcon}
            eventHandlers={{ popupopen: () => handlePopupOpen(landmark.pageId) }}
          >
            <Popup>
              <div className="text-center" style={{ maxWidth: 180 }}>
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={landmark.title}
                    className="mx-auto mb-1 rounded"
                    style={{ maxWidth: '100%', maxHeight: 120 }}
                  />
                )}
                <strong>{landmark.title}</strong>
                {landmark.description && (
                  <div className="text-xs text-gray-500 mt-1">{landmark.description}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
