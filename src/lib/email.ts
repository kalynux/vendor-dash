// ─── Email address validation ─────────────────────────────────────────────────
// One rule, every endpoint — the backend applies the same check to auth, vendor
// profile, store support contacts, support-policy channels and payment-channel
// customer details. See api-doc/README.md#contact-formats-phone--email.
//
// The sibling of `lib/phone.ts`: same job, same shape, for the other half of the
// platform-wide contact rule.

import type { TranslationKey } from '@/i18n';

// RFC 5322 dot-atom local part (no leading/trailing/consecutive dots, no quoted
// strings — legal in the RFC, undeliverable in practice), then a genuinely
// dotted domain whose TLD is alphabetic. `name@example` and `root@localhost`
// are rejected for that last reason: a bare host has no TLD.
const EMAIL_PATTERN =
    /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** RFC 5321 length ceilings — 64 for the local part, 254 for the whole address. */
const MAX_LOCAL_LENGTH = 64;
const MAX_TOTAL_LENGTH = 254;

/**
 * Canonical form the backend stores and compares against: trimmed and
 * lowercased, so `Ada@Example.com` and `ada@example.com` are one address.
 *
 * Apply this on submit rather than on keystroke — retyping a capital letter
 * that vanishes as you type it is its own kind of broken.
 */
export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Mirrors the backend's email check so a bad address is caught in the form
 * instead of coming back as a `VALIDATION_ERROR` after a round trip.
 *
 * Validates *format*, not deliverability — a well-formed address may still
 * bounce.
 */
export function isValidEmail(value: string): boolean {
    const normalized = normalizeEmail(value);
    if (normalized.length === 0 || normalized.length > MAX_TOTAL_LENGTH) return false;
    if (normalized.slice(0, normalized.lastIndexOf('@')).length > MAX_LOCAL_LENGTH) return false;
    return EMAIL_PATTERN.test(normalized);
}

/**
 * The one place that decides *which* message a bad address gets, so every form
 * in the dashboard says the same thing — the counterpart to `phoneErrorKey`.
 *
 * Returns a translation key (resolve it with `t()` / `useMessage()`), or `null`
 * when the value is acceptable. An empty value is only an error when `required`.
 */
export function emailErrorKey(
    value: string | null | undefined,
    options: { required?: boolean } = {},
): TranslationKey | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return options.required ? 'common.validation.required' : null;
    return isValidEmail(trimmed) ? null : 'common.validation.email';
}
