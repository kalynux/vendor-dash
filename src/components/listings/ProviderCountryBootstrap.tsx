import { useEffect, useRef } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { FALLBACK_PHONE_COUNTRY, splitPhone } from '@/lib/phone';

/**
 * Gives a service provider their country when they have none. Renders nothing.
 *
 * A seller sets the country in onboarding step 1; a provider has no onboarding
 * (the server starts them at step 0), so theirs stays empty — and Profile shows
 * it read-only, because it can be set ONCE and never changed (the server's
 * `assertCountryUnchangedOrFirstSet`).
 *
 * Owner's call, 2026-11-08: set it automatically from the country of the phone
 * number they signed up with (+237 → Cameroon), Cameroon when that cannot be
 * read. The backend has been asked to do the same at sign-up; once it does,
 * this finds a country already there and does nothing.
 *
 * One attempt per app start. A failure is silent — the next start tries again.
 */
export function ProviderCountryBootstrap() {
    const { session, updateVendorProfile } = useOnboarding();
    const tried = useRef(false);
    const entity = session?.role_entity;

    useEffect(() => {
        if (tried.current || !entity || entity.country) return;
        tried.current = true;
        const fromPhone = splitPhone(entity.phone, FALLBACK_PHONE_COUNTRY).country;
        void updateVendorProfile({ country: fromPhone || FALLBACK_PHONE_COUNTRY }).catch(() => {
            tried.current = false;
        });
    }, [entity, updateVendorProfile]);

    return null;
}
