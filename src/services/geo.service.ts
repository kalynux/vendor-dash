import { api, unwrapEnvelope } from './api';
import type {
  GeoSearchResponseData,
  GeoReverseResponseData,
  GeoAddressCandidate,
  GeoSearchParams,
} from '@/types/geo.types';

const BASE = '/geo';

/**
 * Turn free-form text into ranked candidate locations (`GET /api/geo/search`).
 * Geo is off the critical path — callers should treat errors as non-fatal.
 */
export async function searchAddresses(params: GeoSearchParams): Promise<GeoAddressCandidate[]> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.country) qs.set('country', params.country);
  if (params.lang) qs.set('lang', params.lang);
  const data = unwrapEnvelope<GeoSearchResponseData>(await api.get(`${BASE}/search?${qs.toString()}`));
  return data?.results ?? [];
}

/** Turn a coordinate into its best-matching address (`GET /api/geo/reverse`). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddressCandidate | null> {
  const data = unwrapEnvelope<GeoReverseResponseData>(
    await api.get(`${BASE}/reverse?lat=${lat}&lng=${lng}`),
  );
  return data?.result ?? null;
}

/** Friendly messages for the geo error codes (see api-doc/geo/README.md). */
export const GEO_ERROR_MESSAGES: Record<string, string> = {
  GEO_PROVIDER_UNAVAILABLE: 'Address search is temporarily unavailable. You can still type the address manually.',
  GEO_SEARCH_FAILED: 'Address search failed. You can still type the address manually.',
  GEO_PROVIDER_NOT_CONFIGURED: 'Address search is not configured. You can still type the address manually.',
};
