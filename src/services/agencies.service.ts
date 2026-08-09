import { api } from './api';
import type {
  VendorAgencyListItemDto,
  AgencyListMeta,
  GetDeliveryAgenciesResponse,
  GetDefaultAgencyResponse,
  DeliveryAgenciesQueryParams,
  AgencyLocationDto,
  GetAgencyLocationsResponse,
} from '@/types/product.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
  );
}

export async function fetchDeliveryAgencies(
  params: DeliveryAgenciesQueryParams = {},
): Promise<{ data: VendorAgencyListItemDto[]; meta: AgencyListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<GetDeliveryAgenciesResponse>(`/vendor/delivery-agencies${qs}`);
  return { data: res.data, meta: res.meta };
}

export async function fetchDefaultDeliveryAgency(): Promise<VendorAgencyListItemDto | null> {
  const res = await api.get<GetDefaultAgencyResponse>(
    '/vendor/profile/default-delivery-agency',
  );
  return res.data;
}

/**
 * Every depot the agency operates, so a vendor can name the one that warehouses
 * a product (`delivery.pickupLocation.agencyAddressId`).
 *
 * Requires an **active, approved connection** with the agency — `422
 * CONNECTION_NOT_ACTIVE` otherwise, which is the same gate as pointing a
 * product at that agency in the first place. An **empty array is a valid
 * answer**, not an error: the agency has no location on file yet.
 *
 * See api-doc/vendor/delivery-agencies.md#list-an-agencys-pickup-locations.
 */
export async function fetchAgencyLocations(agencyId: string): Promise<AgencyLocationDto[]> {
  const res = await api.get<GetAgencyLocationsResponse>(
    `/vendor/delivery-agencies/${encodeURIComponent(agencyId)}/locations`,
  );
  return res.data;
}
