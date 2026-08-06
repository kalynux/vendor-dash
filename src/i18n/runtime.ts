/**
 * A snapshot of the active translator, reachable outside React.
 *
 * Stores, services and imperative helpers (`toast.error` in a catch block deep
 * in `src/store`) need to translate too, but cannot call hooks. `I18nProvider`
 * publishes the live translator here on every locale change, so those callers
 * stay in step with the UI instead of hardcoding English.
 *
 * Inside components prefer `useTranslation()` / `useApiError()` — they
 * re-render on a language switch, which a module-level snapshot cannot do.
 */

import { DEFAULT_LOCALE, type Locale } from './config';
import { enCatalog } from './catalogs';
import { createHasKey, createTranslator, type Translate } from './translator';
import { resolveApiError, type ResolveErrorOptions } from './api-errors';
import type { TranslateParams } from './types';

interface RuntimeI18n {
    locale: Locale;
    t: Translate;
    hasKey: (key: string) => boolean;
}

let current: RuntimeI18n = {
    locale: DEFAULT_LOCALE,
    t: createTranslator(DEFAULT_LOCALE, enCatalog, enCatalog),
    hasKey: createHasKey(enCatalog, enCatalog),
};

/** Called by `I18nProvider` whenever the locale or catalog changes. */
export function setRuntimeI18n(next: RuntimeI18n) {
    current = next;
}

export function getRuntimeLocale(): Locale {
    return current.locale;
}

/** Translate from non-React code. */
export function tStatic(key: string, params?: TranslateParams): string {
    return current.t(key, params);
}

/** Localized message for a thrown API error, from non-React code. */
export function apiErrorMessage(err: unknown, options?: ResolveErrorOptions): string {
    return resolveApiError(err, current.t, current.hasKey, options);
}
