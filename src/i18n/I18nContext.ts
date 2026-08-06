import { createContext, useContext } from 'react';

import type { Locale } from './config';
import type { TranslationKey } from './keys';
import type { TranslateParams } from './types';

export interface I18nContextValue {
    locale: Locale;
    /** Writing direction of the active locale — mirrored onto `<html dir>`. */
    dir: 'ltr' | 'rtl';
    isRTL: boolean;
    /** Switch language. Applies immediately once the catalog is in memory. */
    setLocale: (locale: Locale) => void;
    /** True while a newly requested catalog is still downloading. */
    isLoading: boolean;
    t: (key: TranslationKey, params?: TranslateParams) => string;
    /** Does this key exist in the active or the fallback catalog? */
    hasKey: (key: string) => boolean;
    /**
     * Untyped escape hatch for keys built at runtime — backend error codes,
     * status enums, notification types. Prefer `t` everywhere else.
     */
    tDynamic: (key: string, params?: TranslateParams) => string;
}

/**
 * Split out from `context.tsx` so that module exports only the provider
 * component — react-refresh cannot hot-reload a file that mixes components with
 * other exports, and the context object plus its hook are the "other exports".
 */
export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
    return ctx;
}
