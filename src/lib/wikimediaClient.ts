import {
  Landmark,
  WikimediaCirrusSearchResponse,
  WikimediaPageDetailsResponse,
  LandmarkQueryParams,
} from '../types/landmark';

const WIKIMEDIA_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

/**
 * Search-only function: returns lightweight results with coordinates (no thumbnails)
 */
export async function searchLandmarksNearby(params: LandmarkQueryParams): Promise<Landmark[]> {
  const { lat, lon, radius = 10000, limit = 10 } = params;
  // Cirrus search: request up to `limit` results and also request coordinates for those pages
  const searchQuery = `nearcoord:${Math.round(radius / 1000)}km,${lat},${lon}`; // loosened filter to increase hits
  const gsrlimit = Math.min(limit, 500).toString();

  const searchParams = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: searchQuery,
    gsrlimit,
    prop: 'coordinates|description',
    colimit: gsrlimit,
    format: 'json',
    origin: '*',
  });

  const url = `${WIKIMEDIA_ENDPOINT}?${searchParams.toString()}`;

  try {
    const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const result: WikimediaPageDetailsResponse & WikimediaCirrusSearchResponse = await resp.json();
    if (result.error) {
      console.error('Wikimedia search error:', result.error);
      return [];
    }
    if (!result.query?.pages) return [];

    const landmarks: Landmark[] = Object.values(result.query.pages)
      .filter(p => p.coordinates && p.coordinates.length > 0)
      .map(p => ({
        pageId: p.pageid,
        title: p.title,
        lat: p.coordinates![0].lat,
        lon: p.coordinates![0].lon,
        thumbnailUrl: null,
        thumbnailWidth: null,
        thumbnailHeight: null,
        description: p.description,
      }));

    return landmarks.slice(0, limit);
  } catch (err) {
    console.error('searchLandmarksNearby failed:', err);
    return [];
  }
}

/**
 * Fetch full details for a single page when the user opens a popup
 */
export async function fetchLandmarkDetails(pageId: number): Promise<Partial<Landmark> | null> {
  const params = new URLSearchParams({
    action: 'query',
    pageids: pageId.toString(),
    prop: 'pageimages|coordinates|description',
    piprop: 'thumbnail',
    pithumbsize: '200',
    format: 'json',
    origin: '*',
  });

  const url = `${WIKIMEDIA_ENDPOINT}?${params.toString()}`;

  try {
    const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const result: WikimediaPageDetailsResponse = await resp.json();
    if (result.error) {
      console.error('fetchLandmarkDetails error:', result.error);
      return null;
    }
    const pages = result.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page) return null;

    return {
      pageId: page.pageid,
      title: page.title,
      lat: page.coordinates?.[0]?.lat,
      lon: page.coordinates?.[0]?.lon,
      thumbnailUrl: page.thumbnail?.source || null,
      thumbnailWidth: page.thumbnail?.width || null,
      thumbnailHeight: page.thumbnail?.height || null,
      description: page.description,
    };
  } catch (err) {
    console.error('fetchLandmarkDetails failed:', err);
    return null;
  }
}
