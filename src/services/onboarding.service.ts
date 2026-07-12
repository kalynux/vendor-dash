import { api } from './api';
import type {
    CompletionStatus,
    DeliveryAgency,
    AgencyListMeta,
    BasicSetupPayload,
    DeliveryLinkingPayload,
    BrandingPayload,
    PolicySetupPayload,
    OnboardingStepResponse,
    VendorProfileUpdatePayload,
    VendorProfileUpdateResponse,
    ChangePasswordPayload,
    ChangePasswordResponse,
    AutoRedirectSettings,
    AutoCancelSettings,
} from '@/types/api';

export const onboardingService = {
    /**
     * Read-only status check — used for UX enrichment only.
     * Routing is driven exclusively by auth-me/vendor → role_entity.onboarding_step.
     */
    getCompletionStatus(): Promise<{ success: boolean; data: CompletionStatus }> {
        return api.get<{ success: boolean; data: CompletionStatus }>(
            '/vendor/profile/completion-status',
        );
    },

    /** Step 1: country, timezone, payout_details array. */
    submitBasicSetup(payload: BasicSetupPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/vendor/onboarding/basic-setup', payload);
    },

    /** Step 2: select a delivery agency or skip (service-only vendors). */
    submitDeliveryLinking(payload: DeliveryLinkingPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/vendor/onboarding/delivery-linking', payload);
    },

    /** Step 3: branding + business addresses, or skip to complete onboarding. */
    submitBranding(payload: BrandingPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/vendor/onboarding/branding', payload);
    },

    /** Step 4: policy setup (return, cancellation, support), or skip to complete onboarding. */
    submitPolicySetup(payload: PolicySetupPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/vendor/onboarding/policy-setup', payload);
    },

    // ─── Post-onboarding edits (Settings) ───────────────────────────────────────

    /**
     * Update any profile field after onboarding is complete.
     * Onboarding step endpoints return 409 once `onboarding_step === 0`; this is
     * the endpoint for editing payout/branding/policies/country/timezone from Settings.
     * Object/array fields are a full replace — send the complete desired value.
     */
    updateProfile(payload: VendorProfileUpdatePayload): Promise<VendorProfileUpdateResponse> {
        return api.patch<VendorProfileUpdateResponse>('/vendor/profile', payload);
    },

    /** Change the vendor's password. Requires the current password. */
    changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
        return api.patch<ChangePasswordResponse>('/vendor/profile/password', payload);
    },

    /**
     * Upload supporting policy documents (PDFs, max 5MB each, max 2 files).
     * Returns the resulting URLs — pass them through in `policies.documents` on the
     * next `updateProfile`/`submitPolicySetup` call (full-replace semantics).
     */
    uploadPolicyDocuments(
        files: File[],
    ): Promise<{ success: boolean; data: { urls: string[] }; message?: string }> {
        const fd = new FormData();
        files.forEach((f) => fd.append('documents', f));
        return api.postFormData<{ success: boolean; data: { urls: string[] }; message?: string }>(
            '/vendor/profile/policy-documents',
            fd,
        );
    },

    /** Current default delivery agency (or null). */
    getDefaultDeliveryAgency(): Promise<{ success: boolean; data: DeliveryAgency | null }> {
        return api.get<{ success: boolean; data: DeliveryAgency | null }>(
            '/vendor/profile/default-delivery-agency',
        );
    },

    /**
     * Set/update the default delivery agency outside the onboarding flow.
     * There is no route to clear it — a vendor's default only becomes unset if the
     * underlying agency itself is deactivated by an admin. `meta` reports any
     * in-flight order items that were auto-reassigned from the old default.
     */
    setDefaultDeliveryAgency(
        agencyId: string,
    ): Promise<{
        success: boolean;
        data: DeliveryAgency;
        meta?: {
            reassignedOrderItems: number;
            skippedOrderItems: { orderId: string; itemId: string; reason: string }[];
        };
        message?: string;
    }> {
        return api.put<{
            success: boolean;
            data: DeliveryAgency;
            meta?: {
                reassignedOrderItems: number;
                skippedOrderItems: { orderId: string; itemId: string; reason: string }[];
            };
            message?: string;
        }>('/vendor/profile/default-delivery-agency', { agencyId });
    },

    // ─── Order automation settings ──────────────────────────────────────────────

    /** Whether paid physical orders auto-dispatch to the agency, plus optional cap. */
    getAutoRedirectOrders(): Promise<{ success: boolean; data: AutoRedirectSettings }> {
        return api.get<{ success: boolean; data: AutoRedirectSettings }>(
            '/vendor/profile/auto-redirect-orders',
        );
    },

    /** Enable/disable auto-dispatch and optionally set the max-order-total cap. */
    updateAutoRedirectOrders(
        payload: { enabled: boolean; thresholdAmount?: number | null },
    ): Promise<{ success: boolean; data: AutoRedirectSettings; message?: string }> {
        return api.put<{ success: boolean; data: AutoRedirectSettings; message?: string }>(
            '/vendor/profile/auto-redirect-orders',
            payload,
        );
    },

    /** Days an order may remain unpaid before the daily sweep auto-cancels it. */
    getAutoCancelUnpaidDays(): Promise<{ success: boolean; data: AutoCancelSettings }> {
        return api.get<{ success: boolean; data: AutoCancelSettings }>(
            '/vendor/profile/auto-cancel-unpaid-days',
        );
    },

    /** Set the unpaid-order auto-cancel window (1–90 days). */
    updateAutoCancelUnpaidDays(
        payload: { days: number },
    ): Promise<{ success: boolean; data: AutoCancelSettings; message?: string }> {
        return api.put<{ success: boolean; data: AutoCancelSettings; message?: string }>(
            '/vendor/profile/auto-cancel-unpaid-days',
            payload,
        );
    },

    /**
     * Browse-only agency listing (no connection awareness). No remaining UI
     * consumer as of the Agency Connections rework — kept for API parity since
     * the endpoint itself still exists; prefer `browseAgencyConnections` from
     * agency-connections.service.ts for anywhere agency selection happens.
     */
    listAgencies(params?: {
        page?: number;
        limit?: number;
        search?: string;
        region?: string;
        hq_city?: string;
        storage_based?: boolean;
        pickup_based?: boolean;
        returns_payer?: 'vendor' | 'agency' | 'customer';
        min_claim_deadline_days?: number;
    }): Promise<{ success: true; data: DeliveryAgency[]; meta: AgencyListMeta }> {
        const qs = new URLSearchParams();
        if (params) {
            if (params.page) qs.set('page', String(params.page));
            if (params.limit) qs.set('limit', String(params.limit));
            if (params.search) qs.set('search', params.search);
            if (params.region) qs.set('region', params.region);
            if (params.hq_city) qs.set('hq_city', params.hq_city);
            if (params.storage_based) qs.set('storage_based', 'true');
            if (params.pickup_based) qs.set('pickup_based', 'true');
            if (params.returns_payer) qs.set('returns_payer', params.returns_payer);
            if (params.min_claim_deadline_days !== undefined)
                qs.set('min_claim_deadline_days', String(params.min_claim_deadline_days));
        }
        const query = qs.toString();
        return api.get<{ success: true; data: DeliveryAgency[]; meta: AgencyListMeta }>(
            `/vendor/delivery-agencies${query ? `?${query}` : ''}`,
        );
    },
};
