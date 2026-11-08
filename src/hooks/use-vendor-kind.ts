import { useContext } from 'react';

import { OnboardingContext } from '@/onboarding/store/onboarding.context';
import { vendorKindOf, type VendorKind } from '@/lib/vendorKind';

/**
 * The signed-in vendor's kind — `'seller'` or `'provider'`.
 *
 * Read optionally from the session, so it is safe anywhere (outside the
 * provider it answers `'seller'`, which is what every screen did before the
 * kind existed). The whole app branches on this one value: a provider never
 * sees a seller screen, and a seller never sees the three listing sections.
 */
export function useVendorKind(): VendorKind {
    const session = useContext(OnboardingContext)?.session;
    return vendorKindOf(session);
}

export function useIsProvider(): boolean {
    return useVendorKind() === 'provider';
}
