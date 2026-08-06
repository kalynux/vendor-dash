/**
 * Backend errors → localized messages.
 *
 * The one rule this module exists to enforce: **a raw backend message never
 * reaches a user**. `error.message` from the API is English, written for
 * developers, and often leaks internals. Every failure is resolved through the
 * `errors.codes.*` catalog keyed on `error.code`, whose source of truth is
 * `api-doc/error-codes.ts`.
 *
 * Resolution order:
 *   1. `errors.codes.<CODE>`            — the specific, human-written message
 *   2. `errors.status.<httpStatus>`     — a sane message for an unknown code
 *   3. `errors.unknown`                 — last resort
 *
 * An unmapped code therefore degrades to "that request was rejected" rather
 * than to a stack-trace fragment, and is reported to the console in dev so it
 * can be added to the catalog.
 */

import { ApiError } from '@/types/api';
import type { TranslationKey } from './keys';
import type { TranslateParams } from './types';

type Translate = (key: string, params?: TranslateParams) => string;

export interface ResolveErrorOptions {
    /**
     * Message to show when the error carries no code this app knows about.
     * Use it to say what actually failed ("Couldn't save the product") instead
     * of the generic fallback.
     */
    fallbackKey?: TranslationKey;
    /**
     * Narrows the wording for a screen where the generic message is too vague.
     * Checked before `errors.codes.<CODE>`, so a context only has to list the
     * handful of codes it wants to say differently — everything else keeps the
     * shared message.
     *
     * `CATALOG_PRODUCT_SIMPLE_MODE_LOCKED`, for instance, is "convert it to an
     * advanced product" in general but "switch it to the advanced editor first"
     * inside the quick editor, where "convert" means something else.
     */
    context?: string;
    /** Extra interpolation values, merged over the ones read off the error. */
    params?: TranslateParams;
}

/** Scalar fields from `error.details` become interpolation params. */
function paramsFromError(err: ApiError): TranslateParams {
    const params: TranslateParams = {};
    const detailsObject = err.detailsObject;
    if (detailsObject) {
        for (const [key, value] of Object.entries(detailsObject)) {
            if (typeof value === 'string' || typeof value === 'number') params[key] = value;
        }
    }
    if (err.violations?.length) params.count = err.violations.length;
    return params;
}

const reportedCodes = new Set<string>();

function reportUnmapped(code: string, status: number) {
    if (!import.meta.env.DEV || reportedCodes.has(code)) return;
    reportedCodes.add(code);
    console.warn(
        `[i18n] Unmapped backend error code "${code}" (HTTP ${status}). ` +
            'Add it to src/i18n/locales/*/errors.ts.',
    );
}

/**
 * Resolve any thrown value to a message safe to show a user.
 *
 * `t`/`hasKey` come from `useI18n()`; the standalone signature keeps this
 * usable from stores and services that have no hooks available.
 */
export function resolveApiError(
    err: unknown,
    t: Translate,
    hasKey: (key: string) => boolean,
    options: ResolveErrorOptions = {},
): string {
    const { fallbackKey, context, params: extraParams } = options;

    // Offline / DNS / CORS — fetch rejects before an ApiError is ever built.
    if (err instanceof TypeError) return t('errors.network');

    if (!(err instanceof ApiError)) {
        return fallbackKey ? t(fallbackKey, extraParams) : t('errors.unknown');
    }

    const params = { ...paramsFromError(err), ...extraParams };

    // A per-file upload rejection carries its own reasons; those are more
    // useful than the single UPLOAD_POLICY_VIOLATION sentence.
    if (err.violations?.length) {
        const lines = err.violations.map((violation) => {
            const reasonKey = `errors.upload.violations.${violation.code}`;
            const reason = hasKey(reasonKey) ? t(reasonKey) : t('errors.upload.violations.UNKNOWN');
            const name = violation.metadata?.originalName;
            return name
                ? t('errors.upload.namedFile', { name, reason })
                : t('errors.upload.someFile', { reason });
        });
        return Array.from(new Set(lines)).join(' ');
    }

    if (context) {
        const contextKey = `errors.contexts.${context}.${err.code}`;
        if (hasKey(contextKey)) return t(contextKey, params);
    }

    const codeKey = `errors.codes.${err.code}`;
    if (hasKey(codeKey)) return t(codeKey, params);

    reportUnmapped(err.code, err.status);

    const statusKey = `errors.status.${err.status}`;
    if (hasKey(statusKey)) return t(statusKey, params);

    if (err.status >= 500) return t('errors.status.500', params);
    if (fallbackKey) return t(fallbackKey, params);
    return t('errors.unknown', params);
}

/**
 * Field-level messages for a 400, keyed by field name, for forms that want to
 * highlight inputs. The messages are localized where the field is known and
 * fall back to a generic "check this field" — the backend's English text is
 * never surfaced.
 */
export function resolveFieldErrors(
    err: unknown,
    t: Translate,
    hasKey: (key: string) => boolean,
): Record<string, string> {
    if (!(err instanceof ApiError) || !err.details?.length) return {};
    const out: Record<string, string> = {};
    for (const detail of err.details) {
        if (!detail?.field) continue;
        const fieldKey = `errors.fields.${detail.field}`;
        out[detail.field] = hasKey(fieldKey) ? t(fieldKey) : t('errors.fieldInvalid');
    }
    return out;
}
