// ─── Vendor Service / Booking module — display constants & helpers ──────────────
//
// This module is imported by mobile and desktop surfaces alike and has no React
// context of its own, so every user-visible label is exported as a
// `TranslationKey` and resolved by the call site. See src/i18n/README.md.

import type { TranslationKey } from '@/i18n';
import type {
  BookingMode,
  BookingStatus,
  PaymentStatus,
  ServiceStatus,
  DayOfWeek,
  PeakPriceType,
  ServiceConfig,
  ServiceLocationKind,
} from '@/types/services.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// ─── Field limits (kept in sync with service.schemas.ts and API docs) ───────────

// Max images a service product can carry (mirrors physical products).
export const SERVICE_IMAGE_LIMIT = 7;

export const TITLE_MIN = 3;
export const TITLE_MAX = 200;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
export const CANCEL_REASON_MAX = 500;

/**
 * The service's `vendor_address` isn't on the profile (any more) — on saving
 * the booking settings and at publishing. Shown next to the Where section.
 */
export const LOCATION_ADDRESS_MISSING = 'CATALOG_PRODUCT_SERVICE_LOCATION_ADDRESS_MISSING';

// Access details (variants.md / bookings.md → Edit a booking's access details).
export const MEETING_URL_MAX = 500;
export const ACCESS_INSTRUCTIONS_MAX = 2000;
export const REVEAL_MINUTES_MAX = 1440;
export const REVEAL_MINUTES_DEFAULT = 30;

/**
 * The server's access rules, as translation keys per field — shared by the
 * service form and the one-booking editor so both refuse the same things.
 * Empty text is fine (it clears the field).
 */
export function accessFieldErrors(v: {
  meetingUrl: string;
  instructions: string;
  revealMinutesBefore?: number;
}): Partial<Record<'meetingUrl' | 'instructions' | 'revealMinutesBefore', TranslationKey>> {
  const out: Partial<Record<'meetingUrl' | 'instructions' | 'revealMinutesBefore', TranslationKey>> = {};
  const url = v.meetingUrl.trim();
  if (url) {
    if (!/^https:\/\/\S+$/i.test(url)) out.meetingUrl = 'services.validation.meetingUrlHttps';
    else if (url.length > MEETING_URL_MAX) out.meetingUrl = 'services.validation.meetingUrlMax';
  }
  if (v.instructions.trim().length > ACCESS_INSTRUCTIONS_MAX) {
    out.instructions = 'services.validation.instructionsMax';
  }
  const m = v.revealMinutesBefore;
  if (m == null || !Number.isInteger(m) || m < 0 || m > REVEAL_MINUTES_MAX) {
    out.revealMinutesBefore = 'services.validation.revealRange';
  }
  return out;
}

/** "Open in Maps" for an address: the coordinates when known, else the text. */
export function mapsUrl(location: {
  coordinates?: [number, number] | null;
  formattedAddress?: string | null;
  addressLine1?: string | null;
  city?: string | null;
}): string | null {
  const c = location.coordinates;
  if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
    // GeoJSON is [longitude, latitude]; Maps wants "lat,lng".
    return `https://www.google.com/maps/search/?api=1&query=${c[1]},${c[0]}`;
  }
  const text = location.formattedAddress || [location.addressLine1, location.city].filter(Boolean).join(', ');
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}

// ─── Days of week (availability-rules.md: 0 = Sunday … 6 = Saturday) ────────────

export const DAY_LABEL_KEYS: Record<DayOfWeek, TranslationKey> = {
  0: 'services.days.sunday',
  1: 'services.days.monday',
  2: 'services.days.tuesday',
  3: 'services.days.wednesday',
  4: 'services.days.thursday',
  5: 'services.days.friday',
  6: 'services.days.saturday',
};

export const DAY_SHORT_KEYS: Record<DayOfWeek, TranslationKey> = {
  0: 'services.daysShort.sunday',
  1: 'services.daysShort.monday',
  2: 'services.daysShort.tuesday',
  3: 'services.daysShort.wednesday',
  4: 'services.daysShort.thursday',
  5: 'services.daysShort.friday',
  6: 'services.daysShort.saturday',
};

