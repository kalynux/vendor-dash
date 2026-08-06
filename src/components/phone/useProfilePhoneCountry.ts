import { useContext } from 'react';

import { toPhoneCountry, type CountryCode } from '@/lib/phone';
import { OnboardingContext } from '@/onboarding/store/onboarding.context';

/**
 * The country a phone field starts on: whatever the vendor chose during
 * onboarding (`role_entity.country`, immutable afterwards), falling back to the
 * platform's home market.
 *
 * Reads the context directly rather than through `useOnboarding()` so a phone
 * field rendered outside the provider degrades to the fallback instead of
 * throwing.
 */
export function useProfilePhoneCountry(): CountryCode {
    const onboarding = useContext(OnboardingContext);
    return toPhoneCountry(onboarding?.session?.role_entity?.country);
}
