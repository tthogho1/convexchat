import L from 'leaflet';

// Build a circular “person” marker as a Leaflet divIcon. Uses an inline SVG
// so we don't need any external image assets. `color` controls the ring/fill.
export function createPersonIcon(color: string, isCurrentUser: boolean): L.DivIcon {
  const size = isCurrentUser ? 40 : 36;
  const ringWidth = isCurrentUser ? 3 : 2;
  // NOTE: `box-sizing:content-box` is important — Tailwind v4's preflight
  // sets `* { box-sizing: border-box }` globally, which would otherwise
  // shrink the visible avatar by 2*ringWidth. We want `width`/`height` to
  // describe the avatar circle, with the white border drawn OUTSIDE.
  const html = `
    <div style="
      box-sizing:content-box;
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:${ringWidth}px solid #ffffff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      ${isCurrentUser ? 'outline:3px solid rgba(31,111,235,0.35);outline-offset:1px;' : ''}
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(size * 0.6)}" height="${Math.round(size * 0.6)}" viewBox="0 0 24 24" fill="#ffffff" style="display:block;">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8v1H4v-1z" />
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'person-marker',
    // Account for the white ring so the icon's bounding box matches what
    // we actually render. iconAnchor stays at the visual center.
    iconSize: [size + ringWidth * 2, size + ringWidth * 2],
    iconAnchor: [(size + ringWidth * 2) / 2, (size + ringWidth * 2) / 2],
    popupAnchor: [0, -(size / 2 + ringWidth)],
  });
}

// Pick a stable color per user so each person keeps the same avatar color
// across renders / sessions.
export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const palette = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  ];
  return palette[hash % palette.length];
}
