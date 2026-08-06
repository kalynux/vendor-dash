import { createContext } from 'react';

import type { OnboardingState } from './onboarding.store';

/**
 * The onboarding/session context, in its own module so Fast Refresh keeps
 * working for `onboarding.store.tsx` and so shared components can read the
 * session *optionally* — `null` outside the provider — where
 * `useOnboarding()`'s throw would be wrong (see `useProfilePhoneCountry`).
 */
export const OnboardingContext = createContext<OnboardingState | null>(null);
