/**
 * Locale-aware formatting.
 *
 * Everything here routes through `Intl`, keyed off the *active dashboard
 * locale* rather than `undefined` (which silently follows the browser and made
 * a French vendor on an English machine see mixed output).
 *
 * `Intl` objects are cached: constructing one is comparatively expensive and
 * these run inside table cells.
 */

import { useMemo } from 'react';

import { LOCALES, type Locale } from './config';
import { useI18n } from './I18nContext';

function cached<T>(factory: (key: string) => T) {
    const store = new Map<string, T>();
    return (key: string): T => {
        let hit = store.get(key);
        if (hit === undefined) {
            hit = factory(key);
            store.set(key, hit);
        }
        return hit;
    };
}

const numberFormat = cached((key: string) => {
    const [tag, options] = key.split('|');
    return new Intl.NumberFormat(tag, options ? JSON.parse(options) : undefined);
});

const dateFormat = cached((key: string) => {
    const [tag, options] = key.split('|');
    return new Intl.DateTimeFormat(tag, options ? JSON.parse(options) : undefined);
});

const relativeFormat = cached((tag: string) => new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }));

const listFormat = cached((key: string) => {
    const [tag, type] = key.split('|');
    return new Intl.ListFormat(tag, { style: 'long', type: type as 'conjunction' | 'disjunction' });
});

