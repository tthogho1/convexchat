import L from 'leaflet';

// Green flag marker for group meeting points, distinct from the red searched
// landmark pin and the amber Wikipedia POI pins.
export const meetingPinIcon = L.divIcon({
  className: 'meeting-pin-marker',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"
         style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
      <line x1="5" y1="2" x2="5" y2="23" stroke="#14532d" stroke-width="2" stroke-linecap="round" />
      <path d="M6 3h13l-3 4.5 3 4.5H6z" fill="#16a34a" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" />
    </svg>
  `,
  iconSize: [36, 36],
  iconAnchor: [7, 34],
  popupAnchor: [10, -30],
});
