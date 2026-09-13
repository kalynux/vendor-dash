import { api } from './api';
import type {
  VendorAgencyListItemDto,
  GetDefaultAgencyResponse,
  AgencyLocationDto,
  GetAgencyLocationsResponse,
} from '@/types/product.types';

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
