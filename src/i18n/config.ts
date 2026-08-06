/**
 * Locale registry — the single source of truth for which languages the
 * dashboard speaks.
 *
 * Adding a language is a three-line change here plus a catalog under
 * `src/i18n/locales/<code>/`. Nothing else in the app enumerates locales:
 * the Profile language picker, the `<html lang>`/`dir` plumbing and the
 * fallback chain all read from this file.
 *
 * `preferred_language` on the vendor profile is the same field the backend
 * uses to pick a notification language, so the dashboard and the emails /
 * WhatsApp messages a vendor receives always agree.
 */

export const DEFAULT_LOCALE = 'en' as const;

export type Locale = 'en' | 'fr' | 'es' | 'pt' | 'ar';

export interface LocaleMeta {
    code: Locale;
    /** Name in English — used in docs and admin surfaces. */
    label: string;
    /** Name in the language itself — what the picker shows. */
    nativeLabel: string;
    /** Writing direction, applied to `<html dir>`. */
    dir: 'ltr' | 'rtl';
    /**
     * BCP-47 tag handed to `Intl.*`. Kept separate from `code` so a locale can
     * be regionalised (e.g. `pt-BR`) without renaming its catalog directory.
     */
    intlTag: string;
    /**
     * False while a catalog is still a stub that falls back to English.
     * The Profile picker hides these so a vendor cannot select a language
     * that would render as English anyway.
     */
    complete: boolean;
}

export const LOCALES: Record<Locale, LocaleMeta> = {
    en: {
        code: 'en',
        label: 'English',
        nativeLabel: 'English',
        dir: 'ltr',
        intlTag: 'en',
        complete: true,
    },
    fr: {
        code: 'fr',
        label: 'French',
        nativeLabel: 'Français',
        dir: 'ltr',
        intlTag: 'fr',
        complete: true,
    },
    es: {
        code: 'es',
        label: 'Spanish',
        nativeLabel: 'Español',
        dir: 'ltr',
        intlTag: 'es',
        complete: false,
    },
    pt: {
        code: 'pt',
        label: 'Portuguese',
        nativeLabel: 'Português',
        dir: 'ltr',
        intlTag: 'pt',
        complete: false,
    },
    ar: {
        code: 'ar',
        label: 'Arabic',
        nativeLabel: 'العربية',
        dir: 'rtl',
        intlTag: 'ar',
        complete: false,
    },
};

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[];

/** Locales with a finished catalog — what the Profile picker offers. */
export const SELECTABLE_LOCALES = SUPPORTED_LOCALES.filter((code) => LOCALES[code].complete);

export function isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && value in LOCALES;
}

/**
 * Normalise anything that claims to be a language into a supported locale.
 * Accepts bare codes (`fr`), BCP-47 tags (`fr-CA`, `pt_BR`) and unknown junk,
 * always landing on a locale the app can actually render.
 */
export function resolveLocale(value: unknown): Locale {
    if (isLocale(value)) return value;
    if (typeof value === 'string') {
        const base = value.toLowerCase().replace('_', '-').split('-')[0];
        if (isLocale(base)) return base;
    }
    return DEFAULT_LOCALE;
}

/** Best guess from the browser, used before a session is loaded. */
export function detectBrowserLocale(): Locale {
    if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
    for (const lang of navigator.languages ?? [navigator.language]) {
        const resolved = resolveLocale(lang);
        // `resolveLocale` falls back to `en`, so only accept a real match.
        if (lang && resolved !== DEFAULT_LOCALE) return resolved;
        if (lang?.toLowerCase().startsWith('en')) return 'en';
    }
    return DEFAULT_LOCALE;
}

/** localStorage key holding the last locale, so a reload doesn't flash English. */
export const LOCALE_STORAGE_KEY = 'vendor-dash:locale';
