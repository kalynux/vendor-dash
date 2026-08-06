// ─── Phone numbers ────────────────────────────────────────────────────────────
//
// One place that knows how a phone number is parsed, formatted, validated and
// stored. Every phone field in the dashboard goes through `<PhoneInput>`
// (`@/components/phone`), which is built on top of this module.
//
// The storage contract: **E.164 only** — `+`, country calling code, national
// significant number, no spaces (`+237650000000`). That is what the backend
// receives, what `value`/`onChange` carry, and what a zod schema validates.
// Pretty spacing exists only inside the input while the vendor types.
//
// Validation is per-country (Google's libphonenumber rules via
// `libphonenumber-js`), so a Cameroonian mobile is checked against Cameroon's
// numbering plan and a French one against France's.

import {
    AsYouType,
    getCountries,
    getCountryCallingCode,
    getExampleNumber,
    isSupportedCountry,
    parsePhoneNumberFromString,
    type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

import type { TranslationKey } from '@/i18n';

export type { CountryCode };

/**
 * Countries the platform onboards in, as ISO-3166 alpha-2 codes.
 *
 * Doubles as the "common markets" group pinned to the top of every country
 * picker. Deliberately code-only: display names come from `fmt.country(code)`,
 * which reads the browser's CLDR data, so the list is correct in every locale
 * without a hand-maintained translation per country.
 */
export const PLATFORM_COUNTRIES: CountryCode[] = [
    'CM', 'CI', 'SN', 'NG', 'GH', 'KE', 'TZ', 'UG', 'RW', 'EG', 'ZA', 'FR', 'GB', 'US',
];

/** Used when the vendor's profile has no country yet (the platform's home market). */
export const FALLBACK_PHONE_COUNTRY: CountryCode = 'CM';

/** Every country libphonenumber has a numbering plan for. */
export const ALL_PHONE_COUNTRIES: CountryCode[] = getCountries();

/** Countries outside `PLATFORM_COUNTRIES`, so a picker can render two groups. */
export const OTHER_PHONE_COUNTRIES: CountryCode[] = ALL_PHONE_COUNTRIES.filter(
    (code) => !PLATFORM_COUNTRIES.includes(code),
);

// ─── Country helpers ──────────────────────────────────────────────────────────

/** Narrow an arbitrary string to a supported ISO-3166 alpha-2 country code. */
export function isPhoneCountry(code: unknown): code is CountryCode {
    return typeof code === 'string' && isSupportedCountry(code.toUpperCase());
}

/**
 * Coerce whatever the profile/API gave us into a usable country, falling back
 * to the platform's home market rather than leaving the selector empty.
 */
export function toPhoneCountry(
    code: string | null | undefined,
    fallback: CountryCode = FALLBACK_PHONE_COUNTRY,
): CountryCode {
    if (!code) return fallback;
    const upper = code.toUpperCase();
    return isSupportedCountry(upper) ? (upper as CountryCode) : fallback;
}

/** `+237` for `CM`. */
export function dialCode(country: CountryCode): string {
    return `+${getCountryCallingCode(country)}`;
}

/**
 * The country's flag as a regional-indicator emoji pair.
 *
 * Platforms without flag glyphs (Windows, notably) render the two letters of
 * the ISO code instead, which still reads correctly next to the dial code.
 */
export function countryFlag(country: CountryCode): string {
    return country
        .toUpperCase()
        .replace(/[A-Z]/g, (char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65));
}

/** A real, correctly shaped mobile number for the country — used as placeholder text. */
export function phoneExample(country: CountryCode): string {
    try {
        return getExampleNumber(country, examples)?.formatNational() ?? '';
    } catch {
        return '';
    }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export interface PhoneParts {
    country: CountryCode;
    /**
     * The number as its country writes it locally — no country code, but *with*
     * the national prefix and grouping where the plan uses them (France's
     * `06 12 34 56 78`). This is what belongs in the text field next to the
     * country selector, and `AsYouType` re-formats it cleanly from there.
     */
    national: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * Split a stored value into the country its calling code names plus the
 * national part, so the input can show the two separately.
 *
 * Tolerant of everything already in the database from before this was
 * standardized: `+237650000000`, `+237 6 50 00 00 00`, `237650000000` and a
 * bare national `650000000` all resolve. Anything unparseable keeps its digits
 * against `fallbackCountry` so the vendor sees (and can fix) what was stored
 * rather than an empty box.
 */
export function splitPhone(
    value: string | null | undefined,
    fallbackCountry: CountryCode = FALLBACK_PHONE_COUNTRY,
): PhoneParts {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return { country: fallbackCountry, national: '' };

    // `00` is the other way to write an international prefix.
    const normalized = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;

    const parsed = parsePhoneNumberFromString(normalized, fallbackCountry);
    if (parsed) {
        return {
            country: parsed.country ?? fallbackCountry,
            national: parsed.formatNational(),
        };
    }
    return { country: fallbackCountry, national: digitsOnly(normalized) };
}

/**
 * Best-effort E.164 for a country plus whatever national text has been typed.
 *
 * Returns `''` for an empty entry, and a partial `+237650…` while the number is
 * still being typed — `isValidPhone` is what decides whether it may be
 * submitted. National prefixes are stripped (French `06 12…` → `+336 12…`).
 */
export function composeE164(country: CountryCode, national: string): string {
    const digits = digitsOnly(national);
    if (!digits) return '';
    const formatter = new AsYouType(country);
    formatter.input(national);
    return formatter.getNumberValue() ?? `${dialCode(country)}${digits}`;
}

/**
 * The canonical E.164 string, or `null` when the number is not a valid number
 * for its country. This is the last gate before anything reaches the backend.
 */
export function toE164(
    value: string | null | undefined,
    defaultCountry?: CountryCode,
): string | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return null;
    const normalized = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
    const parsed = parsePhoneNumberFromString(
        normalized,
        defaultCountry ?? FALLBACK_PHONE_COUNTRY,
    );
    return parsed?.isValid() ? parsed.number : null;
}

/** Valid for its country's numbering plan — not merely "looks like digits". */
export function isValidPhone(
    value: string | null | undefined,
    defaultCountry?: CountryCode,
): boolean {
    return toE164(value, defaultCountry) !== null;
}

/**
 * Canonicalize a value on its way *into* a form.
 *
 * Records written before phone numbers were standardized hold `+237 6 50 00 00
 * 00`, `237650000000`, or a bare national number. Seeding a form with the E.164
 * equivalent means an untouched field doesn't read as edited, and a schema that
 * demands E.164 doesn't reject data the vendor never looked at. Anything that
 * cannot be parsed is returned trimmed, so the vendor sees what is stored.
 */
export function normalizeStoredPhone(
    value: string | null | undefined,
    defaultCountry?: CountryCode,
): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return '';
    return toE164(trimmed, defaultCountry) ?? trimmed;
}

// ─── Display ──────────────────────────────────────────────────────────────────

/**
 * `+237 6 50 00 00 00` — for read-only surfaces (order/customer detail, saved
 * payment methods). Falls back to the raw value when it cannot be parsed, so a
 * legacy record still shows something.
 */
export function formatPhoneInternational(
    value: string | null | undefined,
    defaultCountry?: CountryCode,
): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return '';
    const parsed = parsePhoneNumberFromString(
        trimmed,
        defaultCountry ?? FALLBACK_PHONE_COUNTRY,
    );
    return parsed ? parsed.formatInternational() : trimmed;
}

