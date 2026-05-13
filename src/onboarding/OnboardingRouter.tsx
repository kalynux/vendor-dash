import { Navigate, Route, Routes } from 'react-router-dom';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Step1BasicSetup } from './steps/Step1BasicSetup';
import { Step2DeliveryLinking } from './steps/Step2DeliveryLinking';
import { Step3Branding } from './steps/Step3Branding';
import { Step4PolicySetup } from './steps/Step4PolicySetup';

function UnknownStepFallback({ step }: { step: number | null }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="text-4xl mb-4">🤷</div>
            <h2 className="text-xl font-semibold mb-2">Unexpected onboarding state</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
                The server returned an unrecognised onboarding step ({step ?? 'none'}).
                Please contact support if this persists.
            </p>
        </div>
    );
}

/**
 * Nested router for /onboarding/*.
 *
 * URL is the source of truth — no useEffect-driven navigation.
 * StepGuard allows access to any step N where currentStep >= N,
 * enabling back-navigation to completed steps while blocking forward-skipping.
 */
export function OnboardingRouter() {
    const { currentStep, viewingStep } = useOnboarding();

    return (
        <Routes>
            <Route
                path="basic-setup"
                element={<StepGuard minRequired={1}><Step1BasicSetup /></StepGuard>}
            />
            <Route
                path="delivery-linking"
                element={<StepGuard minRequired={2}><Step2DeliveryLinking /></StepGuard>}
            />
            <Route
                path="branding"
                element={<StepGuard minRequired={3}><Step3Branding /></StepGuard>}
            />
            <Route
                path="policy-setup"
                element={<StepGuard minRequired={4}><Step4PolicySetup /></StepGuard>}
            />

            {/* Index: redirect to whatever step the user is currently viewing */}
            <Route
                index
                element={
                    viewingStep === null ? null :
                    viewingStep === 0 ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <Navigate to={stepPath(viewingStep)} replace />
                    )
                }
            />

            <Route path="unknown" element={<UnknownStepFallback step={currentStep} />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
    );
}

// ─── Step guard ───────────────────────────────────────────────────────────────
// minRequired: the minimum currentStep value needed to view this route.
// - Blocks forward-skipping: a vendor on step 1 cannot reach /delivery-linking.
// - Allows back-navigation: a vendor on step 3 can revisit /basic-setup.

function StepGuard({
    children,
    minRequired,
}: {
    children: React.ReactNode;
    minRequired: 1 | 2 | 3 | 4;
}) {
    const { currentStep } = useOnboarding();

    if (currentStep === null) return null;

    // Onboarding complete — should not be in this router at all
    if (currentStep === 0) {
        return <Navigate to="/dashboard" replace />;
    }

    // Vendor hasn't reached this step yet → redirect to their current required step
    if (currentStep < minRequired) {
        return <Navigate to={stepPath(currentStep)} replace />;
    }

    return <>{children}</>;
}

function stepPath(step: number): string {
    switch (step) {
        case 1: return '/onboarding/basic-setup';
        case 2: return '/onboarding/delivery-linking';
        case 3: return '/onboarding/branding';
        case 4: return '/onboarding/policy-setup';
        default: return '/onboarding/unknown';
    }
}
