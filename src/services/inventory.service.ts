import { api } from './api';
import type {
  StockAlert,
  StockHistoryLog,
  StockReservation,
  InventoryPageMeta,
  InventoryListParams,
  HistoryParams,
  ReservationParams,
  BulkStockUpdateRow,
  BulkStockUpdateResult,
} from '@/types/inventory.types';

const BASE = '/vendor/inventory';

// ─── Shape tolerance ────────────────────────────────────────────────────────
// api-doc/vendor/inventory.md documents BARE list shapes (`{ alerts|logs|reservations,
// total?, pagination }`), while api-doc/README.md states history/reservations now use
// the standard `{ success, data, meta }` envelope (with `meta.totalReserved`). The two
// docs conflict, so we read whichever wrapper is present rather than guess. This is
// flagged in the implementation report as an ambiguity to confirm with the backend.

type Paginationish = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  pages?: number;
};

function normalizeList<T>(res: unknown, itemsKey: string): { data: T[]; meta: InventoryPageMeta } {
  const r = (res ?? {}) as Record<string, unknown>;
  // The payload may be bare (`{ alerts, total, pagination }`) or wrapped in a
  // `{ data, meta }` envelope, and the items may be `data` itself (an array) or
  // nested under `data[itemsKey]` (e.g. `{ data: { alerts, total, pagination } }`).
  const envelope =
    r.data && typeof r.data === 'object' && !Array.isArray(r.data)
      ? (r.data as Record<string, unknown>)
      : r;
  const data = (Array.isArray(r.data) ? r.data : envelope[itemsKey] ?? r[itemsKey] ?? []) as T[];
  const p = ((envelope.pagination ?? r.meta ?? r.pagination ?? {}) as Paginationish) || {};
  const total =
    typeof envelope.total === 'number'
      ? (envelope.total as number)
      : typeof r.total === 'number'
        ? (r.total as number)
        : p.total ?? data.length;
  return {
    data,
    meta: {
      page: p.page ?? 1,
      limit: p.limit ?? data.length,
      total,
      totalPages: p.pages ?? p.totalPages ?? 1,
    },
  };
}

function qs(params: object): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
}

/** Variants at/below their low-stock threshold. */
export async function fetchStockAlerts(
  params: InventoryListParams = {},
): Promise<{ data: StockAlert[]; meta: InventoryPageMeta }> {
  const res = await api.get<unknown>(`${BASE}/alerts${qs(params)}`);
  return normalizeList<StockAlert>(res, 'alerts');
}

/** Immutable stock-change audit trail. */
export async function fetchStockHistory(
  params: HistoryParams = {},
): Promise<{ data: StockHistoryLog[]; meta: InventoryPageMeta }> {
  const res = await api.get<unknown>(`${BASE}/history${qs(params)}`);
  return normalizeList<StockHistoryLog>(res, 'logs');
}

/** Active stock reservations, plus the `totalReserved` summary. */
export async function fetchReservations(
  params: ReservationParams = {},
): Promise<{ data: StockReservation[]; meta: InventoryPageMeta; totalReserved: number }> {
  const res = await api.get<unknown>(`${BASE}/reservations${qs(params)}`);
  const { data, meta } = normalizeList<StockReservation>(res, 'reservations');
  const r = (res ?? {}) as Record<string, unknown>;
  const metaObj = (r.meta ?? {}) as Record<string, unknown>;
  const totalReserved =
    (typeof metaObj.totalReserved === 'number' ? (metaObj.totalReserved as number) : undefined) ??
    (typeof r.totalReserved === 'number' ? (r.totalReserved as number) : 0);
  return { data, meta, totalReserved };
}

/**
 * Set absolute stock levels for one or more physical variants (atomic, all-or-
 * nothing). On any row failure the backend rejects the whole batch (400) and no
 * rows change — surfaced here as an ApiError. Max 1,000 rows.
 */
export async function bulkUpdateStock(updates: BulkStockUpdateRow[]): Promise<BulkStockUpdateResult> {
  const res = await api.patch<Record<string, unknown>>(`${BASE}/bulk-update`, { updates });
  return normalizeBulkResult(res);
}

/**
 * CSV variant of the bulk update — same endpoint, `multipart/form-data` with a
 * single `file` field. The CSV must have exactly `variantId,quantity` columns
 * (max 5MB, 1,000 rows). On any row failure the whole batch is rejected (400)
 * and the thrown `ApiError` carries the per-row failures in `rowErrors`.
 */
export async function bulkUpdateStockCsv(file: File): Promise<BulkStockUpdateResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.patchFormData<Record<string, unknown>>(`${BASE}/bulk-update`, form);
  return normalizeBulkResult(res);
}

// Response is `{ success, batchId, updated, variants }` (non-standard shape per
// inventory.md) — tolerate a future `{ success, data }` envelope too.
function normalizeBulkResult(res: Record<string, unknown>): BulkStockUpdateResult {
  const body = (res?.data ?? res) as unknown as BulkStockUpdateResult;
  return {
    batchId: body.batchId,
    updated: body.updated,
    variants: body.variants ?? [],
  };
}