/** `6 50 00 00 00` — the national part as the country writes it. */
export function formatPhoneNational(national: string, country: CountryCode): string {
    if (!national) return '';
    return new AsYouType(country).input(national);
}

// ─── Validation messaging ─────────────────────────────────────────────────────

/**
 * The one place that decides *which* message a bad phone number gets, so every
 * form in the dashboard says the same thing.
 *
 * Returns a translation key (resolve it with `t()` / `useMessage()`), or `null`
 * when the value is acceptable. An empty value is only an error when `required`.
 */
export function phoneErrorKey(
    value: string | null | undefined,
    options: { required?: boolean; country?: CountryCode } = {},
): TranslationKey | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return options.required ? 'common.validation.phoneRequired' : null;
    return isValidPhone(trimmed, options.country) ? null : 'common.validation.phone';
}

/**
 * zod refinement for a field that stores E.164. Pass to `.refine()`:
 *
 * ```ts
 * z.string().trim().refine(isValidE164, 'common.validation.phone')
 * ```
 *
 * Deliberately strict about the leading `+`: a value that reached the schema
 * without one did not come from `<PhoneInput>`, and guessing its country here
 * is how numbers end up stored against the wrong dialing plan.
 */
export function isValidE164(value: string): boolean {
    return value.startsWith('+') && isValidPhone(value);
}
