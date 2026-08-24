// Storage invoices — 2 routes under /api/vendor/storage-invoices, both GET.
// See api-doc/vendor/storage-invoices.md.
//
// 🔴 Read-only by design. There is no settle, dispute, pay or download route —
// the agency issues and marks settled out of band, and no money moves through the
// platform. Do not add a Pay button; there is nothing behind it.
//
// ⚠ The list query schema is STRICT: an unknown parameter is a 400, so the query
// string below is built from a closed set of keys. `vendorId` is accepted and
// ignored — the caller IS the scope.

import { api } from './api';
import type {
  StorageInvoice,
  StorageInvoiceListParams,
  StorageInvoiceListResponse,
  StorageInvoiceResponse,
} from '@/types/storage-invoices.types';

const BASE = '/vendor/storage-invoices';

/**
 * Invoices, newest period first.
 *
 * `lines` is **absent** on every row here — fetch the detail for a breakdown.
 * Nothing groups by agency for you; a vendor using more than one agency gets one
 * flat list.
 */
export async function listStorageInvoices(
  params: StorageInvoiceListParams = {},
): Promise<StorageInvoiceListResponse> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.status !== undefined) qs.set('status', params.status);
  if (params.periodKey !== undefined) qs.set('periodKey', params.periodKey);
  const query = qs.toString();
  return api.get<StorageInvoiceListResponse>(`${BASE}${query ? `?${query}` : ''}`);
}

/**
 * One invoice, with its `lines`.
 *
 * `404 STORAGE_INVOICE_NOT_FOUND` covers both "no such id" and another vendor's
 * invoice — never a 403.
 */
export async function fetchStorageInvoice(id: string): Promise<StorageInvoice> {
  const res = await api.get<StorageInvoiceResponse>(
    `${BASE}/${encodeURIComponent(id)}`,
  );
  return res.data;
}

/**
 * The month an invoice covers, as a `Date`.
 *
 * `periodEnd` is exclusive, so it lands on the 1st of the FOLLOWING month — a
 * July invoice carries 1 August. Deriving the month from `periodKey` avoids that
 * off-by-one entirely, which is why this exists rather than each caller parsing
 * one of the two timestamps.
 */
export function storageInvoicePeriod(invoice: StorageInvoice): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(invoice.periodKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}
