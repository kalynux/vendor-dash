import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useI18n } from './I18nContext';
import { resolveApiError, resolveFieldErrors, type ResolveErrorOptions } from './api-errors';

export interface ApiErrorHelpers {
    /** Localized, user-safe message for any thrown value. */
    resolve: (err: unknown, options?: ResolveErrorOptions) => string;
    /** Field-name → localized message, for highlighting inputs after a 400. */
    fields: (err: unknown) => Record<string, string>;
    /** Resolve and raise a destructive toast in one step; returns the message. */
    toast: (err: unknown, options?: ResolveErrorOptions) => string;
}

/**
 * The standard way to surface a failed request.
 *
 * ```ts
 * const apiError = useApiError();
 * try { await save(); }
 * catch (err) { apiError.toast(err, { fallbackKey: 'products.errors.saveFailed' }); }
 * ```
 *
 * Always prefer this over `err.message`: the backend's text is English and
 * developer-facing, whereas this resolves `err.code` through the translated
 * catalog.
 */
export function useApiError(): ApiErrorHelpers {
    const { tDynamic, hasKey } = useI18n();

    const resolve = useCallback(
        (err: unknown, options?: ResolveErrorOptions) =>
            resolveApiError(err, tDynamic, hasKey, options),
        [tDynamic, hasKey],
    );

    const fields = useCallback(
        (err: unknown) => resolveFieldErrors(err, tDynamic, hasKey),
        [tDynamic, hasKey],
    );

    const toastError = useCallback(
        (err: unknown, options?: ResolveErrorOptions) => {
            const message = resolve(err, options);
            toast.error(message);
            return message;
        },
        [resolve],
    );

    return useMemo(
        () => ({ resolve, fields, toast: toastError }),
        [resolve, fields, toastError],
    );
}
