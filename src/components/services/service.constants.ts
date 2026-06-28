// ─── Vendor Service / Booking module — display constants & helpers ──────────────

import type {
  BookingMode,
  BookingStatus,
  PaymentStatus,
  ServiceStatus,
  DayOfWeek,
  PeakPriceType,
  ServiceConfig,
} from '@/types/services.types';

// ─── Field limits (kept in sync with service.schemas.ts and API docs) ───────────

// Max images a service product can carry (mirrors physical products).
export const SERVICE_IMAGE_LIMIT = 7;

export const TITLE_MIN = 3;
export const TITLE_MAX = 200;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
export const CANCEL_REASON_MAX = 500;

// ─── Days of week (availability-rules.md: 0 = Sunday … 6 = Saturday) ────────────

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

// Display order Sunday → Saturday.
export const DAY_ORDER: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

// The availability API returns the identifier as `id` on some endpoints and
// `_id` on others; resolve whichever is present (null if the object is unsaved).
export function getAvailabilityRuleId(rule: { _id?: string; id?: string }): string | null {
  return rule._id ?? rule.id ?? null;
}

// ─── Booking mode ───────────────────────────────────────────────────────────────

export const BOOKING_MODES: { value: BookingMode; label: string; description: string }[] = [
  {
    value: 'calendar',
    label: 'Calendar',
    description: 'Customers pick a specific time slot from your availability.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'You arrange the time with the customer after they request it.',
  },
  {
    value: 'capacity',
    label: 'Capacity',
    description: 'Multiple customers can book the same time slot.',
  },
];

export const BOOKING_MODE_LABELS: Record<BookingMode, string> = {
  calendar: 'Calendar',
  manual: 'Manual',
  capacity: 'Capacity',
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
  return config;
}

// ─── Duration presets (minutes) ─────────────────────────────────────────────────

export const DURATION_PRESETS: { value: number; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Status metadata ─────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'orange';

export const SERVICE_STATUS_META: Record<ServiceStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  active: { label: 'Active', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
  pending_review: { label: 'In review', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  'no-show': { label: 'No-show', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  unpaid: { label: 'Unpaid', tone: 'warning' },
  pending: { label: 'Payment pending', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  disputed: { label: 'Disputed', tone: 'orange' },
  failed: { label: 'Payment failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
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
  label: string;
  tone: 'default' | 'destructive';
  /**
   * UI handling hint. `complete` routes through the Complete-Booking settlement
   * dialog (POST /bookings/:id/complete); `cancel` opens the reason dialog;
   * undefined uses the generic status-change confirm.
   */
  kind?: 'complete' | 'cancel';
}

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingTransition[]> = {
  pending: [
    { target: 'confirmed', label: 'Confirm booking', tone: 'default' },
    { target: 'cancelled', label: 'Cancel booking', tone: 'destructive', kind: 'cancel' },
  ],
  confirmed: [
    { target: 'completed', label: 'Complete & settle', tone: 'default', kind: 'complete' },
    { target: 'no-show', label: 'Mark no-show', tone: 'destructive' },
    { target: 'cancelled', label: 'Cancel booking', tone: 'destructive', kind: 'cancel' },
  ],
  completed: [],
  'no-show': [],
  cancelled: [],
};

export const TERMINAL_BOOKING_STATES: BookingStatus[] = ['completed', 'no-show', 'cancelled'];

// ─── Money ───────────────────────────────────────────────────────────────────────

/**
 * Format a minor-unit amount (e.g. booking `priceSnapshot` 5000 = 50.00 XAF).
 * Booking amounts from the API are in the smallest currency unit.
 */
export function formatMinor(amount: number, currency = 'XAF'): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${new Intl.NumberFormat().format(major)} ${currency}`;
  }
}

/**
 * Format a major-unit amount (e.g. a service price as entered in the variant
 * editor convention — decimals allowed, no implicit /100).
 */
export function formatPrice(amount: number, currency = 'XAF'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat().format(amount)} ${currency}`;
  }
}

// ─── Date / time helpers ─────────────────────────────────────────────────────────

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  const future = sec < 0;
  const abs = Math.abs(sec);
  const fmt = (n: number, unit: string) => (future ? `in ${n}${unit}` : `${n}${unit} ago`);
  if (abs < 45) return 'just now';
  const min = Math.round(abs / 60);
  if (min < 60) return fmt(min, 'm');
  const hr = Math.round(min / 60);
  if (hr < 24) return fmt(hr, 'h');
  const day = Math.round(hr / 24);
  if (day < 30) return fmt(day, 'd');
  return formatDate(iso);
}

/** Browser's IANA timezone, used as the default for new availability rules. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

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

// ─── Responsive sheet (mirrors the customers/tickets convention) ────────────────

export function responsiveSheetProps(
  isMobile: boolean,
  desktopWidth = 'sm:max-w-xl',
): { side: 'bottom' | 'right'; className: string } {
  return isMobile
    ? { side: 'bottom', className: 'h-[92vh] rounded-t-2xl' }
    : { side: 'right', className: `w-full ${desktopWidth}` };
}

// ─── Service status transitions (mirrors products STATUS_TRANSITIONS) ────────────

export interface ServiceStatusTransition {
  target: ServiceStatus;
  label: string;
  destructive: boolean;
  needsPreflight: boolean;
  confirmMessage?: string;
}

export const SERVICE_STATUS_TRANSITIONS: Record<ServiceStatus, ServiceStatusTransition[]> = {
  draft: [
    { target: 'active', label: 'Publish service', destructive: false, needsPreflight: true },
    {
      target: 'archived',
      label: 'Archive',
      destructive: true,
      needsPreflight: false,
      confirmMessage: 'Archive this service? It will no longer be bookable.',
    },
  ],
  active: [
    {
      target: 'draft',
      label: 'Unpublish (draft)',
      destructive: false,
      needsPreflight: false,
      confirmMessage: 'Unpublish this service? It will stop accepting new bookings.',
    },
    {
      target: 'archived',
      label: 'Archive',
      destructive: true,
      needsPreflight: false,
      confirmMessage: 'Archive this live service? It will stop accepting new bookings immediately.',
    },
  ],
  archived: [
    { target: 'draft', label: 'Restore to draft', destructive: false, needsPreflight: false },
  ],
  pending_review: [
    { target: 'draft', label: 'Cancel review & edit', destructive: false, needsPreflight: false },
  ],
  suspended: [],
};
