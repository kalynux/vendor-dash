import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';

import {
    composeE164,
    formatPhoneNational,
    phoneErrorKey,
    phoneExample,
    splitPhone,
    toPhoneCountry,
    type CountryCode,
} from '@/lib/phone';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { PhoneCountrySelect } from './PhoneCountrySelect';
import { useProfilePhoneCountry } from './useProfilePhoneCountry';

export interface PhoneInputProps {
    /**
     * The stored value, in E.164 (`+237650000000`). Legacy values in other
     * shapes are parsed on the way in; what comes back out of `onChange` is
     * always E.164.
     */
    value: string;
    /**
     * Receives E.164 — `''` when the field is empty, and a partial `+2376…`
     * while the number is still being typed. Gate submission on
     * `phoneErrorKey()` / `isValidPhone()`, never on this being non-empty.
     */
    onChange: (value: string) => void;
    onBlur?: () => void;
    /**
     * ISO-3166 alpha-2 the selector starts on for an empty field. Defaults to
     * the vendor's profile country; pass this where a form owns a country of
     * its own (onboarding's Basic Setup picks one on the same screen).
     */
    defaultCountry?: string | null;
    id?: string;
    name?: string;
    disabled?: boolean;
    /** Only affects the message shown for an empty field. */
    required?: boolean;
    /** Overrides the country's own example number. */
    placeholder?: string;
    /** Force the invalid styling — e.g. a server-side rejection. */
    invalid?: boolean;
    /** An already-translated message to show instead of the built-in one (zod, API). */
    error?: string;
    /** Suppress the message row where the parent renders its own error slot. */
    hideError?: boolean;
    /** Applied to the bordered control itself, so a form can restyle it (`h-11`, …). */
    className?: string;
    autoFocus?: boolean;
    'aria-label'?: string;
    'aria-describedby'?: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** Index in `formatted` just past its `n`-th digit — where the caret belongs. */
function caretAfterDigits(formatted: string, n: number): number {
    if (n <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i += 1) {
        if (/\d/.test(formatted[i])) {
            seen += 1;
            if (seen === n) return i + 1;
        }
    }
    return formatted.length;
}

/**
 * Everything the field remembers, in one object.
 *
 * `text` cannot be derived from `value`: E.164 drops the grouping and the
 * national prefix a vendor actually typed (`06 12 …` in France), so the typed
 * form is real state. Keeping `value` alongside it is what lets a render tell
 * "the parent handed us something new" from "the parent echoed what we emitted".
 */
interface FieldState {
    /** The E.164 this country/text pair produced — what the parent was last told. */
    value: string;
    country: CountryCode;
    /** The national number as typed, formatted the way its country writes it. */
    text: string;
    /** The vendor chose the country by hand; stop following the profile default. */
    picked: boolean;
    /** The field has been left at least once — until then, stay quiet about errors. */
    touched: boolean;
}

function deriveState(value: string, fallback: CountryCode): FieldState {
    const parts = splitPhone(value, fallback);
    return {
        value,
        country: parts.country,
        text: formatPhoneNational(parts.national, parts.country),
        picked: false,
        touched: false,
    };
}

/**
 * The dashboard's only phone number field.
 *
 * A country selector followed by the national number, stored as E.164. The
 * number is formatted the way its country writes it as the vendor types, and
 * validated against that country's numbering plan; typing or pasting a number
 * that starts with `+` (or `00`) switches the selector to the country it names.
 *
 * ```tsx
 * <PhoneInput id="profile-phone" value={phone} onChange={setPhone} required />
 * ```
 */
export function PhoneInput({
    value,
    onChange,
    onBlur,
    defaultCountry,
    id,
    name,
    disabled,
    required,
    placeholder,
    invalid,
    error,
    hideError,
    className,
    autoFocus,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
}: PhoneInputProps) {
    const { t } = useTranslation();
    const profileCountry = useProfilePhoneCountry();
    const fallbackCountry = toPhoneCountry(defaultCountry, profileCountry);

    const generatedId = useId();
    const inputId = id ?? `phone-${generatedId}`;
    const errorId = `${inputId}-error`;

    const [state, setState] = useState(() => deriveState(value, fallbackCountry));

    // Adjusting state during render — React's answer to a synchronising effect.
    // `state.value` is exactly what we last emitted, so the parent echoing it
    // back is a no-op and anything else (a discard, a reset, a record that
    // finished loading) re-derives the country and the typed text.
    let current = state;
    if (current.value !== value) {
        current = deriveState(value, fallbackCountry);
        setState(current);
    } else if (!value && !current.picked && current.country !== fallbackCountry) {
        // Empty field: keep following the profile/form country as it resolves.
        // The session lands after first paint, and onboarding's Basic Setup
        // picks a country on the same screen as the payout number.
        current = { ...current, country: fallbackCountry };
        setState(current);
    }
    const { country, text, touched } = current;

    const inputRef = useRef<HTMLInputElement>(null);
    const pendingCaret = useRef<number | null>(null);

    // Reformatting rewrites the whole value, which would otherwise park the
    // caret at the end on every mid-string edit.
    useLayoutEffect(() => {
        if (pendingCaret.current === null || !inputRef.current) return;
        const position = pendingCaret.current;
        pendingCaret.current = null;
        inputRef.current.setSelectionRange(position, position);
    });

    const commit = useCallback(
        (next: FieldState) => {
            setState(next);
            onChange(next.value);
        },
        [onChange],
    );

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const raw = event.target.value;
            const caret = event.target.selectionStart ?? raw.length;

            let nextCountry = country;
            let working = raw;
            let rewrittenByCountryCode = false;

            // An international number pasted or typed into the national field
            // re-points the selector instead of being read as local digits.
            const trimmed = raw.trim();
            if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
                const parts = splitPhone(trimmed, country);
                nextCountry = parts.country;
                working = parts.national;
                rewrittenByCountryCode = true;
            }

