// Geospatial address search — see api-doc/geo/README.md.
// `GET /api/geo/search` turns free-form text into ranked GeoAddress candidates;
// `GET /api/geo/reverse` turns a coordinate into one candidate. The selected
// candidate is stored (with the user's `raw_input`) as the canonical `geo` on an
// address. Geo is off the critical path — failures should never block a save.

/** GeoJSON point: coordinates are [longitude, latitude]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

/** Structured admin breakdown — every part nullable. */
export interface GeoAddressComponents {
  street?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  /** ISO-3166-1 alpha-2. */
  country_code?: string | null;
  postal_code?: string | null;
}

/** A search/reverse candidate — the GeoAddress shape minus `raw_input`/`resolved_at`. */
export interface GeoAddressCandidate {
  formatted_address: string;
  coordinates: GeoPoint;
  provider?: string | null;
  provider_place_id?: string | null;
  components?: GeoAddressComponents | null;
}

/**
 * A stored geo address: a candidate plus the user's raw query. `resolved_at` is
 * server-assigned and must NOT be sent back (it is stripped before submit).
 */
export interface GeoAddress extends GeoAddressCandidate {
  raw_input?: string;
  resolved_at?: string;
}

// ─── Endpoint payloads ─────────────────────────────────────────────────────

export interface GeoSearchResponseData {
  provider: string;
  query: string;
  results: GeoAddressCandidate[];
}

export interface GeoReverseResponseData {
  provider: string;
  result: GeoAddressCandidate | null;
}

export interface GeoSearchParams {
  q: string;
  /** Max candidates (1–20). Provider default (5) when omitted. */
  limit?: number;
  /** Comma-separated ISO-3166-1 alpha-2 bias, e.g. `cm,ng`. */
  country?: string;
  /** Preferred result language, BCP-47 (e.g. `fr`). */
  lang?: string;
}
