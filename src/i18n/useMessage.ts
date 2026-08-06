import { useCallback } from 'react';

import { useI18n } from './I18nContext';

/**
 * Resolve a message that *might* be a catalog key.
 *
 * Zod schemas, status-transition tables and other module-level constants are
 * built before any React context exists, so they carry translation **keys**
 * rather than sentences. The same slots also receive already-resolved prose —
 * a message the API error resolver produced, say. This returns the translation
 * when the string is a known key and the string itself otherwise, so a call
 * site never has to know which of the two it is holding.
 *
 * ```tsx
 * const m = useMessage();
 * <p>{m(errors.title?.message)}</p>
 * ```
 */
export function useMessage(): (message?: string | null) => string {
    const { tDynamic, hasKey } = useI18n();
    return useCallback(
        (message?: string | null) => {
            if (!message) return '';
            return hasKey(message) ? tDynamic(message) : message;
        },
        [tDynamic, hasKey],
    );
}