// Display order Sunday → Saturday.
export const DAY_ORDER: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

// The availability API returns the identifier as `id` on some endpoints and
// `_id` on others; resolve whichever is present (null if the object is unsaved).
export function getAvailabilityRuleId(rule: { _id?: string; id?: string }): string | null {
  return rule._id ?? rule.id ?? null;
}

// ─── Booking mode ───────────────────────────────────────────────────────────────

export const BOOKING_MODES: {
  value: BookingMode;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  {
    value: 'calendar',
    labelKey: 'services.bookingMode.calendar',
    descriptionKey: 'services.bookingModeHelp.calendar',
  },
  {
    value: 'manual',
    labelKey: 'services.bookingMode.manual',
    descriptionKey: 'services.bookingModeHelp.manual',
  },
  {
    value: 'capacity',
    labelKey: 'services.bookingMode.capacity',
    descriptionKey: 'services.bookingModeHelp.capacity',
  },
];

export const BOOKING_MODE_LABEL_KEYS: Record<BookingMode, TranslationKey> = {
  calendar: 'services.bookingMode.calendar',
  manual: 'services.bookingMode.manual',
  capacity: 'services.bookingMode.capacity',
};

export const LOCATION_KIND_LABEL_KEYS: Record<ServiceLocationKind, TranslationKey> = {
  vendor_address: 'services.location.kinds.vendorAddress',
  customer_address: 'services.location.kinds.customerAddress',
  online: 'services.location.kinds.online',
};

// ─── Shared service-config form shape + builder ─────────────────────────────────
// serviceConfig + price live on the single service variant. Both the create and
// settings forms carry this shape; `buildServiceConfig` maps it to the API config.

export interface ServiceConfigFormShape {
  durationMinutes: number;
  price: number;
  bookingMode: BookingMode;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  maxBookings?: number;
  peakHoursEnabled: boolean;
  peakHours: {
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    priceType: PeakPriceType;
    value: number;
  };
  /** `''` until chosen. */
  locationKind: ServiceLocationKind | '';
  vendorAddressId: string;
  meetingUrl: string;
  instructions: string;
  revealMinutesBefore?: number;
}

/**
 * Build the API `serviceConfig` from form values: drops empty buffers, includes
 * `maxBookings` only for capacity mode, and `peakHours` only when enabled.
 */
export function buildServiceConfig(v: ServiceConfigFormShape): ServiceConfig {
  const config: ServiceConfig = {
    durationMinutes: v.durationMinutes,
    bufferBeforeMinutes: v.bufferBeforeMinutes || 0,
    bufferAfterMinutes: v.bufferAfterMinutes || 0,
    bookingMode: v.bookingMode,
  };
  if (v.bookingMode === 'capacity' && v.maxBookings) {
    config.maxBookings = v.maxBookings;
  }
  if (v.peakHoursEnabled) {
    config.peakHours = {
      daysOfWeek: (v.peakHours.daysOfWeek ?? []) as DayOfWeek[],
      startTime: v.peakHours.startTime,
      endTime: v.peakHours.endTime,
      priceType: v.peakHours.priceType,
      value: v.peakHours.value,
    };
  }
  // Replaced whole by the server when sent. The schema refuses a blank kind,
  // so `''` only reaches here from a caller that skipped validation.
  if (v.locationKind) {
    config.location = v.locationKind === 'vendor_address'
      ? { kind: 'vendor_address', vendorAddressId: v.vendorAddressId }
      : { kind: v.locationKind };
  }
  // The form shows the whole current state, so every field is sent; an emptied
  // box is the vendor clearing it (`null`).
  config.access = {
    meetingUrl: v.meetingUrl.trim() || null,
    instructions: v.instructions.trim() || null,
    revealMinutesBefore: v.revealMinutesBefore ?? REVEAL_MINUTES_DEFAULT,
  };
  return config;
}

// ─── Duration presets (minutes) ─────────────────────────────────────────────────

