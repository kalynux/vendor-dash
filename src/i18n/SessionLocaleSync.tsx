import { useEffect, useRef } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useI18n } from './I18nContext';
import { resolveLocale } from './config';

/**
 * Binds the dashboard language to the vendor's Profile setting.
 *
 * `preferred_language` on the vendor profile is the source of truth. It arrives
 * with the session, so the provider boots from `localStorage` (no flash of the
 * wrong language on reload) and this component reconciles once `/auth/me`
 * resolves — and again the moment the Profile tab saves a new value, which is
 * what makes the switch take effect instantly without a refresh.
 *
 * Renders nothing; mount it inside `OnboardingProvider`.
 */
export function SessionLocaleSync() {
    const { session } = useOnboarding();
    const { setLocale } = useI18n();

    const sessionLanguage = session?.role_entity?.preferred_language ?? null;
    // Only react to *changes* in the profile value. Without this, the sync
    // would fight any other caller of `setLocale` on every render.
    const lastApplied = useRef<string | null>(null);

    useEffect(() => {
        if (!sessionLanguage) return;
        if (lastApplied.current === sessionLanguage) return;
        lastApplied.current = sessionLanguage;
        setLocale(resolveLocale(sessionLanguage));
    }, [sessionLanguage, setLocale]);

    return null;
}
