import { api, BASE_URL } from './api';
import {
  fetchVariants,
  createVariant,
  updateVariant,
  updateVariantServiceConfig,
} from './products.service';
// Services are products under the hood — reuse the product vectorisation actions
// (they hit /vendor/products/:id/vectorisation and work for service products too).
export { setVectorisationEnabled, retryVectorisation } from './products.service';
import type { ApiVariant } from '@/types/product.types';
import { ApiError } from '@/types/api';
import type {
  ServiceListItem,
  ServiceListMeta,
  ServicesQueryParams,
  ServiceProduct,
  ServiceStatus,
  ServiceConfig,
  CreateServicePayload,
  UpdateServicePayload,
  ApiServiceListRaw,
  ServicesListResponse,
  ServiceDetailResponse,
  ServiceMutationResponse,
  CalendarStatus,
  CalendarStatusResponse,
  AvailabilityRule,
  CreateAvailabilityRulePayload,
  UpdateAvailabilityRulePayload,
  AvailabilityRulesListResponse,
  AvailabilityRuleResponse,
  Booking,
  BookingsQueryParams,
  BookingListMeta,
  BookingStatus,
  BookingsListResponse,
  BookingDetailResponse,
  BookingCalendarDay,
  BookingCalendarResponse,
  MarkPaidResponse,
  AvailabilitySlot,
  AvailabilityResponse,
  SlotLock,
  SlotLockResponse,
  SimpleMessageResponse,
  CompleteBookingPayload,
  CompleteBookingResult,
  CompleteBookingResponse,
} from '@/types/services.types';

const BASE = '/vendor';

// Same convention as customers/products services: drop empty values.
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// ─── Google Calendar connection (calendar.md) ───────────────────────────────────

export async function fetchCalendarStatus(): Promise<CalendarStatus> {
  const res = await api.get<CalendarStatusResponse>(`${BASE}/calendar/status`);
  return res.data;
}

export async function disconnectCalendar(): Promise<void> {
  await api.post<SimpleMessageResponse>(`${BASE}/calendar/disconnect`);
}

/**
 * Full browser-navigation URL that starts the Google OAuth flow. This MUST be
 * used as `window.location.href = …` (not fetch) so it carries the session
 * cookie and can follow Google's redirects. The backend redirects back to
 * `/dashboard/services?calendar=connected|error&reason=…` afterwards.
 */
export function getCalendarConnectUrl(): string {
  return `${BASE_URL}/integrations/google/connect`;
}

// ─── Service products (product endpoints, type: "service") ──────────────────────