            let digits = digitsOnly(working);
            let digitsBeforeCaret = digitsOnly(raw.slice(0, caret)).length;

            // Backspacing over a formatting space changes no digits, so the
            // reformat would put the character straight back and the caret would
            // stall. Take the digit in front of the separator, which is what the
            // vendor meant to delete.
            const deleting = raw.length < text.length;
            if (deleting && digits === digitsOnly(text) && digitsBeforeCaret > 0) {
                digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
                digitsBeforeCaret -= 1;
            }

            const formatted = formatPhoneNational(digits, nextCountry);
            pendingCaret.current = rewrittenByCountryCode
                ? formatted.length
                : caretAfterDigits(formatted, digitsBeforeCaret);

            commit({
                value: composeE164(nextCountry, digits),
                country: nextCountry,
                text: formatted,
                picked: current.picked || rewrittenByCountryCode,
                touched,
            });
        },
        [country, text, touched, current.picked, commit],
    );

    const handleCountryChange = useCallback(
        (nextCountry: CountryCode) => {
            const digits = digitsOnly(text);
            commit({
                value: composeE164(nextCountry, digits),
                country: nextCountry,
                text: formatPhoneNational(digits, nextCountry),
                picked: true,
                touched,
            });
            inputRef.current?.focus();
        },
        [text, touched, commit],
    );

    const handleBlur = useCallback(() => {
        setState((prev) => (prev.touched ? prev : { ...prev, touched: true }));
        onBlur?.();
    }, [onBlur]);

    // The parent's message wins; ours only appears once the field has been left.
    const ownErrorKey = touched && !disabled ? phoneErrorKey(value, { required, country }) : null;
    const message = error ?? (ownErrorKey ? t(ownErrorKey) : null);
    const isInvalid = invalid || !!message;

    return (
        <div className="w-full min-w-0">
            <div
                data-slot="phone-input"
                className={cn(
                    'border-input dark:bg-input/30 flex h-9 w-full min-w-0 items-stretch overflow-hidden',
                    'rounded-md border bg-transparent text-base shadow-xs md:text-sm',
                    'transition-[color,box-shadow]',
                    'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
                    isInvalid &&
                        'border-destructive ring-destructive/20 dark:ring-destructive/40 focus-within:border-destructive',
                    disabled && 'pointer-events-none opacity-50',
                    className,
                )}
            >
                <PhoneCountrySelect
                    value={country}
                    onChange={handleCountryChange}
                    disabled={disabled}
                    describedBy={message ? errorId : undefined}
                />
                <input
                    ref={inputRef}
                    id={inputId}
                    name={name}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    value={text}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder ?? phoneExample(country)}
                    aria-label={ariaLabel}
                    aria-invalid={isInvalid}
                    aria-describedby={
                        [ariaDescribedBy, message ? errorId : null].filter(Boolean).join(' ') ||
                        undefined
                    }
                    className={cn(
                        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
                        'w-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none',
                        'disabled:cursor-not-allowed',
                    )}
                />
            </div>
            {!hideError && message && (
                <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
                    {message}
                </p>
            )}
        </div>
    );
}
