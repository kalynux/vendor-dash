import {
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingContext } from '@/onboarding/store/onboarding.context';
import { authService, type LoginPayload, type RegisterPayload } from '@/services/auth.service';
import { onboardingService } from '@/services/onboarding.service';
import { deleteCurrentToken } from '@/lib/fcm';
import { unregisterDevice } from '@/services/devices.service';
import { ApiError } from '@/types/api';
import type {
    AuthMeVendorResponse,
    BasicSetupPayload,
    DeliveryLinkingPayload,
    BrandingPayload,
    BrandingFileRef,
    PolicySetupPayload,
    OnboardingStepResponse,
    VendorOnboardingStep,
    VendorProfileUpdatePayload,
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

    /**
     * Sign in and adopt the resulting session.
     *
     * Exists so the login screen does not have to reach past the provider and
     * then ask it to re-initialize — which would race `initCalled` and, on the
     * bearer transport, spend a second `auth-me` round trip for a session the
     * login response already carried in full. Throws `ApiError` on failure; the
     * screen renders it.
     */
    signIn: (payload: LoginPayload) => Promise<AuthMeVendorResponse>;

    /**
     * Register a vendor account and adopt the resulting session.
     *
     * The response lands on `onboarding_step === 1`, so the caller navigates
     * into the existing onboarding flow rather than anywhere new.
     */
    signUp: (payload: RegisterPayload) => Promise<AuthMeVendorResponse>;

    /** Submit Step 1 — country, timezone, payout_details array. */
    submitBasicSetup: (payload: BasicSetupPayload) => Promise<void>;

    /** Submit Step 2 — select a delivery agency or skip. */
    submitDeliveryLinking: (payload: DeliveryLinkingPayload) => Promise<void>;

    /** Submit Step 3 — branding + addresses, or skip to complete onboarding. */
    submitBranding: (payload: BrandingPayload) => Promise<void>;

    /** Submit Step 4 — policy setup (return, cancellation, support), or skip to complete onboarding. */
    submitPolicySetup: (payload: PolicySetupPayload) => Promise<void>;

    /**
     * Post-onboarding edit (Settings). PATCH /vendor/profile with a partial patch.
     * Merges the submitted fields into session.role_entity and bumps version.
     * Use for payout, addresses, policies, country/timezone. Business
     * name/description/logo/banner are NOT here — they live on the store
     * (`PATCH /api/vendor/store`, see StorefrontSettings).
     *
     * `avatarPreview` is a local-only escape hatch for `avatarFileId`: the PATCH
     * response doesn't echo back a populated file object, so pass the one you already
     * have in hand (or `null` when clearing) and `role_entity.avatar` reflects the new
     * picture immediately. Stripped before the network call.
     */
    updateVendorProfile: (
        patch: Omit<VendorProfileUpdatePayload, 'version'> & {
            avatarPreview?: BrandingFileRef | null;
        },
    ) => Promise<void>;

    /**
     * Post-onboarding: set the default delivery agency (dedicated route). There is
     * no route to clear it once set. Resolves with the backend's message and the
     * count of in-flight order items that were auto-reassigned from the old default.
     */
    setDeliveryAgency: (agencyId: string) => Promise<{ message?: string; reassignedOrderItems: number }>;

    /** Navigate to the previous step (no-op when already on step 1). */
    goBack: () => void;

    /** Logout: clear cookies and redirect to /login. */
    logout: () => Promise<void>;

    /** Clear last error. */
    clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
// Declared in its own module (`onboarding.context.ts`) so this file only
// exports components/hooks and Fast Refresh keeps working.

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
            // Ask the transport whether a session is even possible before
            // spending a round trip on it. On cookie this is always true —
            // httpOnly cookies are invisible to script, so the server is the
            // only one who knows. On bearer we know for free, and skipping the
            // call is the difference between the login screen appearing at once
            // on a cold launch and appearing after a network timeout.
            if (!(await authService.canAttemptSession())) {
                setSession(null);
                return;
            }
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

    /**
     * Adopt a session that login/register just returned.
     *
     * `initCalled` is set so a later `initialize()` — the guard calls it on
     * mount — does not immediately re-fetch a session we already hold, and is
     * reset by logout so the next sign-in re-initializes cleanly.
     */
    const adoptSession = useCallback((data: AuthMeVendorResponse) => {
        setSession(data);
        setViewingStep(data.role_entity.onboarding_step);
        setError(null);
        initCalled.current = true;
    }, []);

    const signIn = useCallback(
        async (payload: LoginPayload) => {
            const data = await authService.login(payload);
            adoptSession(data);
            return data;
        },
        [adoptSession],
    );

    const signUp = useCallback(
        async (payload: RegisterPayload) => {
            const data = await authService.register(payload);
            adoptSession(data);
            return data;
        },
        [adoptSession],
    );

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

    const updateVendorProfile = useCallback(
        async (
            patch: Omit<VendorProfileUpdatePayload, 'version'> & {
                avatarPreview?: BrandingFileRef | null;
            },
        ) => {
            setIsSubmitting(true);
            setError(null);
            const { avatarPreview, ...writePatch } = patch;
            try {
                const currentVersion = session?.role_entity.version ?? 0;
                const res = await onboardingService.updateProfile({
                    ...writePatch,
                    version: currentVersion,
                });
                const nextVersion = res.data?.version ?? currentVersion + 1;

                // Optimistically merge the submitted fields into role_entity. The PATCH
                // response DTO is camelCase and not shaped like VendorRoleEntity, so we
                // apply what we sent rather than trusting the response body wholesale.
                setSession((prev) => {
                    if (!prev) return prev;
                    const re = prev.role_entity;
                    return {
                        ...prev,
                        role_entity: {
                            ...re,
                            ...(writePatch.country !== undefined ? { country: writePatch.country } : {}),
                            ...(writePatch.timezone !== undefined ? { timezone: writePatch.timezone } : {}),
                            ...(writePatch.preferred_language !== undefined ? { preferred_language: writePatch.preferred_language } : {}),
                            ...(writePatch.payout_details !== undefined ? { payout_details: writePatch.payout_details } : {}),
                            ...(writePatch.business_addresses !== undefined ? { business_addresses: writePatch.business_addresses } : {}),
                            // `avatarFileId` is a write-shape id; mirror the populated
                            // preview (or `null` on clear) into the read-shape `avatar`.
                            ...(avatarPreview !== undefined ? { avatar: avatarPreview } : {}),
                            ...(writePatch.social_links !== undefined ? { social_links: { ...re.social_links, ...writePatch.social_links } } : {}),
                            ...(writePatch.policies !== undefined ? { policies: writePatch.policies } : {}),
                            ...(writePatch.displayName !== undefined ? { display_name: writePatch.displayName } : {}),
                            ...(writePatch.phone !== undefined ? { phone: writePatch.phone } : {}),
                            version: nextVersion,
                        },
                    };
                });
            } catch (err) {
                const apiErr =
                    err instanceof ApiError
                        ? err
                        : new ApiError(500, 'UPDATE_FAILED', 'Profile update failed');
                setError(apiErr);
                throw apiErr;
            } finally {
                setIsSubmitting(false);
            }
        },
        [session?.role_entity.version],
    );

    const setDeliveryAgency = useCallback(async (agencyId: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const res = await onboardingService.setDefaultDeliveryAgency(agencyId);
            setSession((prev) =>
                prev
                    ? { ...prev, role_entity: { ...prev.role_entity, default_delivery_agency_id: agencyId } }
                    : prev,
            );
            return { message: res.message, reassignedOrderItems: res.meta?.reassignedOrderItems ?? 0 };
        } catch (err) {
            const apiErr =
                err instanceof ApiError
                    ? err
                    : new ApiError(500, 'UPDATE_FAILED', 'Could not set delivery agency');
            setError(apiErr);
            throw apiErr;
        } finally {
            setIsSubmitting(false);
        }
    }, []);

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
        // Stop pushing to this device before the session is torn down (best-effort:
        // the backend self-heals stale tokens, so failures here are non-fatal).
        try {
            const token = await deleteCurrentToken();
            if (token) await unregisterDevice(token);
        } catch {
            // ignore — proceed with logout regardless
        }
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

    /**
     * The API client dispatches `auth:logout` when a session ends underneath us
     * — a dead refresh cookie, or a password change elsewhere that revoked every
     * token this account holds (`401 AUTH_PASSWORD_CHANGED`, terminal by
     * contract). Cookies are already cleared by then; what is left is the local
     * state, and the contract is to drop it and send the user to sign-in.
     *
     * This lives on the provider rather than a route guard so it fires on every
     * screen. Mounted only on a dashboard route, a guard-local listener left the
     * user staring at a stale page with a dead session behind it.
     */
    useEffect(() => {
        const handler = () => {
            setSession(null);
            setDrafts({ basicSetup: null, deliveryLinking: null, branding: null, policySetup: null });
            initCalled.current = false;
            navigate('/login', { replace: true });
        };
        window.addEventListener('auth:logout', handler);
        return () => window.removeEventListener('auth:logout', handler);
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
                signIn,
                signUp,
                submitBasicSetup,
                submitDeliveryLinking,
                submitBranding,
                submitPolicySetup,
                updateVendorProfile,
                setDeliveryAgency,
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