function adaptListItem(p: ApiServiceListRaw): ServiceListItem {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    category: p.category,
    tags: p.tags ?? [],
    firstFileUrl: p.fileIds?.[0]?.url ?? null,
    // serviceConfig now lives on the variant; the trimmed product-list payload
    // no longer carries it, so duration/mode are unknown at list level. The
    // detail sheet (which loads the variant) is the source of truth.
    durationMinutes: null,
    bookingMode: null,
    vectorisationEnabled: p.vectorisationEnabled ?? false,
    vectorisationStatus: p.vectorisationStatus ?? 'not_started',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function fetchServices(
  params: ServicesQueryParams = {},
): Promise<{ data: ServiceListItem[]; meta: ServiceListMeta }> {
  const qs = buildQueryString({ ...params, type: 'service' });
  const res = await api.get<ServicesListResponse>(`${BASE}/products${qs}`);
  return { data: res.data.map(adaptListItem), meta: res.meta };
}

export async function fetchServiceById(id: string): Promise<ServiceProduct> {
  const res = await api.get<ServiceDetailResponse>(`${BASE}/products/${id}`);
  // Default the vectorisation fields so the UI never sees `undefined`.
  return {
    ...res.data,
    vectorisationEnabled: res.data.vectorisationEnabled ?? false,
    vectorisationStatus: res.data.vectorisationStatus ?? 'not_started',
  };
}

export async function createService(payload: CreateServicePayload): Promise<ServiceProduct> {
  // serviceConfig is NOT accepted on create — it is set via PATCH afterwards.
  const res = await api.post<ServiceMutationResponse>(`${BASE}/products`, {
    type: 'service',
    ...payload,
  });
  return res.data;
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<ServiceProduct> {
  const res = await api.patch<ServiceMutationResponse>(`${BASE}/products/${id}`, payload);
  return res.data;
}

export async function changeServiceStatus(
  id: string,
  status: ServiceStatus,
): Promise<ServiceProduct> {
  const res = await api.patch<ServiceMutationResponse>(`${BASE}/products/${id}/status`, { status });
  return res.data;
}

export async function archiveService(id: string): Promise<void> {
  await api.delete<SimpleMessageResponse>(`${BASE}/products/${id}`);
}

/** The single service variant carrying price + serviceConfig, or null if none. */
function pickServiceVariant(variants: ApiVariant[]): ApiVariant | null {
  return variants.find((v) => v.status === 'active') ?? variants[0] ?? null;
}

/**
 * Read the single service variant (carries both `price` and `serviceConfig`),
 * or null when the product has none yet.
 */
export async function fetchServiceVariant(productId: string): Promise<ApiVariant | null> {
  const variants = await fetchVariants(productId);
  return pickServiceVariant(variants);
}

interface ServiceVariantInput {
  price: number;
  serviceConfig: ServiceConfig;
}

/**
 * A service product has exactly one variant carrying its `price` + `serviceConfig`
 * (booking `priceSnapshot` flows from it). Creates it on first call (auto-set as
 * the default variant), or updates the existing one's price + service config.
 *
 * `price` is entered in the variant-editor convention (major currency units).
 * `serviceConfig` is required on create per the booking API.
 */
export async function ensureServiceVariant(
  productId: string,
  input: ServiceVariantInput,
): Promise<void> {
  const variants = await fetchVariants(productId);
  const existing = pickServiceVariant(variants);
  if (existing) {
    if (existing.price !== input.price) {
      await updateVariant(productId, existing.id, { price: input.price });
    }
    await updateVariantServiceConfig(productId, existing.id, input.serviceConfig);
    return;
  }
  try {
    await createVariant(productId, {
      sku: `svc-${productId.slice(-6)}-${Date.now().toString(36)}`,
      price: input.price,
      name: 'Booking',
      serviceConfig: input.serviceConfig,
    });
  } catch (err) {
    // A race (or a pre-existing variant we didn't see) yields 409 — re-fetch and patch.
    if (err instanceof ApiError && err.code === 'CATALOG_SERVICE_VARIANT_EXISTS') {
      const again = pickServiceVariant(await fetchVariants(productId));
      if (again) {
        if (again.price !== input.price) {
          await updateVariant(productId, again.id, { price: input.price });
        }
        await updateVariantServiceConfig(productId, again.id, input.serviceConfig);
        return;
      }
    }
    throw err;
  }
}

// ─── Availability rules (availability-rules.md) ─────────────────────────────────

export async function fetchRules(productId: string): Promise<AvailabilityRule[]> {
  const res = await api.get<AvailabilityRulesListResponse>(
    `${BASE}/products/${productId}/availability-rules`,
  );
  return res.data;
}

/**
 * Create one or more availability rules in a single atomic request. Accepts an
 * array (define the whole week at once) — the API validates every rule before
 * persisting any, and always returns the created rules as an array.
 * Rules default to drafts; pass `isActive: true` per rule to publish on create.
 */
export async function createRules(
  productId: string,
  payloads: CreateAvailabilityRulePayload[],
): Promise<AvailabilityRule[]> {
  const res = await api.post<AvailabilityRulesListResponse>(
    `${BASE}/products/${productId}/availability-rules`,
    payloads,
  );
  return res.data;
}

export async function updateRule(
  ruleId: string,
  payload: UpdateAvailabilityRulePayload,
): Promise<AvailabilityRule> {
  const res = await api.patch<AvailabilityRuleResponse>(
    `${BASE}/products/availability-rules/${ruleId}`,
    payload,
  );
  return res.data;
}

/**
 * Set a rule's published state explicitly (availability-rules.md). The endpoint
 * applies the `isActive` value sent — it does NOT flip the current state.
 */
export async function toggleRule(ruleId: string, isActive: boolean): Promise<AvailabilityRule> {
  const res = await api.patch<AvailabilityRuleResponse>(
    `${BASE}/products/availability-rules/${ruleId}/toggle`,
    { isActive },
  );
  return res.data;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await api.delete<SimpleMessageResponse>(`${BASE}/products/availability-rules/${ruleId}`);
}

// ─── Booking management (bookings.md) ───────────────────────────────────────────

export async function fetchBookings(
  params: BookingsQueryParams = {},
): Promise<{ data: Booking[]; meta: BookingListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<BookingsListResponse>(`${BASE}/bookings${qs}`);
  return { data: res.data, meta: res.meta };
}

export async function fetchBookingById(id: string): Promise<Booking> {
  const res = await api.get<BookingDetailResponse>(`${BASE}/bookings/${id}`);
  return res.data;
}

export async function fetchBookingCalendar(
  startDate: string,
  endDate: string,
): Promise<BookingCalendarDay[]> {
  const qs = buildQueryString({ startDate, endDate });
  const res = await api.get<BookingCalendarResponse>(`${BASE}/bookings/calendar${qs}`);
  return res.data;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  const res = await api.patch<BookingDetailResponse>(`${BASE}/bookings/${id}/status`, { status });
  return res.data;
}

export async function markBookingPaid(id: string): Promise<MarkPaidResponse['data']> {
  const res = await api.patch<MarkPaidResponse>(`${BASE}/bookings/${id}/payment-status`);
  return res.data;
}

export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  const res = await api.post<BookingDetailResponse>(
    `${BASE}/bookings/${id}/cancel`,
    reason ? { reason } : undefined,
  );
  return res.data;
}

export async function rescheduleBooking(id: string, newSlotId: string): Promise<Booking> {
  const res = await api.patch<BookingDetailResponse>(`${BASE}/bookings/${id}/reschedule`, {
    newSlotId,
  });
  return res.data;
}

/**
 * Mark a confirmed booking completed and settle its final price. Pass at most
 * one pricing mode (actualEndAt | additionalMinutes | fixedPrice); an empty
 * payload settles at the originally booked duration. The backend recomputes the
 * price — the frontend never does. Returns finalPrice + additionalAmountDue.
 */
export async function completeBooking(
  id: string,
  payload: CompleteBookingPayload = {},
): Promise<CompleteBookingResult> {
  const res = await api.post<CompleteBookingResponse>(`${BASE}/bookings/${id}/complete`, payload);
  return res.data;
}

// ─── Reschedule slot flow (public product availability + slot lock) ─────────────
// The vendor must hold a lock on the new slot before calling reschedule.

export async function fetchAvailability(
  productId: string,
  fromDate: string,
  toDate: string,
): Promise<AvailabilitySlot[]> {
  const qs = buildQueryString({ fromDate, toDate });
  const res = await api.get<AvailabilityResponse>(`/products/${productId}/availability${qs}`);
  return res.data.slots;
}

export async function lockSlot(productId: string, slotId: string): Promise<SlotLock> {
  const res = await api.post<SlotLockResponse>(`/products/${productId}/slots/${slotId}/lock`);
  return res.data;
}

export async function unlockSlot(productId: string, slotId: string): Promise<void> {
  await api.post<SimpleMessageResponse>(`/products/${productId}/slots/${slotId}/unlock`);
}

// ─── Error-code → friendly message maps ─────────────────────────────────────────

export const AVAILABILITY_ERROR_MAP: Record<string, string> = {
  AVAILABILITY_PRODUCT_NOT_FOUND: 'This service could not be found.',
  AVAILABILITY_INVALID_PRODUCT_TYPE: 'Only service products can have availability rules.',
  AVAILABILITY_INVALID_TIME_RANGE: 'The start time must be before the end time.',
  AVAILABILITY_TIME_OVERLAP: 'This time range overlaps an existing rule for that day.',
  AVAILABILITY_RULE_NOT_FOUND: 'This availability rule no longer exists.',
  AVAILABILITY_FORBIDDEN: 'You do not have access to this availability rule.',
};

export const BOOKING_ERROR_MAP: Record<string, string> = {
  BOOKING_NOT_FOUND: 'This booking could not be found.',
  BOOKING_INVALID_STATUS_TRANSITION: 'That status change is not allowed from the current state.',
  BOOKING_NOT_RESCHEDULABLE: 'Only pending or confirmed bookings can be rescheduled.',
  BOOKING_SLOT_FULL: 'That time slot is full — no seats remain.',
  BOOKING_PAYMENT_NOT_REQUIRED: 'This booking does not require payment.',
  BOOKING_INVALID_PAYMENT_METHOD: 'Only cash bookings can be marked paid here.',
  BOOKING_ALREADY_PAID: 'This booking is already marked as paid.',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled.',
  BOOKING_TERMINAL_STATE: 'Completed or no-show bookings cannot be cancelled.',
  BOOKING_SLOT_LOCKED: 'That time slot is currently held by someone else. Try another.',
  BOOKING_SLOT_NOT_LOCKED: 'The slot lock expired. Please pick the slot again.',
  BOOKING_UNAUTHORIZED: 'That slot is locked by a different session.',
  BOOKING_CALENDAR_SYNC_FAILED: 'The booking was updated but the calendar sync failed.',
};

export const SERVICE_ACTIVATION_ERROR_MAP: Record<string, string> = {
  CATALOG_PRODUCT_INVALID_STATE:
    "This status change isn't allowed from the service's current status.",
  CATALOG_PRODUCT_NO_DESCRIPTION: 'A service description is required.',
  CATALOG_PRODUCT_NO_VARIANTS: 'Set a price before publishing.',
  CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'The booking price must be greater than 0.',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'A booking price must be set before publishing.',
  CATALOG_PRODUCT_SERVICE_NO_DURATION: 'Set a session duration before publishing.',
  CATALOG_PRODUCT_SERVICE_NO_CAPACITY: 'Set the seats per slot (capacity) before publishing.',
  CATALOG_SERVICE_VARIANT_EXISTS: 'This service already has its booking variant.',
};
