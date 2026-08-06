import { z } from 'zod';

import { isValidE164 } from '@/lib/phone';

// ─── Payout details (one entry in the array) ──────────────────────────────────

const mobileMoneySchema = z.object({
    provider: z.string().min(1, 'onboarding.validation.providerRequired').trim(),
    // Stored as E.164 by `<PhoneInput>` and validated against the numbering plan
    // of the country it names — money moves to this number.
    phone_number: z
        .string()
        .trim()
        .min(1, 'common.validation.phoneRequired')
        .refine(isValidE164, 'common.validation.phone'),
    account_name: z.string().min(1, 'onboarding.validation.accountNameRequired').trim(),
});

const bankSchema = z.object({
    bank_name: z.string().min(1, 'onboarding.validation.bankNameRequired').trim(),
    account_number: z.string().min(1, 'onboarding.validation.accountNumberRequired').trim(),
    account_name: z.string().min(1, 'onboarding.validation.accountNameRequired').trim(),
    country: z.string().length(2, 'onboarding.validation.countryIso2').toUpperCase(),
});

export const payoutDetailsSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('mobile_money'),
        mobile_money: mobileMoneySchema,
        bank: z.null().optional(),
    }),
    z.object({
        method: z.literal('bank'),
        mobile_money: z.null().optional(),
        bank: bankSchema,
    }),
]);

export type PayoutDetailsFormValues = z.infer<typeof payoutDetailsSchema>;
export type PayoutMethod = 'mobile_money' | 'bank';

// ─── Step 1: Basic Setup ──────────────────────────────────────────────────────
// payout_details is an ordered array — index 0 is the preferred method.
// Min 1, max 3 entries (matches backend constraints).

export const step1Schema = z.object({
    country: z
        .string()
        .length(2, 'onboarding.validation.countryIso2Letters')
        .toUpperCase(),
    timezone: z.string().min(1, 'onboarding.validation.timezoneRequired'),
    payout_details: z
        .array(payoutDetailsSchema)
        .min(1, 'onboarding.validation.payoutMethodMin')
        .max(3, 'onboarding.validation.payoutMethodMax'),
});

export type Step1FormValues = z.infer<typeof step1Schema>;

// ─── Step 2: Delivery Linking ─────────────────────────────────────────────────
// Agency assignment no longer happens on this step — it's a pure step-advance.
// The only thing worth persisting across back-navigation is which branch
// (physical vs service-only) the vendor picked.

export const step2Schema = z.object({
    productType: z.enum(['physical', 'service']).nullable(),
});

export type Step2FormValues = z.infer<typeof step2Schema>;

// ─── Step 3: Branding (skippable) ─────────────────────────────────────────────

// Canonical geospatial address attached to a business address (see api-doc/geo/README.md).
// `resolved_at` is deliberately OMITTED — it is server-assigned, and leaving it
// out of the schema means zod strips it from submitted values automatically.
const geoPointFormSchema = z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
});

export const geoAddressFormSchema = z.object({
    formatted_address: z.string(),
    coordinates: geoPointFormSchema,
    provider: z.string().nullish(),
    provider_place_id: z.string().nullish(),
    components: z
        .object({
            street: z.string().nullish(),
            neighbourhood: z.string().nullish(),
            city: z.string().nullish(),
            region: z.string().nullish(),
            country: z.string().nullish(),
            country_code: z.string().nullish(),
            postal_code: z.string().nullish(),
        })
        .nullish(),
    raw_input: z.string().optional(),
});

export const businessAddressSchema = z.object({
    /**
     * Existing address's Mongo id — omit for a brand-new address. Must be
     * echoed back unchanged on resubmit (full-replace endpoint), otherwise a
     * fresh id is generated and any product's pickupLocation pointing at the
     * old one is demoted to draft. Never shown to the vendor.
     */
    _id: z.string().optional(),
    /** Required by the backend — identifies the location (e.g. "Main Office", "Warehouse"). */
    label: z.string().min(1, 'onboarding.validation.labelRequired').max(50, 'onboarding.validation.labelMax'),
    address_line1: z.string().min(1, 'onboarding.validation.addressRequired').max(200, 'onboarding.validation.addressMax'),
    address_line2: z.string().max(200, 'onboarding.validation.addressMax').optional().or(z.literal('')),
    city: z.string().min(1, 'onboarding.validation.cityRequired').max(100, 'onboarding.validation.cityMax'),
    state: z.string().max(100, 'onboarding.validation.stateMax').optional().or(z.literal('')),
    /** Canonical geospatial address from the search box. Preserved on resubmit. */
    geo: geoAddressFormSchema.nullish(),
});

