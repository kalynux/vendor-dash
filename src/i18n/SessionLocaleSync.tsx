import { useEffect, useRef } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useI18n } from './I18nContext';
import { clearManualLocale, readManualLocale, resolveLocale } from './config';

/**
 * Binds the dashboard language to the vendor's Profile setting.
 *
 * `preferred_language` on the vendor profile is the source of truth. It arrives
 * with the session, so the provider boots from `localStorage` (no flash of the
 * wrong language on reload) and this component reconciles once `/auth/me`
 * resolves — and again the moment the Profile tab saves a new value, which is
 * what makes the switch take effect instantly without a refresh.
 *
 * ── The one thing that outranks the profile ──────────────────────────────────
 *
 * A locale the vendor picked by hand from `LanguageSwitcher`, until the profile
 * catches up with it. Without that exception the sign-in language picker is a
 * no-op for the vendor it exists for: a new account's `preferred_language`
 * defaults to `en`, so choosing Français on the login screen would survive
 * exactly as long as it took `/auth/me` to answer, and the whole of onboarding
 * would still be in English. See `LOCALE_MANUAL_KEY`.
 *
 * The exception retires itself the moment the two agree — which is what saving a
 * language in Account → Localization does, and is also why that screen clears
 * the marker outright when the vendor picks something different there.
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

        const profileLocale = resolveLocale(sessionLanguage);
        const manual = readManualLocale();
        if (manual) {
            // The profile has caught up — the pick is no longer an override, so
            // stop treating it as one and let the profile govern from here.
            if (manual === profileLocale) clearManualLocale();
            // Either way there is nothing to apply: the manual locale is either
            // already active, or it is deliberately winning over the profile.
            else return;
        }

        if (lastApplied.current === sessionLanguage) return;
        lastApplied.current = sessionLanguage;
        setLocale(profileLocale);
    }, [sessionLanguage, setLocale]);

    return null;
}
