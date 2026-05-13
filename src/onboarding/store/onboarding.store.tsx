import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { onboardingService } from '@/services/onboarding.service';
import { ApiError } from '@/types/api';
import type {
    AuthMeVendorResponse,
    BasicSetupPayload,
    DeliveryLinkingPayload,
    BrandingPayload,
    PolicySetupPayload,
    OnboardingStepResponse,
    VendorOnboardingStep,
} from '@/types/api';
import type {
    Step1FormValues,
    Step2FormValues,
    Step3FormValues,
    Step4FormValues,
} from '@/onboarding/schemas/onboarding.schemas';

// ─── Draft cache ───────────────────────────────────────────────────────────────
// Raw form values for each step, saved synchronously BEFORE the API call.
// This is the reliable source of truth for pre-populating forms on back-navigation,
// since the backend profile response may differ in shape from the form values.

interface StepDrafts {
    basicSetup: Step1FormValues | null;
    deliveryLinking: Step2FormValues | null;
    branding: Step3FormValues | null;
    policySetup: Step4FormValues | null;
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface OnboardingState {
    /** Full session from auth-me/vendor. Single source of truth for onboarding_step. */
    session: AuthMeVendorResponse | null;

    /** True while the initial auth check is in progress. */
    isInitializing: boolean;

    /** True while a step PUT is in flight. */
    isSubmitting: boolean;

    /** Last API error. Cleared on the next action. */
    error: ApiError | null;

    /**
     * The highest step the backend reports as "next required".
     * 0 = complete, 1–3 = the next step to complete.
     * Used as the canonical max-allowed step for the router guard.
     */
    currentStep: VendorOnboardingStep | null;

    /**
     * The step the user is currently *viewing*.
     * May be a previously completed step when they navigate backwards.
     * Drives the progress bar and the index redirect.
     */
    viewingStep: VendorOnboardingStep | null;

    /**
     * Draft form values per step, saved before each API call.
     * Priority for pre-population: draft → session role_entity → empty defaults.
     */
    drafts: StepDrafts;

    /** Save raw form values for a given step BEFORE the API call. */
    saveDraft(step: 1, values: Step1FormValues): void;
    saveDraft(step: 2, values: Step2FormValues): void;
    saveDraft(step: 3, values: Step3FormValues): void;
    saveDraft(step: 4, values: Step4FormValues): void;

    /** Navigate directly to any step the user has already reached or completed. */
    jumpToStep: (step: VendorOnboardingStep) => void;

    /** Initialize: fetch auth-me/vendor. Call once on app mount via OnboardingGuard. */
    initialize: () => Promise<void>;

    /** Submit Step 1 — country, timezone, payout_details array. */
    submitBasicSetup: (payload: BasicSetupPayload) => Promise<void>;

    /** Submit Step 2 — select a delivery agency or skip. */
    submitDeliveryLinking: (payload: DeliveryLinkingPayload) => Promise<void>;

    /** Submit Step 3 — branding + addresses, or skip to complete onboarding. */
    submitBranding: (payload: BrandingPayload) => Promise<void>;

    /** Submit Step 4 — policy setup (return, cancellation, support), or skip to complete onboarding. */
    submitPolicySetup: (payload: PolicySetupPayload) => Promise<void>;

    /** Navigate to the previous step (no-op when already on step 1). */
    goBack: () => void;

    /** Logout: clear cookies and redirect to /login. */
    logout: () => Promise<void>;

    /** Clear last error. */
    clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingState | null>(null);

// ─── Step → route mapping ─────────────────────────────────────────────────────

export function stepToRoute(step: VendorOnboardingStep | number): string {
    switch (step) {
        case 1: return '/onboarding/basic-setup';
        case 2: return '/onboarding/delivery-linking';
        case 3: return '/onboarding/branding';
        case 4: return '/onboarding/policy-setup';
        case 0: return '/dashboard';
        default: return '/onboarding/unknown';
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [session, setSession] = useState<AuthMeVendorResponse | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [viewingStep, setViewingStep] = useState<VendorOnboardingStep | null>(null);
    const [drafts, setDrafts] = useState<StepDrafts>({
        basicSetup: null,
        deliveryLinking: null,
        branding: null,
        policySetup: null,
    });

    // Prevent double-initialization on React StrictMode double-invoke
    const initCalled = useRef(false);

    const currentStep = session?.role_entity.onboarding_step ?? null;

    const initialize = useCallback(async () => {
        if (initCalled.current) return;
        initCalled.current = true;

        setIsInitializing(true);
        try {
            const data = await authService.getAuthMeVendor();
            setSession(data);
            setViewingStep(data.role_entity.onboarding_step);
        } catch (err) {
            if (err instanceof ApiError && err.isUnauthorized) {
                // Not logged in — guard will redirect to /login
                setSession(null);
            } else {
                setError(
                    err instanceof ApiError
                        ? err
                        : new ApiError(500, 'INIT_FAILED', 'Failed to initialize session'),
                );
            }
        } finally {
            setIsInitializing(false);
        }
    }, []);

    const saveDraft = useCallback(
        (step: 1 | 2 | 3 | 4, values: Step1FormValues | Step2FormValues | Step3FormValues | Step4FormValues) => {
            setDrafts((prev) => {
                if (step === 1) return { ...prev, basicSetup: values as Step1FormValues };
                if (step === 2) return { ...prev, deliveryLinking: values as Step2FormValues };
                if (step === 3) return { ...prev, branding: values as Step3FormValues };
                return { ...prev, policySetup: values as Step4FormValues };
            });
        },
        [],
    );

    const handleStepResponse = useCallback(
        (response: OnboardingStepResponse, submittedFromStep: number) => {
            const { completionStatus, profile } = response.data;
            const backendStep = completionStatus.onboardingStep;

            setSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    role_entity: {
                        ...prev.role_entity,
                        ...profile,
                        onboarding_step: backendStep,
                        // Carry forward the incremented version for the next OCC write
                        version: profile.version ?? prev.role_entity.version,
                        // Each step's API response only returns fields relevant to that step.
                        // Preserve data set by earlier steps so back-navigation can still
                        // repopulate those forms when no in-memory draft exists.
                        payout_details: profile.payout_details ?? prev.role_entity.payout_details,
                        default_delivery_agency_id: profile.default_delivery_agency_id ?? prev.role_entity.default_delivery_agency_id,
                        branding: profile.branding ?? prev.role_entity.branding,
                        business_addresses: profile.business_addresses?.length
                            ? profile.business_addresses
                            : prev.role_entity.business_addresses,
                    },
                };
            });

            // Always navigate to the *next sequential step* after the one just submitted.
            // Never jump to the backend's max step — that would skip intermediate steps
            // when the user goes back and resubmits an earlier step.
            // Exception: if backend says 0 (complete) → go to dashboard immediately.
            if (backendStep === 0) {
                setViewingStep(0 as VendorOnboardingStep);
                navigate('/dashboard', { replace: true });
            } else {
                const nextViewStep = (submittedFromStep + 1) as VendorOnboardingStep;
                setViewingStep(nextViewStep);
                navigate(stepToRoute(nextViewStep), { replace: true });
            }
        },
        [navigate],
    );

