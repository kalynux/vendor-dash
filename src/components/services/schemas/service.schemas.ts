import { z } from 'zod';
import type { TranslationKey } from '@/i18n';
import {
  TITLE_MIN,
  TITLE_MAX,
  SEO_TITLE_MAX,
  SEO_DESCRIPTION_MAX,
} from '@/components/services/service.constants';

// HH:mm, 24-hour with leading zeros (availability-rules.md → Time Format).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Every message below is a *translation key*, not a sentence: a zod schema is
// built at module load, long before a locale exists. The components render
// `errors.<field>.message` through `useMessage()`, which resolves the key.

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
  value: z
    .number({ message: 'services.validation.surchargeRequired' })
    .min(0, 'services.validation.surchargeMin'),
});

export const serviceConfigFields = {
  durationMinutes: z
    .number({ message: 'services.validation.durationRequired' })
    .int('services.validation.durationInteger')
    .min(1, 'services.validation.durationMin'),
  price: z
    .number({ message: 'services.validation.priceRequired' })
    .min(0.01, 'services.validation.priceMin'),
  bookingMode: z.enum(['calendar', 'manual', 'capacity']),
  bufferBeforeMinutes: z.number().int().min(0, 'services.validation.bufferMin').optional(),
  bufferAfterMinutes: z.number().int().min(0, 'services.validation.bufferMin').optional(),
  maxBookings: z
    .number()
    .int('services.validation.seatsInteger')
    .min(1, 'services.validation.seatsMin')
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
      message: 'services.validation.seatsRequired',
      path: ['maxBookings'],
    });
  }
  if (v.peakHoursEnabled) {
    const p = v.peakHours;
    if (!TIME_RE.test(p.startTime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'services.validation.timeFormat',
        path: ['peakHours', 'startTime'],
      });
    }
    if (!TIME_RE.test(p.endTime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'services.validation.timeFormat',
        path: ['peakHours', 'endTime'],
      });
    }
    if (TIME_RE.test(p.startTime) && TIME_RE.test(p.endTime) && p.startTime >= p.endTime) {
      ctx.addIssue({
        code: 'custom',
        message: 'services.validation.timeOrder',
        path: ['peakHours', 'endTime'],
      });
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
      .min(TITLE_MIN, 'services.validation.titleMin')
      .max(TITLE_MAX, 'services.validation.titleMax'),
    category: z.string().min(1, 'services.validation.categoryRequired'),
    description: z.string().min(1, 'services.validation.descriptionRequired'),
    tags: z
      .array(z.string().min(1, 'services.validation.tagEmpty'))
      .refine((arr) => new Set(arr).size === arr.length, {
        message: 'services.validation.tagsUnique',
      }),
    ...serviceConfigFields,
  })
  .superRefine(serviceConfigRefine);

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>;

// ─── Edit basics (detail sheet) ──────────────────────────────────────────────────

export const serviceBasicsSchema = z.object({
  title: z
    .string()
    .min(TITLE_MIN, 'services.validation.titleMin')
    .max(TITLE_MAX, 'services.validation.titleMax'),
  category: z.string().min(1, 'services.validation.categoryRequired'),
  description: z.string().min(1, 'services.validation.descriptionRequired'),
  seoTitle: z
    .string()
    .max(SEO_TITLE_MAX, 'services.validation.seoTitleMax')
    .optional()
    .or(z.literal('')),
  seoDescription: z
    .string()
    .max(SEO_DESCRIPTION_MAX, 'services.validation.seoDescriptionMax')
    .optional()
    .or(z.literal('')),
  tags: z
    .array(z.string().min(1, 'services.validation.tagEmpty'))
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'services.validation.tagsUnique',
    }),
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
}): TranslationKey[] {
  const errors: TranslationKey[] = [];
  if (!params.description.trim()) errors.push('services.activation.noDescription');
  if (!params.durationMinutes || params.durationMinutes < 1) {
    errors.push('services.activation.noDuration');
  }
  if (params.price === null) {
    errors.push('services.activation.noPrice');
  } else if (params.price <= 0) {
    errors.push('services.activation.zeroPrice');
  }
  if (!params.hasDefaultVariant) {
    errors.push('services.activation.noVariant');
  }
  if (params.bookingMode === 'capacity' && (!params.maxBookings || params.maxBookings < 1)) {
    errors.push('services.activation.noCapacity');
  }
  return errors;
}
