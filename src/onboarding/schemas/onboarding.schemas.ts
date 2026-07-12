import { z } from 'zod';

// ─── Payout details (one entry in the array) ──────────────────────────────────

const mobileMoneySchema = z.object({
    provider: z.string().min(1, 'Provider is required').trim(),
    phone_number: z.string().min(6, 'Phone number too short').max(20, 'Phone number too long').trim(),
    account_name: z.string().min(1, 'Account name is required').trim(),
});

const bankSchema = z.object({
    bank_name: z.string().min(1, 'Bank name is required').trim(),
    account_number: z.string().min(1, 'Account number is required').trim(),
    account_name: z.string().min(1, 'Account name is required').trim(),
    country: z.string().length(2, 'Must be a valid ISO-2 country code').toUpperCase(),
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
        .length(2, 'Must be a 2-letter ISO country code')
        .toUpperCase(),
    timezone: z.string().min(1, 'Timezone is required'),
    payout_details: z
        .array(payoutDetailsSchema)
        .min(1, 'At least one payout method is required')
        .max(3, 'Maximum 3 payout methods allowed'),
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

export const businessAddressSchema = z.object({
    /**
     * Existing address's Mongo id — omit for a brand-new address. Must be
     * echoed back unchanged on resubmit (full-replace endpoint), otherwise a
     * fresh id is generated and any product's pickupLocation pointing at the
     * old one is demoted to draft. Never shown to the vendor.
     */
    _id: z.string().optional(),
    /** Required by the backend — identifies the location (e.g. "Main Office", "Warehouse"). */
    label: z.string().min(1, 'Label is required').max(50, 'Label must be 50 characters or fewer'),
    address_line1: z.string().min(1, 'Address is required').max(200, 'Address too long'),
    address_line2: z.string().max(200, 'Address too long').optional().or(z.literal('')),
    city: z.string().min(1, 'City is required').max(100, 'City name too long'),
    state: z.string().max(100, 'State/region too long').optional().or(z.literal('')),
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
    return_window_days: z.coerce.number().int().min(0, 'Min 0').max(180, 'Max 180 days'),
    refund_type: z.enum(['full', 'partial', 'none']),
    refund_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
    return_shipping_payer: z.enum(['vendor', 'customer', 'customer_reimbursed_if_defect']),
    refund_processing_days: z.coerce.number().int().min(1, 'Min 1').max(30, 'Max 30 days'),
    return_condition_notes: z.string().max(500, 'Max 500 characters').nullable().optional(),
}).superRefine((val, ctx) => {
    if (val.refund_type === 'partial' && (val.refund_percentage == null)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Refund percentage is required for partial refunds',
            path: ['refund_percentage'],
        });
    }
});

const cancellationPolicySchema = z.object({
    cancellable: z.boolean(),
    cancellation_deadline: z.string().nullable().optional(),
    cancellation_deadline_days: z.coerce.number().int().min(0, 'Min 0').nullable().optional(),
    cancellation_fee_type: z.enum(['none', 'fixed', 'percentage', 'full_non_refundable']).nullable().optional(),
    cancellation_fee_value: z.coerce.number().min(0, 'Min 0').nullable().optional(),
    late_cancellation_refund_type: z.enum(['fixed', 'percentage', 'full_non_refundable']).nullable().optional(),
    late_cancellation_refund_value: z.coerce.number().min(0, 'Min 0').nullable().optional(),
}).superRefine((val, ctx) => {
    if (
        val.cancellation_deadline === 'anytime_until_days_before_delivery' &&
        val.cancellation_deadline_days == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Number of days is required',
            path: ['cancellation_deadline_days'],
        });
    }
    if (
        (val.cancellation_fee_type === 'fixed' || val.cancellation_fee_type === 'percentage') &&
        val.cancellation_fee_value == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Fee value is required',
            path: ['cancellation_fee_value'],
        });
    }
    if (
        (val.late_cancellation_refund_type === 'fixed' || val.late_cancellation_refund_type === 'percentage') &&
        val.late_cancellation_refund_value == null
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Refund value is required',
            path: ['late_cancellation_refund_value'],
        });
    }
});

const supportChannelSchema = z.object({
    type: z.enum(['email', 'phone', 'whatsapp', 'telegram']),
    contact: z.string().min(1, 'Contact is required').max(200, 'Max 200 characters'),
});

const supportPolicySchema = z.object({
    channels: z.array(supportChannelSchema).max(4, 'Maximum 4 channels'),
    eligibility_notes: z.string().max(500, 'Max 500 characters').nullable().optional(),
    required_info: z.array(z.enum(['order_number', 'product_photo_video', 'tracking_number'])).optional(),
    availability: z.enum(['24_7', 'business_hours', 'limited']).nullable().optional(),
    availability_description: z.string().max(200, 'Max 200 characters').nullable().optional(),
    languages: z.array(z.string().max(50, 'Max 50 characters')).max(20, 'Maximum 20 languages').optional(),
});

export const step4Schema = z.object({
    return_policy: returnPolicySchema.optional(),
    cancellation_policy: cancellationPolicySchema.optional(),
    support_policy: supportPolicySchema.optional(),
    documents: z.array(z.string()).max(2, 'Maximum 2 documents').optional(),
});

export type Step4FormValues = z.infer<typeof step4Schema>;