export const step3Schema = z.object({
    logo_file_id: z.string().nullable().optional(),
    cover_image_file_id: z.string().nullable().optional(),
    business_addresses: z.array(businessAddressSchema).optional(),
});

export type Step3FormValues = z.infer<typeof step3Schema>;

// ─── Step 4: Policy Setup (fully optional — all sub-policies are independent) ─

const returnPolicySchema = z.object({
    return_eligible: z.boolean(),
    return_window_days: z.coerce.number().int().min(0, 'onboarding.validation.min0').max(180, 'onboarding.validation.max180Days'),
    refund_type: z.enum(['full', 'partial', 'none']),
    refund_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
    return_shipping_payer: z.enum(['vendor', 'customer', 'customer_reimbursed_if_defect']),
    refund_processing_days: z.coerce.number().int().min(1, 'onboarding.validation.min1').max(30, 'onboarding.validation.max30Days'),
    return_condition_notes: z.string().max(500, 'onboarding.validation.max500Chars').nullable().optional(),
}).superRefine((val, ctx) => {
    if (val.refund_type === 'partial' && (val.refund_percentage == null)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'onboarding.validation.refundPercentageRequired',
            path: ['refund_percentage'],
        });
    }
});

const cancellationPolicySchema = z.object({
    cancellable: z.boolean(),
    cancellation_deadline: z.string().nullable().optional(),
    cancellation_deadline_days: z.coerce.number().int().min(0, 'onboarding.validation.min0').nullable().optional(),
    cancellation_fee_type: z.enum(['none', 'fixed', 'percentage', 'full_non_refundable']).nullable().optional(),
    cancellation_fee_value: z.coerce.number().min(0, 'onboarding.validation.min0').nullable().optional(),
    late_cancellation_refund_type: z.enum(['fixed', 'percentage', 'full_non_refundable']).nullable().optional(),
    late_cancellation_refund_value: z.coerce.number().min(0, 'onboarding.validation.min0').nullable().optional(),
}).superRefine((val, ctx) => {
    if (
        val.cancellation_deadline === 'anytime_until_days_before_delivery' &&
        val.cancellation_deadline_days == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'onboarding.validation.daysRequired',
            path: ['cancellation_deadline_days'],
        });
    }
    if (
        (val.cancellation_fee_type === 'fixed' || val.cancellation_fee_type === 'percentage') &&
        val.cancellation_fee_value == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'onboarding.validation.feeValueRequired',
            path: ['cancellation_fee_value'],
        });
    }
    if (
        (val.late_cancellation_refund_type === 'fixed' || val.late_cancellation_refund_type === 'percentage') &&
        val.late_cancellation_refund_value == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'onboarding.validation.refundValueRequired',
            path: ['late_cancellation_refund_value'],
        });
    }
});

const supportChannelSchema = z
    .object({
        type: z.enum(['email', 'phone', 'whatsapp', 'telegram']),
        contact: z.string().min(1, 'onboarding.validation.contactRequired').max(200, 'onboarding.validation.max200Chars'),
    })
    // A phone/WhatsApp channel is a dialable number in E.164 — the same bar every
    // other phone field in the dashboard is held to. Email and Telegram are free text.
    .superRefine((val, ctx) => {
        const isPhoneChannel = val.type === 'phone' || val.type === 'whatsapp';
        if (isPhoneChannel && val.contact && !isValidE164(val.contact)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'common.validation.phone',
                path: ['contact'],
            });
        }
    });

const supportPolicySchema = z.object({
    channels: z.array(supportChannelSchema).max(4, 'onboarding.validation.maxChannels'),
    eligibility_notes: z.string().max(500, 'onboarding.validation.max500Chars').nullable().optional(),
    required_info: z.array(z.enum(['order_number', 'product_photo_video', 'tracking_number'])).optional(),
    availability: z.enum(['24_7', 'business_hours', 'limited']).nullable().optional(),
    availability_description: z.string().max(200, 'onboarding.validation.max200Chars').nullable().optional(),
    languages: z.array(z.string().max(50, 'onboarding.validation.max50Chars')).max(20, 'onboarding.validation.maxLanguages').optional(),
});

export const step4Schema = z.object({
    return_policy: returnPolicySchema.optional(),
    cancellation_policy: cancellationPolicySchema.optional(),
    support_policy: supportPolicySchema.optional(),
    documents: z.array(z.string()).max(2, 'onboarding.validation.maxDocuments').optional(),
});

export type Step4FormValues = z.infer<typeof step4Schema>;
