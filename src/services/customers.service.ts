import { api } from './api';
import { fileRefUrl } from '@/services/files.service';
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

// The `avatar` field now arrives as a populated file object `{ id, key, url, … }`
// (the same shape product images use), though some responses may still send a bare
// URL string. Collapse either into a plain URL so `CustomerAvatar` can render it.
function normalizeAvatar<T extends { avatar: string | null }>(c: T): T {
  return { ...c, avatar: fileRefUrl(c.avatar) } as T;
}

/**
 * The literal `realName` an anonymised account carries.
 *
 * A customer who closes their account is **anonymised and retained**, not
 * deleted: the row keeps its `_id` so past orders and money records stay
 * coherent, and every identifier is erased. Their orders, totals and flags are
 * preserved and still appear in a vendor's customer list.
 */
const CLOSED_ACCOUNT_NAME = 'Closed account';

/**
 * Whether this customer closed their account.
 *
 * 🔴 **The literal string is genuinely the only signal available.** Closure sets
 * the underlying user's `status` to `inactive`, but that field is selected by
 * neither the list nor the detail query and appears on neither DTO — there is no
 * flag to branch on. See api-doc/me/account-closure.md.
 *
 * ⚠ Do NOT collapse this with `realName === 'Unknown'`, which means the relation
 * exists but the customer profile is missing. That is a data-integrity gap, not a
 * closure, and the two want different handling.
 *
 * ⚠ `"Closed account"` is searchable — `?search=closed` matches it through the
 * name filter, so a vendor searching for "Closed" gets every closed customer.
 * Harmless, but surprising enough to be worth knowing.
 */
export function isClosedAccount(
  customer: Pick<CustomerListItem, 'realName'>,
): boolean {
  return customer.realName === CLOSED_ACCOUNT_NAME;
}

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
  return { data: res.data.map(normalizeAvatar), meta: res.meta };
}

export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  const res = await api.get<CustomerDetailResponse>(`${BASE}/customers/${id}`);
  return normalizeAvatar(res.data);
}

/** Set or clear the vendor-local display name. Returns the full updated detail. */
export async function updateCustomerName(
  id: string,
  payload: UpdateCustomerNamePayload,
): Promise<CustomerDetail> {
  const res = await api.patch<CustomerDetailResponse>(`${BASE}/customers/${id}/name`, payload);
  return normalizeAvatar(res.data);
}

/** Replace the customer's full set of assigned flags. Returns the updated detail. */
export async function updateCustomerFlags(
  id: string,
  payload: UpdateCustomerFlagsPayload,
): Promise<CustomerDetail> {
  const res = await api.put<CustomerDetailResponse>(`${BASE}/customers/${id}/flags`, payload);
  return normalizeAvatar(res.data);
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
