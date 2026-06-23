import { z } from 'zod';
import {
  TITLE_MIN,
  TITLE_MAX,
  SEO_TITLE_MAX,
  SEO_DESCRIPTION_MAX,
} from '@/components/services/service.constants';

// HH:mm, 24-hour with leading zeros (availability-rules.md → Time Format).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Shared serviceConfig + price fragment ──────────────────────────────────────
// serviceConfig + price live on the single service variant. The create and edit
// forms share this fragment plus a `superRefine` for the conditional rules:
//   • maxBookings is required (≥1) only when bookingMode is 'capacity'
//   • peakHours fields are validated only when peakHoursEnabled is on
// `peakHours` is always present in the form (with defaults); it's stripped before
// submit when the toggle is off.

export const peakPriceTypes = ['fixed', 'percentage'] as const;

const peakHoursFormSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)), // empty = every day
  startTime: z.string(),
  endTime: z.string(),
  priceType: z.enum(peakPriceTypes),
  value: z.number({ message: 'Surcharge value is required' }).min(0, 'Cannot be negative'),
});

export const serviceConfigFields = {
  durationMinutes: z
    .number({ message: 'Duration is required' })
    .int('Duration must be a whole number of minutes')
    .min(1, 'Duration must be at least 1 minute'),
  price: z.number({ message: 'Price is required' }).min(0.01, 'Price must be greater than 0'),
  bookingMode: z.enum(['calendar', 'manual', 'capacity']),
  bufferBeforeMinutes: z.number().int().min(0, 'Buffer cannot be negative').optional(),
  bufferAfterMinutes: z.number().int().min(0, 'Buffer cannot be negative').optional(),
  maxBookings: z
    .number()
    .int('Seats must be a whole number')
    .min(1, 'At least 1 seat')
    .optional(),
  peakHoursEnabled: z.boolean(),
  peakHours: peakHoursFormSchema,
};

// Conditional capacity + peak-hours rules, shared by the create + settings
// schemas. Typed to the structural subset both schemas carry — contravariance
// makes it assignable to each schema's full `superRefine` callback.
interface ServiceConfigRefineInput {
  bookingMode: 'calendar' | 'manual' | 'capacity';
  maxBookings?: number;
  peakHoursEnabled: boolean;
  peakHours: { startTime: string; endTime: string };
}

function serviceConfigRefine(v: ServiceConfigRefineInput, ctx: z.RefinementCtx): void {
  if (v.bookingMode === 'capacity' && (v.maxBookings == null || v.maxBookings < 1)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Set the seats per slot for capacity bookings',
      path: ['maxBookings'],
    });
  }
  if (v.peakHoursEnabled) {
    const p = v.peakHours;
    if (!TIME_RE.test(p.startTime)) {
      ctx.addIssue({ code: 'custom', message: 'Use 24-hour HH:mm', path: ['peakHours', 'startTime'] });
    }
    if (!TIME_RE.test(p.endTime)) {
      ctx.addIssue({ code: 'custom', message: 'Use 24-hour HH:mm', path: ['peakHours', 'endTime'] });
    }
    if (TIME_RE.test(p.startTime) && TIME_RE.test(p.endTime) && p.startTime >= p.endTime) {
      ctx.addIssue({ code: 'custom', message: 'End must be after start', path: ['peakHours', 'endTime'] });
    }
  }
}

// Default peak-hours block used when the toggle is first switched on / form reset.
export const DEFAULT_PEAK_HOURS = {
  daysOfWeek: [] as number[],
  startTime: '18:00',
  endTime: '21:00',
  priceType: 'percentage' as const,
  value: 0,
};

// ─── Create service ─────────────────────────────────────────────────────────────
// Collects everything the multi-step backend flow needs in one form: product
// basics + serviceConfig + the booking price. Submission orchestrates the
// create product → create service variant (price + serviceConfig) calls.

export const createServiceSchema = z
  .object({
    title: z
      .string()
      .min(TITLE_MIN, `Title must be at least ${TITLE_MIN} characters`)
      .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or less`),
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    tags: z
      .array(z.string().min(1, 'Tag cannot be empty'))
      .refine((arr) => new Set(arr).size === arr.length, { message: 'Tags must be unique' }),
    ...serviceConfigFields,
  })
  .superRefine(serviceConfigRefine);

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>;

// ─── Edit basics (detail sheet) ──────────────────────────────────────────────────

export const serviceBasicsSchema = z.object({
  title: z
    .string()
    .min(TITLE_MIN, `Title must be at least ${TITLE_MIN} characters`)
    .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or less`),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  seoTitle: z.string().max(SEO_TITLE_MAX, `SEO title must be ${SEO_TITLE_MAX} characters or less`).optional().or(z.literal('')),
  seoDescription: z
    .string()
    .max(SEO_DESCRIPTION_MAX, `SEO description must be ${SEO_DESCRIPTION_MAX} characters or less`)
    .optional()
    .or(z.literal('')),
  tags: z
    .array(z.string().min(1, 'Tag cannot be empty'))
    .refine((arr) => new Set(arr).size === arr.length, { message: 'Tags must be unique' }),
});

export type ServiceBasicsFormValues = z.infer<typeof serviceBasicsSchema>;

// ─── Booking settings (serviceConfig + price) ───────────────────────────────────

export const serviceSettingsSchema = z
  .object({ ...serviceConfigFields })
  .superRefine(serviceConfigRefine);

export type ServiceSettingsFormValues = z.infer<typeof serviceSettingsSchema>;

// Availability rules are edited inline (AvailabilityRulesEditor) with a
// day-centric schedule + client-side time validation — no zod form schema.

// ─── Client-side activation pre-flight (mirrors backend Activation Requirements) ─

export function validateServiceActivation(params: {
  description: string;
  durationMinutes: number | null;
  price: number | null;
  hasDefaultVariant: boolean;
  bookingMode?: import('@/types/services.types').BookingMode | null;
  maxBookings?: number | null;
}): string[] {
  const errors: string[] = [];
  if (!params.description.trim()) errors.push('A service description is required.');
  if (!params.durationMinutes || params.durationMinutes < 1) {
    errors.push('Set a session duration before publishing.');
  }
  if (params.price === null) {
    errors.push('Set a booking price before publishing.');
  } else if (params.price <= 0) {
    errors.push('The booking price must be greater than 0.');
  }
  if (!params.hasDefaultVariant) {
    errors.push('A booking price must be saved before publishing.');
  }
  if (params.bookingMode === 'capacity' && (!params.maxBookings || params.maxBookings < 1)) {
    errors.push('Set the seats per slot (capacity) before publishing.');
  }
  return errors;
}
