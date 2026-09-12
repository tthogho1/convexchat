import L from 'leaflet';

// Distinct from the "go to searched landmark" pin in MapView: amber instead
// of red. Slightly smaller than the person markers since there can be many
// of these on screen.
export const poiIcon = L.divIcon({
  className: 'landmark-poi-marker',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
         fill="#d97706" stroke="#ffffff" stroke-width="1.5" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" />
      <circle cx="12" cy="9" r="2.2" fill="#ffffff" stroke="none" />
    </svg>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -30],
});