    const wrapStep = useCallback(
        async (fn: () => Promise<OnboardingStepResponse>, submittedFromStep: number) => {
            setIsSubmitting(true);
            setError(null);
            try {
                const response = await fn();
                handleStepResponse(response, submittedFromStep);
            } catch (err) {
                const apiErr =
                    err instanceof ApiError
                        ? err
                        : new ApiError(500, 'SUBMIT_FAILED', 'Step submission failed');
                setError(apiErr);
                throw apiErr;
            } finally {
                setIsSubmitting(false);
            }
        },
        [handleStepResponse],
    );

    const submitBasicSetup = useCallback(
        (payload: BasicSetupPayload) =>
            wrapStep(() => onboardingService.submitBasicSetup(payload), 1),
        [wrapStep],
    );

    const submitDeliveryLinking = useCallback(
        (payload: DeliveryLinkingPayload) =>
            wrapStep(() => onboardingService.submitDeliveryLinking(payload), 2),
        [wrapStep],
    );

    const submitBranding = useCallback(
        (payload: BrandingPayload) =>
            wrapStep(() => onboardingService.submitBranding(payload), 3),
        [wrapStep],
    );

    const submitPolicySetup = useCallback(
        (payload: PolicySetupPayload) =>
            wrapStep(() => onboardingService.submitPolicySetup(payload), 4),
        [wrapStep],
    );

    const goBack = useCallback(() => {
        const v = viewingStep;
        if (!v || v <= 1) return;
        const prevStep = (v - 1) as VendorOnboardingStep;
        setViewingStep(prevStep);
        navigate(stepToRoute(prevStep), { replace: true });
    }, [viewingStep, navigate]);

    const jumpToStep = useCallback(
        (step: VendorOnboardingStep) => {
            if (!currentStep || step === 0 || step > currentStep) return;
            setViewingStep(step);
            navigate(stepToRoute(step), { replace: true });
        },
        [currentStep, navigate],
    );

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // best-effort; redirect regardless
        } finally {
            setSession(null);
            setDrafts({ basicSetup: null, deliveryLinking: null, branding: null, policySetup: null });
            initCalled.current = false;
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const clearError = useCallback(() => setError(null), []);

    return (
        <OnboardingContext.Provider
            value={{
                session,
                isInitializing,
                isSubmitting,
                error,
                currentStep,
                viewingStep,
                drafts,
                saveDraft,
                jumpToStep,
                initialize,
                submitBasicSetup,
                submitDeliveryLinking,
                submitBranding,
                submitPolicySetup,
                goBack,
                logout,
                clearError,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboarding(): OnboardingState {
    const ctx = useContext(OnboardingContext);
    if (!ctx) {
        throw new Error('useOnboarding must be used within <OnboardingProvider>');
    }
    return ctx;
}