export const DURATION_PRESETS: { value: number; labelKey: TranslationKey }[] = [
  { value: 15, labelKey: 'services.duration.presets.min15' },
  { value: 30, labelKey: 'services.duration.presets.min30' },
  { value: 45, labelKey: 'services.duration.presets.min45' },
  { value: 60, labelKey: 'services.duration.presets.hour1' },
  { value: 90, labelKey: 'services.duration.presets.hour1h30' },
  { value: 120, labelKey: 'services.duration.presets.hour2' },
];

/**
 * Compact session length ("45 min", "1h", "1h 30m").
 * Takes the translator so this module needs no React context of its own —
 * same convention as `relativeTime` in ticket.constants.
 */
export function formatDuration(minutes: number | null, t: Translate): string {
  if (!minutes || minutes <= 0) return t('common.labels.emptyValue');
  if (minutes < 60) return t('services.duration.minutes', { minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0
    ? t('services.duration.hours', { hours: h })
    : t('services.duration.hoursMinutes', { hours: h, minutes: m });
}

// ─── Status metadata ─────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'orange';

export const SERVICE_STATUS_META: Record<ServiceStatus, { labelKey: TranslationKey; tone: BadgeTone }> = {
  draft: { labelKey: 'services.status.draft', tone: 'neutral' },
  active: { labelKey: 'services.status.active', tone: 'success' },
  archived: { labelKey: 'services.status.archived', tone: 'neutral' },
  pending_review: { labelKey: 'services.status.pending_review', tone: 'warning' },
  suspended: { labelKey: 'services.status.suspended', tone: 'danger' },
};

export const BOOKING_STATUS_META: Record<BookingStatus, { labelKey: TranslationKey; tone: BadgeTone }> = {
  pending: { labelKey: 'services.booking.status.pending', tone: 'warning' },
  confirmed: { labelKey: 'services.booking.status.confirmed', tone: 'info' },
  completed: { labelKey: 'services.booking.status.completed', tone: 'success' },
  'no-show': { labelKey: 'services.booking.status.no-show', tone: 'danger' },
  cancelled: { labelKey: 'services.booking.status.cancelled', tone: 'neutral' },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { labelKey: TranslationKey; tone: BadgeTone }> = {
  unpaid: { labelKey: 'services.booking.payment.unpaid', tone: 'warning' },
  pending: { labelKey: 'services.booking.payment.pending', tone: 'warning' },
  paid: { labelKey: 'services.booking.payment.paid', tone: 'success' },
  disputed: { labelKey: 'services.booking.payment.disputed', tone: 'orange' },
  failed: { labelKey: 'services.booking.payment.failed', tone: 'danger' },
  // Owed back but not yet sent — a manual payout is queued behind a support
  // ticket, so it is in-flight rather than finished.
  refund_pending: { labelKey: 'services.booking.payment.refund_pending', tone: 'warning' },
  refunded: { labelKey: 'services.booking.payment.refunded', tone: 'neutral' },
};

/** Shorter payment wording for filter chips, where "Payment" is already said. */
export const PAYMENT_STATUS_FILTER_KEYS: Record<PaymentStatus, TranslationKey> = {
  unpaid: 'services.booking.paymentShort.unpaid',
  pending: 'services.booking.paymentShort.pending',
  paid: 'services.booking.paymentShort.paid',
  disputed: 'services.booking.paymentShort.disputed',
  failed: 'services.booking.paymentShort.failed',
  refund_pending: 'services.booking.paymentShort.refund_pending',
  refunded: 'services.booking.paymentShort.refunded',
};

// Tailwind classes per tone — applied by the badge wrappers.
export const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
};

// ─── Booking status state machine (bookings.md) ─────────────────────────────────
// Allowed transitions a vendor can trigger from each state.

export interface BookingTransition {
  target: BookingStatus;
  labelKey: TranslationKey;
  tone: 'default' | 'destructive';
  /**
   * UI handling hint. `complete` routes through the Complete-Booking settlement
   * dialog (POST /bookings/:id/complete); `cancel` opens the reason dialog;
   * undefined uses the generic status-change confirm.
   *
   * ⛔ Every `cancelled` transition must keep `kind: 'cancel'`. That sends
   * POST /bookings/:id/cancel, which refunds a paid booking. PATCH …/status
   * with `cancelled` refunds nothing and, since 2026-10-05, pauses the earnings
   * on a paid booking instead (FRONTEND-CHANGELOG-earnings-hold-and-pauses § 3).
   */
  kind?: 'complete' | 'cancel';
}

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingTransition[]> = {
  pending: [
    { target: 'confirmed', labelKey: 'services.booking.transitions.confirm', tone: 'default' },
    {
      target: 'cancelled',
      labelKey: 'services.booking.transitions.cancel',
      tone: 'destructive',
      kind: 'cancel',
    },
  ],
  confirmed: [
    {
      target: 'completed',
      labelKey: 'services.booking.transitions.complete',
      tone: 'default',
      kind: 'complete',
    },
    { target: 'no-show', labelKey: 'services.booking.transitions.noShow', tone: 'destructive' },
    {
      target: 'cancelled',
      labelKey: 'services.booking.transitions.cancel',
      tone: 'destructive',
      kind: 'cancel',
    },
  ],
  completed: [],
  'no-show': [],
  cancelled: [],
};

export const TERMINAL_BOOKING_STATES: BookingStatus[] = ['completed', 'no-show', 'cancelled'];

// Booking amounts (`priceSnapshot`, `settlement.*`) are the service's price as
// the vendor typed it — 5000 is 5 000 XAF — so they go to `fmt.currency` as-is.
// A `toMajorUnits` (÷100) used to sit here, trusting bookings.md's "smallest
// currency unit" line; a 5 000 XAF booking showed as 50 XAF. XAF has no cents.

/** The customer's note on a booking (`metadata.notes`), or `null`. */
export function customerNote(metadata: Record<string, unknown> | null | undefined): string | null {
  const notes = metadata?.notes;
  return typeof notes === 'string' && notes.trim() ? notes.trim() : null;
}

// ─── Timezones ───────────────────────────────────────────────────────────────────

// `browserTimezone()` used to seed new availability rules. It is gone on
// purpose: a rule with no timezone inherits the vendor profile's, which is the
// shop's own zone — the browser's is wherever its owner happens to be sitting.

// A small curated timezone list for the rule form; the browser tz is prepended.
export const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Douala',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
];

// ─── Service status transitions (mirrors products STATUS_TRANSITIONS) ────────────

export interface ServiceStatusTransition {
  target: ServiceStatus;
  labelKey: TranslationKey;
  destructive: boolean;
  needsPreflight: boolean;
  confirmKey?: TranslationKey;
}

export const SERVICE_STATUS_TRANSITIONS: Record<ServiceStatus, ServiceStatusTransition[]> = {
  draft: [
    {
      target: 'active',
      labelKey: 'services.transitions.publish',
      destructive: false,
      needsPreflight: true,
    },
    {
      target: 'archived',
      labelKey: 'services.transitions.archive',
      destructive: true,
      needsPreflight: false,
      confirmKey: 'services.transitions.confirm.archiveDraft',
    },
  ],
  active: [
    {
      target: 'draft',
      labelKey: 'services.transitions.unpublish',
      destructive: false,
      needsPreflight: false,
      confirmKey: 'services.transitions.confirm.unpublish',
    },
    {
      target: 'archived',
      labelKey: 'services.transitions.archive',
      destructive: true,
      needsPreflight: false,
      confirmKey: 'services.transitions.confirm.archiveActive',
    },
  ],
  archived: [
    {
      target: 'draft',
      labelKey: 'services.transitions.restore',
      destructive: false,
      needsPreflight: false,
    },
  ],
  // System-locked statuses — no vendor-triggered transitions allowed (backend
  // returns CATALOG_PRODUCT_INVALID_STATE). See api-doc/vendor/products.md.
  pending_review: [],
  suspended: [],
};
