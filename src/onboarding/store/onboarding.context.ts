import { createContext, useContext } from 'react';

import type { OnboardingState } from './OnboardingProvider';

/**
 * The onboarding/session context, in its own module so Fast Refresh keeps
 * working for `OnboardingProvider.tsx` and so shared components can read the
 * session *optionally* — `null` outside the provider — where
 * `useOnboarding()`'s throw would be wrong (see `useProfilePhoneCountry`).
 */
export const OnboardingContext = createContext<OnboardingState | null>(null);

export function useOnboarding(): OnboardingState {
    const ctx = useContext(OnboardingContext);
    if (!ctx) {
        throw new Error('useOnboarding must be used within <OnboardingProvider>');
    }
    return ctx;
}
