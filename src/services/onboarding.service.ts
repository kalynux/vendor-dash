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

    /** Current default delivery agency (or null). */
    getDefaultDeliveryAgency(): Promise<{ success: boolean; data: DeliveryAgency | null }> {
        return api.get<{ success: boolean; data: DeliveryAgency | null }>(
            '/vendor/profile/default-delivery-agency',
        );
    },

    /** Set/update the default delivery agency outside the onboarding flow. */
    setDefaultDeliveryAgency(
        agencyId: string,
    ): Promise<{ success: boolean; data: DeliveryAgency; message?: string }> {
        return api.put<{ success: boolean; data: DeliveryAgency; message?: string }>(
            '/vendor/profile/default-delivery-agency',
            { agencyId },
        );
    },

    /** Clear the default delivery agency. */
    clearDefaultDeliveryAgency(): Promise<{ success: boolean; message?: string }> {
        return api.delete<{ success: boolean; message?: string }>(
            '/vendor/profile/default-delivery-agency',
        );
    },

    /** List delivery agencies available for step 2 selection. */
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
