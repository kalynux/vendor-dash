import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { OnboardingSkeleton } from "./OnboardingSkeleton";


interface OnboardingGuardProps {
    children: React.ReactNode;
    /**
     * When true: dashboard mode — an incomplete vendor is redirected back to /onboarding.
     * When false (default): onboarding mode — an unauthenticated user goes to /login,
     * a complete vendor goes to /dashboard.
     */
    requireComplete?: boolean;
}

export function OnboardingGuard({ children, requireComplete = false }: OnboardingGuardProps) {
    const { session, isInitializing, currentStep, initialize } = useOnboarding();
    const location = useLocation();

    // Boot the auth check exactly once per provider mount.
    // The store's initCalled ref prevents double-firing in StrictMode.
    useEffect(() => {
        initialize();
    }, [initialize]);

    // `auth:logout` is handled by OnboardingProvider, which owns the session and
    // sits above every route — a listener here only fired on the screens this
    // guard wraps, which is not where a session usually dies.

    // Block render while auth check is in flight — no partial dashboard flash.
    if (isInitializing) {
        return <OnboardingSkeleton />;
    }

    // Not authenticated
    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireComplete) {
        // Dashboard mode: vendor who hasn't finished onboarding should not be here
        if (currentStep !== 0) {
            return <Navigate to="/onboarding" replace />;
        }
    } else {
        // Onboarding mode: fully onboarded vendors should go straight to dashboard
        if (currentStep === 0) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <>{children}</>;
}
