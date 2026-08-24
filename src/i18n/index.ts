/**
 * The dashboard's internationalization layer.
 *
 * ```tsx
 * import { useTranslation, useFormatters, useApiError } from '@/i18n';
 *
 * const { t } = useTranslation();
 * const fmt = useFormatters();
 * const apiError = useApiError();
 * ```
 *
 * Layout:
 *   config.ts     which languages exist, and their direction/Intl tag
 *   locales/      the catalogs, one directory per language, split by feature
 *   translator.ts key lookup, interpolation, pluralization, English fallback
 *   context.tsx   the provider — holds the active locale, swaps catalogs
 *   format.ts     locale-aware number / money / date / relative-time
 *   api-errors.ts backend error codes → translated, user-safe messages
 *   runtime.ts    the same translator for code that cannot use hooks
 */

export {
    DEFAULT_LOCALE,
    LOCALES,
    SUPPORTED_LOCALES,
    SELECTABLE_LOCALES,
    LOCALE_STORAGE_KEY,
    LOCALE_MANUAL_KEY,
    isLocale,
    resolveLocale,
    detectBrowserLocale,
    markLocaleManual,
    readManualLocale,
    clearManualLocale,
    type Locale,
    type LocaleMeta,
} from './config';

export { LanguageSwitcher } from './LanguageSwitcher';

export { I18nProvider } from './context';
export { useI18n, type I18nContextValue } from './I18nContext';
export { SessionLocaleSync } from './SessionLocaleSync';
export { useTranslation, useLocale } from './useTranslation';
export { useMessage } from './useMessage';
export { Trans, type TransProps } from './Trans';
export { useApiError, type ApiErrorHelpers } from './useApiError';
export {
    resolveApiError,
    resolveFieldErrors,
    type ResolveErrorOptions,
} from './api-errors';
export { tStatic, apiErrorMessage, getRuntimeLocale } from './runtime';
export {
    useFormatters,
    formatNumber,
    formatCurrency,
    formatPercent,
    formatDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    formatList,
    formatFileSize,
    formatCountry,
    type Formatters,
    type DateStyle,
} from './format';
export { asKey, type TranslationKey } from './keys';
export { plural, type PluralMessage, type TranslateParams } from './types';
export type { Messages } from './catalogs';
