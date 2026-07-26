import { v } from 'convex/values';
import { action } from './_generated/server';

// Geocode a landmark name to coordinates using OpenStreetMap's Nominatim.
//
// This runs server-side (rather than from the browser) because Nominatim's
// usage policy requires an identifying User-Agent, which browsers refuse to
// let scripts set. Keeping it here also avoids CORS and lets us throttle in
// one place if needed.
//
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'convexchat-mapchat/1.0 (https://convexchat.fly.dev)';

export const landmark = action({
  args: {
    query: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      latitude: v.number(),
      longitude: v.number(),
      displayName: v.string(),
    }),
  ),
  handler: async (_ctx, { query }) => {
    const trimmed = query.trim();
    if (!trimmed) return null;

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    // Ask for a few candidates so a slightly ambiguous name still resolves;
    // we take the top hit, which Nominatim already ranks by importance.
    url.searchParams.set('limit', '5');

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Geocoding failed with status ${res.status}`);
    }

    const results = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];

    const best = results[0];
    if (!best) return null;

    const latitude = Number(best.lat);
    const longitude = Number(best.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude, displayName: best.display_name };
  },
});