function tagFor(locale: Locale): string {
    return LOCALES[locale].intlTag;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// ─── Standalone formatters (usable outside React) ─────────────────────────────

export function formatNumber(
    locale: Locale,
    value: number,
    options?: Intl.NumberFormatOptions,
): string {
    return numberFormat(`${tagFor(locale)}|${options ? JSON.stringify(options) : ''}`).format(value);
}

/**
 * Money. Amounts arrive from the API in major units with their currency
 * alongside (XAF, in practice).
 *
 * `Intl` renders XAF as its local symbol — `FCFA 45,000` in English,
 * `45 000 FCFA` in French — which is both the familiar name in the CFA zone
 * and correctly placed per locale. Degrades to `45 000 XAF` on a runtime that
 * doesn't know the code.
 */
export function formatCurrency(
    locale: Locale,
    value: number,
    currency = 'XAF',
    options?: Intl.NumberFormatOptions,
): string {
    try {
        return formatNumber(locale, value, {
            style: 'currency',
            currency,
            // XAF has no minor unit; letting Intl decide keeps EUR/USD correct.
            maximumFractionDigits: currency === 'XAF' ? 0 : undefined,
            ...options,
        });
    } catch {
        return `${formatNumber(locale, value)} ${currency}`;
    }
}

export function formatPercent(locale: Locale, value: number, fractionDigits = 0): string {
    return formatNumber(locale, value / 100, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}

export type DateStyle = 'short' | 'medium' | 'long' | 'dayMonth' | 'monthYear';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    dayMonth: { month: 'short', day: 'numeric' },
    monthYear: { month: 'long', year: 'numeric' },
};

export function formatDate(
    locale: Locale,
    value: Date | string | number | null | undefined,
    style: DateStyle = 'medium',
    fallback = '—',
): string {
    const date = toDate(value);
    if (!date) return fallback;
    return dateFormat(`${tagFor(locale)}|${JSON.stringify(DATE_OPTIONS[style])}`).format(date);
}

export function formatTime(
    locale: Locale,
    value: Date | string | number | null | undefined,
    fallback = '—',
): string {
    const date = toDate(value);
    if (!date) return fallback;
    return dateFormat(
        `${tagFor(locale)}|${JSON.stringify({ hour: 'numeric', minute: '2-digit' })}`,
    ).format(date);
}

export function formatDateTime(
    locale: Locale,
    value: Date | string | number | null | undefined,
    style: DateStyle = 'medium',
    fallback = '—',
): string {
    const date = toDate(value);
    if (!date) return fallback;
    return dateFormat(
        `${tagFor(locale)}|${JSON.stringify({
            ...DATE_OPTIONS[style],
            hour: 'numeric',
            minute: '2-digit',
        })}`,
    ).format(date);
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
];

/** "3 days ago" / "in 2 hours", localised. */
export function formatRelativeTime(
    locale: Locale,
    value: Date | string | number | null | undefined,
    now: Date = new Date(),
    fallback = '—',
): string {
    const date = toDate(value);
    if (!date) return fallback;
    const diff = date.getTime() - now.getTime();
    const formatter = relativeFormat(tagFor(locale));
    for (const [unit, ms] of RELATIVE_STEPS) {
        if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
    }
    return formatter.format(Math.round(diff / 1000), 'second');
}

export function formatList(
    locale: Locale,
    items: string[],
    type: 'conjunction' | 'disjunction' = 'conjunction',
): string {
    if (items.length === 0) return '';
    try {
        return listFormat(`${tagFor(locale)}|${type}`).format(items);
    } catch {
        return items.join(', ');
    }
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Byte counts with a localised number part (the unit symbols are universal). */
export function formatFileSize(locale: Locale, bytes: number): string {
    if (!bytes) return `0 ${FILE_SIZE_UNITS[0]}`;
    const exponent = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        FILE_SIZE_UNITS.length - 1,
    );
    const value = bytes / Math.pow(1024, exponent);
    return `${formatNumber(locale, value, { maximumFractionDigits: exponent === 0 ? 0 : 2 })} ${FILE_SIZE_UNITS[exponent]}`;
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function displayNames(locale: Locale, type: 'region' | 'language'): Intl.DisplayNames {
    const key = `${tagFor(locale)}|${type}`;
    let dn = displayNamesCache.get(key);
    if (!dn) {
        dn = new Intl.DisplayNames([tagFor(locale)], { type });
        displayNamesCache.set(key, dn);
    }
    return dn;
}

/**
 * Country name for an ISO-3166 alpha-2 code, from the browser's CLDR data.
 *
 * Hand-maintaining a country list per locale is the kind of thing that rots —
 * `Intl.DisplayNames` already ships every name in every locale we support.
 * Falls back to the code itself if the runtime lacks the data.
 */
export function formatCountry(locale: Locale, code: string): string {
    if (!code) return '';
    try {
        return displayNames(locale, 'region').of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

// ─── React binding ────────────────────────────────────────────────────────────

export interface Formatters {
    locale: Locale;
    number: (value: number, options?: Intl.NumberFormatOptions) => string;
    currency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
    percent: (value: number, fractionDigits?: number) => string;
    date: (value: Date | string | number | null | undefined, style?: DateStyle, fallback?: string) => string;
    time: (value: Date | string | number | null | undefined, fallback?: string) => string;
    dateTime: (value: Date | string | number | null | undefined, style?: DateStyle, fallback?: string) => string;
    relativeTime: (value: Date | string | number | null | undefined, now?: Date, fallback?: string) => string;
    list: (items: string[], type?: 'conjunction' | 'disjunction') => string;
    fileSize: (bytes: number) => string;
    country: (code: string) => string;
}

/** Formatters bound to the active locale. Re-created only when the locale changes. */
export function useFormatters(): Formatters {
    const { locale } = useI18n();
    return useMemo<Formatters>(
        () => ({
            locale,
            number: (value, options) => formatNumber(locale, value, options),
            currency: (value, currency, options) => formatCurrency(locale, value, currency, options),
            percent: (value, fractionDigits) => formatPercent(locale, value, fractionDigits),
            date: (value, style, fallback) => formatDate(locale, value, style, fallback),
            time: (value, fallback) => formatTime(locale, value, fallback),
            dateTime: (value, style, fallback) => formatDateTime(locale, value, style, fallback),
            relativeTime: (value, now, fallback) => formatRelativeTime(locale, value, now, fallback),
            list: (items, type) => formatList(locale, items, type),
            fileSize: (bytes) => formatFileSize(locale, bytes),
            country: (code) => formatCountry(locale, code),
        }),
        [locale],
    );
}
