// Storage invoices — mirrors `/api/vendor/storage-invoices`.
// See api-doc/vendor/storage-invoices.md.
//
// A monthly record of WAREHOUSING RENT, one per (agency, vendor) pair, for SKUs an
// agency stores.
//
// 🔴 **No money moves through the platform.** No ledger entry, no wallet debit, no
// payout, no commission — the platform is not a party to this rent and neither
// collects nor pays it. It is a record the two businesses settle between
// themselves, and that has to be visible in any UI or a vendor will expect the
// amount to come out of their earnings.
//
// 🔴 **Read-only.** Two routes, both GET. No settle, no dispute, no pay, no
// download. The agency issues and marks settled out of band, and there is no
// dispute verb deliberately — a dispute the platform recorded would be
// unresolvable, since it is not a party to the money.
//
// How one comes into being: a scheduled job on the 1st of each month bills the
// previous calendar month, for agencies with storage-based billing enabled and
// counted stock only (infinite-stock SKUs are not billed). Quantities are the
// units on the shelf AT THE MOMENT OF ISSUE, not a monthly average — clearing
// stock on the 30th does not reduce the bill. Everything is frozen at issue, so
// an old invoice's SKU labels and depot names may not match the product today.

export type StorageInvoiceStatus =
  /** Issued, not yet marked settled. */
  | 'open'
  /** The **agency** says it was paid. Nothing verifies this. */
  | 'settled'
  /** Cancelled by the agency. The month is never re-issued. */
  | 'void';

/**
 * One SKU's charge.
 *
 * 🔴 `lineTotal` IS `monthlyRatePerSku` — the charge is per SKU held, not per
 * unit. So `quantity: 40` with `lineTotal: 500` is correct, and a
 * "quantity × rate" column would be wrong. `quantity` is informational.
 */
export interface StorageInvoiceLine {
  stockLevelId: string;
  productId: string;
  variantId: string;
  /** Snapshotted at issue — may differ from the product today. Nullable. */
  sku: string | null;
  productTitle: string | null;
  locationId: string;
  locationLabel: string | null;
  quantity: number;
  /**
   * The rate this line was billed at. Can differ from the invoice's headline
   * rate — render the line's own value in a table, not the invoice's.
   */
  monthlyRatePerSku: number;
  lineTotal: number;
}

export interface StorageInvoice {
  id: string;
  agencyId: string;
  vendorId: string;
  /** `YYYY-MM`. The right thing to display a period from. */
  periodKey: string;
  periodStart: string;
  /**
   * 🔴 **EXCLUSIVE.** A July invoice carries 1 August here. Display `periodKey`,
   * or render `periodEnd − 1 day`; printing this raw shows the wrong month.
   */
  periodEnd: string;
  skuCount: number;
  unitCount: number;
  monthlyRatePerSku: number;
  /** 🔴 There is no `currency` field, deliberately. Format in the vendor's own. */
  total: number;
  status: StorageInvoiceStatus;
  issuedAt: string;
  /**
   * ⚠ The only settlement signal a vendor gets. Who marked it settled is
   * deliberately not exposed — it would be an id neither party can resolve.
   */
  settledAt: string | null;
  note: string | null;
  /** 🔴 **Absent entirely on the list** — not empty, absent. Fetch the detail. */
  lines?: StorageInvoiceLine[];
}

export interface StorageInvoiceListParams {
  page?: number;
  /** 1–100. Default 20. */
  limit?: number;
  status?: StorageInvoiceStatus;
  /** `YYYY-MM`. */
  periodKey?: string;
}

export interface StorageInvoiceListResponse {
  success: boolean;
  data: StorageInvoice[];
  /** ⚠ `totalPages`, not `pages`. */
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface StorageInvoiceResponse {
  success: boolean;
  data: StorageInvoice;
}
