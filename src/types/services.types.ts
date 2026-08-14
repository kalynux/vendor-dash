// ─── Vendor Service / Booking module types ──────────────────────────────────────
// Derived strictly from the booking API docs:
//   api-doc/vendor/{calendar,products,availability-rules,bookings}.md
//   api-doc/vendor/booking-implementation-guide.md
//
// A "service" is a product with `type: "service"`. The services module reuses the
// product endpoints (with a `type: "service"` literal) rather than widening the
// product-module `ApiProductType` union, keeping the product wizard untouched.

import type { ApiFileDetail, ApiVectorisationStatus } from '@/types/product.types';

// ─── Service product status ───────────────────────────────────────────────────
// Mirrors ApiProductStatus (services are products under the hood).
export type ServiceStatus =
  | 'draft'
  | 'active'
  | 'archived'
  | 'pending_review'
  | 'suspended';

export type BookingMode = 'calendar' | 'manual' | 'capacity';

export type PeakPriceType = 'fixed' | 'percentage';

// ─── serviceConfig (variants.md → Service variant) ──────────────────────────────
// As of the booking-workflow update, serviceConfig + price live on the single
// service VARIANT, not the product.

// Optional peak-hours surcharge. The surcharge applies only to the minutes of a
// booking that overlap [startTime, endTime) on the listed daysOfWeek (empty
// daysOfWeek = every day). The backend computes it — the frontend never does.
export interface PeakHours {
  daysOfWeek: DayOfWeek[];
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  priceType: PeakPriceType;
  value: number; // percentage points or a flat minor-unit amount
}

export interface ServiceConfig {
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  bookingMode?: BookingMode;
  /** Seats per slot — required (and only meaningful) when bookingMode is 'capacity'. */
  maxBookings?: number;
  peakHours?: PeakHours;
}

// ─── Service product shapes ─────────────────────────────────────────────────────

// Trimmed list-row shape (adapted from the products list endpoint payload).
export interface ServiceListItem {
  id: string;
  title: string;
  status: ServiceStatus;
  category: string;
  tags: string[];
  firstFileUrl: string | null;
  durationMinutes: number | null;
  bookingMode: BookingMode | null;
  vectorisationEnabled: boolean;
  vectorisationStatus: ApiVectorisationStatus;
  createdAt: string;
  updatedAt: string;
}

