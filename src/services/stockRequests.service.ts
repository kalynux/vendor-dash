import { api } from './api';
import type {
  CreateStockRequestPayload,
  StockRequestDetailResponse,
  StockRequestDto,
  StockRequestListMeta,
  StockRequestListParams,
  StockRequestListResponse,
} from '@/types/stock-requests.types';

/**
 * Vendor stock requests — the two-signature flow for a SKU an agency warehouses.
 * See api-doc/vendor/stock-requests.md.
 *
 * Identity flows token → vendor, so there is no `vendorId` in any path. Another
 * party's request returns 404, never 403.
 */
const BASE = '/vendor/stock-requests';

/**
 * Unknown query parameters are rejected with `400 VALIDATION_ERROR`, so this
 * builds from a fixed whitelist rather than spreading the params object.
 */
function qs(p: StockRequestListParams): string {
  const parts: string[] = [];
  const push = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return;
    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  };
  push('page', p.page);
  push('limit', p.limit);
  push('status', p.status);
  push('productId', p.productId);
  push('variantId', p.variantId);
  push('direction', p.direction);
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Raise a request. `quantity` is the ABSOLUTE target, never a delta; `0` is valid.
 *
 * Errors worth handling by code: `409 STOCK_REQUEST_ALREADY_PENDING`
 * (`details.requestId` names the open one), `404 INVENTORY_PRODUCT_NOT_STORED_HERE`
 * (not warehoused — edit stock directly), `422 STOCK_REQUEST_NO_CHANGE`, and
 * `422 CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK` (a warehouse cannot hold an
 * unbounded quantity — refused at creation so no approvable request can leave a
 * product failing its own activation gate).
 */
export async function createStockRequest(
  payload: CreateStockRequestPayload,
): Promise<StockRequestDto> {
  const res = await api.post<StockRequestDetailResponse>(BASE, payload);
  return res.data;
}

/**
 * The inbox. **No status filter returns every status**, terminal rows included —
 * deliberate, so a SKU's negotiation history is fetchable.
 */
export async function fetchStockRequests(
  params: StockRequestListParams = {},
): Promise<{ data: StockRequestDto[]; meta: StockRequestListMeta }> {
  const res = await api.get<StockRequestListResponse>(`${BASE}${qs(params)}`);
  return {
    data: res.data ?? [],
    meta: res.meta ?? { total: res.data?.length ?? 0, page: 1, limit: params.limit ?? 20, totalPages: 1 },
  };
}

export async function fetchStockRequestById(id: string): Promise<StockRequestDto> {
  const res = await api.get<StockRequestDetailResponse>(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

/**
 * Applies the change: `variant.stock` is written, a StockAuditLog row is
 * recorded and the request flips to `approved` — one transaction, so the three
 * cannot come apart.
 */
export async function approveStockRequest(id: string): Promise<StockRequestDto> {
  const res = await api.post<StockRequestDetailResponse>(`${BASE}/${encodeURIComponent(id)}/approve`);
  return res.data;
}

/** Nothing is written. `reason` is optional and shown to the agency. */
export async function rejectStockRequest(id: string, reason?: string): Promise<StockRequestDto> {
  const res = await api.post<StockRequestDetailResponse>(
    `${BASE}/${encodeURIComponent(id)}/reject`,
    reason ? { reason } : {},
  );
  return res.data;
}

/**
 * Retracts a request **you** raised — including one the backend created for you
 * out of an intercepted variant/simple/bulk stock write. No notification is sent.
 */
export async function withdrawStockRequest(id: string): Promise<StockRequestDto> {
  const res = await api.post<StockRequestDetailResponse>(`${BASE}/${encodeURIComponent(id)}/withdraw`);
  return res.data;
}

/**
 * Count for the "Requests" tab badge. `direction=awaiting_me` is exactly
 * "pending, and the agency raised it", so `meta.total` with `limit: 1` is the
 * cheapest way to get it without pulling a page of rows.
 */
export async function fetchAwaitingMyDecisionCount(): Promise<number> {
  const { meta } = await fetchStockRequests({ direction: 'awaiting_me', status: 'pending', limit: 1 });
  return meta.total ?? 0;
}
