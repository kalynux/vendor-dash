import { api } from './api';
import type {
  VendorAgencyListItemDto,
  AgencyListMeta,
  GetDeliveryAgenciesResponse,
  GetDefaultAgencyResponse,
  DeliveryAgenciesQueryParams,
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
