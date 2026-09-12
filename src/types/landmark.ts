// Shapes for the Wikimedia (MediaWiki action API) geosearch + page-details
// calls used by `src/lib/wikimediaClient.ts`.

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LandmarkQueryParams {
  lat: number;
  lon: number;
  boundingBox?: BoundingBox;
  /** Search radius in meters (default 10000). */
  radius?: number;
  limit?: number;
}

export interface Landmark {
  pageId: number;
  title: string;
  lat: number;
  lon: number;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  description?: string;
}

export interface WikimediaCoordinate {
  lat: number;
  lon: number;
  primary?: string;
  globe?: string;
}

export interface WikimediaThumbnail {
  source: string;
  width: number;
  height: number;
}

export interface WikimediaPage {
  pageid: number;
  ns?: number;
  title: string;
  coordinates?: WikimediaCoordinate[];
  description?: string;
  thumbnail?: WikimediaThumbnail;
}

export interface WikimediaApiError {
  code: string;
  info: string;
}

export interface WikimediaCirrusSearchResponse {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
  error?: WikimediaApiError;
}

export interface WikimediaPageDetailsResponse {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
  error?: WikimediaApiError;
}