// Full service product (GET /vendor/products/:id) — files fully populated.
export interface ServiceProduct {
  id: string;
  vendorId: string;
  type: 'service';
  status: ServiceStatus;
  title: string;
  description: string;
  slug: string;
  category: string;
  tags: string[];
  seo: { title?: string; description?: string };
  files: ApiFileDetail[];
  hasVariants: boolean;
  defaultVariantId: string | null;
  vectorisationEnabled: boolean;
  vectorisationStatus: ApiVectorisationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ServicesQueryParams {
  status?: ServiceStatus;
  q?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ─── Write payloads ─────────────────────────────────────────────────────────────

export interface CreateServicePayload {
  title: string;
  category: string;
  description: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateServicePayload {
  title?: string;
  category?: string;
  description?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  fileIds?: string[];
  vectorisationEnabled?: boolean;
}

// ─── Availability rules (availability-rules.md) ─────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilityRule {
  // The API has been observed to return the identifier as `id` on some
  // endpoints and `_id` on others — read it via `getAvailabilityRuleId()`.
  _id?: string;
  id?: string;
  productId: string;
  vendorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // 'HH:mm' wall-clock, resolved in `timezone`
  endTime: string; // 'HH:mm'
  /**
   * IANA zone. Absent means the rule inherits the vendor profile's timezone —
   * the normal case. It used to default to a literal `'UTC'` that was never
   * actually read (hours resolved against the server clock); the backend
   * migration clears those rows to "inherit".
   */
  timezone?: string | null;
  // Buffers are NOT on availability rules — they live on the service variant's
  // serviceConfig (bufferBeforeMinutes / bufferAfterMinutes). See availability-rules.md.
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityRulePayload {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  timezone?: string;
  isActive?: boolean;
}

export interface UpdateAvailabilityRulePayload {
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

// ─── Bookings (bookings.md) ─────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'no-show'
  | 'cancelled';

// `disputed` = a card payment is under chargeback; the backend resolves it to
// `paid` (won) or `refunded`/cancelled (lost). No vendor action is possible.
//
// `refund_pending` = a paid booking was cancelled but its gateway cannot refund
// programmatically (cash, and mobile money until those refund APIs land), so a
// HIGH-importance support ticket was raised for a manual payout. The vendor's
// escrowed earnings are already reversed either way — a cancelled service is
// never paid for.
export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'disputed'
  | 'failed'
  | 'refund_pending'
  | 'refunded';

export type PaymentMethod = 'cash' | string;

// Populated reference shapes returned by the list/detail endpoints.
export interface BookingProductRef {
  _id: string;
  title: string;
  type: string;
}

export interface BookingUserRef {
  _id: string;
  login_email?: string;
}

export interface Booking {
  _id: string;
  productId: BookingProductRef | string;
  userId: BookingUserRef | string;
  vendorId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string | null;
  priceSnapshot: number; // minor currency unit (e.g. 5000 = 50.00 XAF)
  currency: string;
  requiresPayment: boolean;
  externalCalendarEventId?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  /** Present once the booking has been completed. See `BookingSettlement`. */
  settlement?: BookingSettlement | null;
}

/**
 * What completion settled to, persisted on the booking rather than buried in
 * `metadata` — so an outstanding balance is still readable long after the
 * completion dialog closed.
 */
export interface BookingSettlement {
  /** The recomputed (or flat) price, in minor units. */
  finalPrice: number;
  /** What the customer still owes: `max(0, finalPrice − amountPaid)`. */
  balanceDue: number;
  /** How much of `balanceDue` has been collected, online or in cash. */
  balancePaid: number;
  /** Overpayment — recorded, never refunded automatically. */
  creditDue: number;
  pricingMode?: string;
  settledAt?: string | null;
  /** `cash` once the vendor records the balance at the counter. */
  balancePaymentMethod?: string | null;
}

// Complete a booking + settle its final price (bookings.md → Complete Booking).
// All fields optional; at most one pricing mode. Omitting all settles at the
// originally booked duration.
export interface CompleteBookingPayload {
  actualEndAt?: string; // ISO — recompute price for [startAt, actualEndAt]
  additionalMinutes?: number; // extend beyond the booked end
  fixedPrice?: number; // flat final price (minor units); excludes the other two
}

export interface CompleteBookingResult {
  booking: Booking;
  priceSnapshot: number; // originally booked estimate (minor units)
  finalPrice: number; // recomputed/flat price (minor units)
  /** What the customer has actually paid so far — `0` unless the booking is `paid`. */
  amountPaid?: number;
  /**
   * `max(0, finalPrice − amountPaid)` — measured against what was **paid**, not
   * what was quoted. An unpaid booking therefore owes the whole final price,
   * not just the overrun.
   */
  additionalAmountDue: number;
  /** `max(0, amountPaid − finalPrice)`. Recorded, not auto-refunded. */
  creditDue?: number;
  /**
   * Always `false`: the balance is *requested*, never charged automatically —
   * the customer agreed to the quoted price, not to whatever is settled after.
   */
  additionalAmountCharged?: boolean;
  additionalAmountNote?: string;
  breakdown: { basePrice: number; peakHoursSurcharge: number };
}

/** Result of recording a completion balance taken in cash. */
export interface SettleBalanceResult {
  bookingId: string;
  balanceDue: number;
  balancePaid: number;
  outstanding: number;
  balancePaymentMethod: string;
}

export interface BookingsQueryParams {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  productId?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
  page?: number;
  limit?: number;
}

export interface BookingListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Calendar view (GET /vendor/bookings/calendar) — grouped by YYYY-MM-DD (UTC).
export interface BookingCalendarEntry {
  bookingId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  productId: string;
  productTitle: string;
  customerEmail: string;
  externalCalendarEventId?: string | null;
}

export interface BookingCalendarDay {
  date: string; // YYYY-MM-DD
  bookings: BookingCalendarEntry[];
}

// ─── Reschedule slot flow (public product availability + slot lock) ─────────────
// NOTE: the customer/bookings.md doc is absent from this repo. These shapes are
// derived from the implementation guide (opaque `slot.id`, 15-min lock countdown)
// and should be verified against the running API.

export interface AvailabilitySlot {
  id: string;
  startAt: string;
  endAt: string;
  available?: boolean;
}

export interface AvailabilityResponse {
  success: boolean;
  data: {
    slots: AvailabilitySlot[];
  };
}

export interface SlotLock {
  slotId: string;
  expiresAt: string;
}

// ─── Calendar connection (calendar.md) ──────────────────────────────────────────

export interface CalendarPermission {
  scope: string;
  description: string;
}

export interface CalendarStatus {
  connected: boolean;
  provider: 'google' | null;
  email: string | null;
  calendarId: string | null;
  permissions: CalendarPermission[];
  requiresReauth: boolean;
  lastSyncAt: string | null;
  expiresAt: string | null;
}

// ─── API response envelopes ─────────────────────────────────────────────────────

export interface ServicesListResponse {
  success: boolean;
  data: ApiServiceListRaw[];
  meta: ServiceListMeta;
}

// Raw product-list row shape (subset the services list consumes).
export interface ApiServiceListRaw {
  id: string;
  title: string;
  type: string;
  status: ServiceStatus;
  category: string;
  tags?: string[];
  fileIds: ApiFileDetail[];
  vectorisationEnabled?: boolean;
  vectorisationStatus?: ApiVectorisationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDetailResponse {
  success: boolean;
  data: ServiceProduct;
  message?: string;
}

export interface ServiceMutationResponse {
  success: boolean;
  data: ServiceProduct;
  message?: string;
}

export interface CalendarStatusResponse {
  success: boolean;
  data: CalendarStatus;
}

export interface AvailabilityRulesListResponse {
  success: boolean;
  data: AvailabilityRule[];
}

export interface AvailabilityRuleResponse {
  success: boolean;
  data: AvailabilityRule;
  message?: string;
}

export interface BookingsListResponse {
  success: boolean;
  data: Booking[];
  meta: BookingListMeta;
}

export interface BookingDetailResponse {
  success: boolean;
  data: Booking;
  message?: string;
}

export interface BookingCalendarResponse {
  success: boolean;
  data: BookingCalendarDay[];
}

export interface MarkPaidResponse {
  success: boolean;
  data: {
    bookingId: string;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    paidAt: string;
  };
  message?: string;
}

export interface CompleteBookingResponse {
  success: boolean;
  data: CompleteBookingResult;
  message?: string;
}

export interface SettleBalanceResponse {
  success: boolean;
  data: SettleBalanceResult;
  message?: string;
}

export interface SlotLockResponse {
  success: boolean;
  data: SlotLock;
  message?: string;
}

export interface SimpleMessageResponse {
  success: boolean;
  message?: string;
}
