import { type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import type { ReturnPolicy, CancellationPolicy, SupportPolicy } from '@/types/api';

/** Which policy sections are toggled on. */
export interface PolicyEnabled {
    return: boolean;
    cancellation: boolean;
    support: boolean;
}

/** Build RHF default values from existing policies (or sensible defaults). */
export function buildPolicyDefaults(existingPolicies: {
    return_policy?: ReturnPolicy | null;
    cancellation_policy?: CancellationPolicy | null;
    support_policy?: SupportPolicy | null;
} | null | undefined): Step4FormValues {
    return {
        return_policy: existingPolicies?.return_policy
            ? {
                return_eligible: existingPolicies.return_policy.return_eligible,
                return_window_days: existingPolicies.return_policy.return_window_days,
                refund_type: existingPolicies.return_policy.refund_type,
                refund_percentage: existingPolicies.return_policy.refund_percentage ?? undefined,
                return_shipping_payer: existingPolicies.return_policy.return_shipping_payer,
                refund_processing_days: existingPolicies.return_policy.refund_processing_days,
                return_condition_notes: existingPolicies.return_policy.return_condition_notes ?? '',
            }
            : {
                return_eligible: true,
                return_window_days: 14,
                refund_type: 'full',
                return_shipping_payer: 'customer',
                refund_processing_days: 7,
                return_condition_notes: '',
            },
        cancellation_policy: existingPolicies?.cancellation_policy
            ? {
                cancellable: existingPolicies.cancellation_policy.cancellable,
                cancellation_deadline: existingPolicies.cancellation_policy.cancellation_deadline ?? undefined,
                cancellation_deadline_days: existingPolicies.cancellation_policy.cancellation_deadline_days ?? undefined,
                cancellation_fee_type: existingPolicies.cancellation_policy.cancellation_fee_type ?? undefined,
                cancellation_fee_value: existingPolicies.cancellation_policy.cancellation_fee_value ?? undefined,
                late_cancellation_refund_type: existingPolicies.cancellation_policy.late_cancellation_refund_type ?? undefined,
                late_cancellation_refund_value: existingPolicies.cancellation_policy.late_cancellation_refund_value ?? undefined,
            }
            : {
                cancellable: true,
                cancellation_deadline: null,
                cancellation_fee_type: 'none',
            },
        support_policy: existingPolicies?.support_policy
            ? {
                channels: existingPolicies.support_policy.channels,
                eligibility_notes: existingPolicies.support_policy.eligibility_notes ?? '',
                required_info: (existingPolicies.support_policy.required_info ?? []) as ('order_number' | 'product_photo_video' | 'tracking_number')[],
                availability: existingPolicies.support_policy.availability ?? null,
                availability_description: existingPolicies.support_policy.availability_description ?? '',
                languages: existingPolicies.support_policy.languages ?? [],
            }
            : {
                channels: [],
                eligibility_notes: '',
                required_info: [],
                availability: null,
                availability_description: '',
                languages: [],
            },
    };
}
