import { api } from './api';
import type {
  CustomerFlag,
  CreateFlagPayload,
  UpdateFlagPayload,
  CustomerListItem,
  CustomerDetail,
  CustomerListMeta,
  CustomersQueryParams,
  UpdateCustomerNamePayload,
  UpdateCustomerFlagsPayload,
  RefundEligibility,
  RefundResult,
  RefundOrderPayload,
  FlagsListResponse,
  FlagMutationResponse,
  CustomersListResponse,
  CustomerDetailResponse,
  RefundEligibilityResponse,
  RefundResponse,
} from '@/types/customers.types';

const BASE = '/vendor';

// Reuses the tickets/products query-string convention: drop empty values.
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// ─── Customer flags ─────────────────────────────────────────────────────────────

export async function fetchFlags(): Promise<CustomerFlag[]> {
  const res = await api.get<FlagsListResponse>(`${BASE}/customer-flags`);
  return res.data;
}

export async function createFlag(payload: CreateFlagPayload): Promise<CustomerFlag> {
  const res = await api.post<FlagMutationResponse>(`${BASE}/customer-flags`, payload);
  return res.data;
}

export async function updateFlag(id: string, payload: UpdateFlagPayload): Promise<CustomerFlag> {
  const res = await api.patch<FlagMutationResponse>(`${BASE}/customer-flags/${id}`, payload);
  return res.data;
}

export async function deleteFlag(id: string): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>(`${BASE}/customer-flags/${id}`);
}

// ─── Customers ──────────────────────────────────────────────────────────────────

export async function fetchCustomers(
  params: CustomersQueryParams = {},
): Promise<{ data: CustomerListItem[]; meta: CustomerListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<CustomersListResponse>(`${BASE}/customers${qs}`);
  return { data: res.data, meta: res.meta };
}

export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  const res = await api.get<CustomerDetailResponse>(`${BASE}/customers/${id}`);
  return res.data;
}

/** Set or clear the vendor-local display name. Returns the full updated detail. */
export async function updateCustomerName(
  id: string,
  payload: UpdateCustomerNamePayload,
): Promise<CustomerDetail> {
  const res = await api.patch<CustomerDetailResponse>(`${BASE}/customers/${id}/name`, payload);
  return res.data;
}

/** Replace the customer's full set of assigned flags. Returns the updated detail. */
export async function updateCustomerFlags(
  id: string,
  payload: UpdateCustomerFlagsPayload,
): Promise<CustomerDetail> {
  const res = await api.put<CustomerDetailResponse>(`${BASE}/customers/${id}/flags`, payload);
  return res.data;
}

// ─── Refunds (live on the orders controller) ────────────────────────────────────

export async function fetchRefundEligibility(orderId: string): Promise<RefundEligibility> {
  const res = await api.get<RefundEligibilityResponse>(`${BASE}/orders/${orderId}/refund-eligibility`);
  return res.data;
}

export async function refundOrder(
  orderId: string,
  payload: RefundOrderPayload = {},
): Promise<RefundResult> {
  const res = await api.post<RefundResponse>(`${BASE}/orders/${orderId}/refund`, payload);
  return res.data;
}
