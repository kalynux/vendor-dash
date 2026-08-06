import { useI18n, type I18nContextValue } from './I18nContext';

/**
 * The hook every component uses.
 *
 * ```tsx
 * const { t } = useTranslation();
 * <Button>{t('common.actions.save')}</Button>
 * ```
 *
 * Because the locale lives in React context, switching language re-renders
 * every consumer — the UI changes language in place, with no reload.
 */
export function useTranslation(): I18nContextValue {
    return useI18n();
}

/** Just the locale + direction, for components that only need to format. */
export function useLocale() {
    const { locale, dir, isRTL, setLocale } = useI18n();
    return { locale, dir, isRTL, setLocale };
}
