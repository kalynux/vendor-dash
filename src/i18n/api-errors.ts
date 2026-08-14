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
 *   2. `errors.category.<category>`     — the backend's nine-value taxonomy
 *   3. `errors.status.<httpStatus>`     — a sane message for an unknown code
 *   4. `errors.unknown`                 — last resort
 *
 * An unmapped code therefore degrades to "that request was rejected" rather
 * than to a stack-trace fragment, and is reported to the console in dev so it
 * can be added to the catalog.
 *
 * Step 2 is the tier the backend added for exactly this: with 547 registered
 * codes, no client has specific copy for all of them, and the category is what
 * says the four things that change behaviour — retry, re-authenticate, fix the
 * input, or it's ours. It sits above the status because `409` alone cannot tell
 * a stale-state conflict from a deliberate business refusal.
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
    if (hasKey(codeKey)) return withRequestId(err, t(codeKey, params), t);

    reportUnmapped(err.code, err.status);

    const categoryKey = `errors.category.${err.category}`;
    if (err.category && hasKey(categoryKey)) return withRequestId(err, t(categoryKey, params), t);

    const statusKey = `errors.status.${err.status}`;
    if (hasKey(statusKey)) return withRequestId(err, t(statusKey, params), t);

    if (err.status >= 500) return withRequestId(err, t('errors.status.500', params), t);
    if (fallbackKey) return t(fallbackKey, params);
    return t('errors.unknown', params);
}

/**
 * Append the `requestId` to a server-side failure.
 *
 * On a 5xx the backend deliberately sends no cause — `message` is a fixed
 * sentence and `details` is omitted entirely, in every environment. The
 * `requestId` is the only handle anyone has, and a user who can quote it turns
 * an unactionable "something went wrong" into a support conversation that
 * resolves. Client-invented codes (`REFRESH_FAILED` and friends) carry no
 * requestId, so they are unaffected.
 */
function withRequestId(err: ApiError, message: string, t: Translate): string {
    if (err.status < 500 || !err.requestId) return message;
    return t('errors.withRequestId', { message, requestId: err.requestId });
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
    if (!(err instanceof ApiError)) return {};
    const out: Record<string, string> = {};
    for (const detail of err.fieldErrors) {
        if (!detail.field) continue;
        // The backend's path is dotted and can be indexed
        // (`payout_details.0.method`); a form input is keyed by its own name, so
        // try the full path first and fall back to its last segment.
        const leaf = detail.field.split('.').pop() ?? detail.field;
        const fieldKey = `errors.fields.${detail.field}`;
        const leafKey = `errors.fields.${leaf}`;
        out[detail.field] = hasKey(fieldKey)
            ? t(fieldKey)
            : hasKey(leafKey)
              ? t(leafKey)
              : t('errors.fieldInvalid');
    }
    return out;
}
