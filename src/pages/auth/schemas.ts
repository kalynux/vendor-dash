import { z } from 'zod';

import { isValidE164 } from '@/lib/phone';
import { isValidEmail } from '@/lib/email';

/**
 * Validation for the in-app auth screens.
 *
 * Messages are translation **keys**, not sentences — the same convention the
 * onboarding schemas use. The resolver looks each one up, so a message follows
 * the vendor's language instead of being frozen in English at import time.
 */

/** At least 8 characters, matching what the backend enforces. */
const password = z
    .string()
    .min(1, 'auth.validation.passwordRequired')
    .min(8, 'auth.validation.passwordTooShort');

/**
 * Phone **or** email, in one field — the *forgot password* screen's identifier.
 *
 * Sign-in splits the two across tabs (see `loginSchema`); this screen does not,
 * because there is nothing here for a country selector to improve — the vendor
 * is recalling an identifier rather than composing one, and the whole form is a
 * single field. Phone is checked as E.164 against the numbering plan; anything
 * containing an `@` is checked as an email. A value that is neither fails as
 * "not valid" rather than silently being sent for the server to reject.
 */
const identifier = z
    .string()
    .trim()
    .min(1, 'auth.validation.identifierRequired')
    .refine(
        (value) => (value.includes('@') ? isValidEmail(value) : isValidE164(value)),
        'auth.validation.identifierInvalid',
    );

/**
 * The two ways in, as the sign-in screen presents them.
 *
 * `POST /auth/login` still takes ONE `identifier` and works out which it is —
 * this split is a *form* concern, not a wire one. It exists because a single
 * combined field cannot show a country-code selector: the field has to already
 * know it is holding a phone number before it can offer one, and on a phone the
 * country code is the part people are least sure of.
 *
 * Phone is first, and the default, because it is the identifier every vendor
 * has: registration requires it and leaves email optional.
 */
export const LOGIN_MODES = ['phone', 'email'] as const;

export type LoginMode = (typeof LOGIN_MODES)[number];

/**
 * Which mode an already-known identifier belongs to.
 *
 * Used to re-open the screen on the tab that matches a stored fingerprint
 * credential, so a vendor enrolled with an email is not dropped onto the phone
 * tab with their own address sitting in the wrong field.
 */
export function loginModeFor(identifier: string | null | undefined): LoginMode {
    return identifier?.includes('@') ? 'email' : 'phone';
}

/**
 * Sign-in, validated against the tab that is open.
 *
 * The rule cannot live on the field alone: the *same* string is valid or not
 * depending on which tab produced it, and validating "email or phone" while the
 * phone tab is open would accept an address typed into a field that renders a
 * country selector next to it.
 */
export const loginSchema = z
    .object({
        mode: z.enum(LOGIN_MODES),
        // Validated in the refinement below, which is the only place that knows
        // which of the two shapes is expected.
        identifier: z.string().trim(),
        password: z.string().min(1, 'auth.validation.passwordRequired'),
    })
    .superRefine((values, ctx) => {
        const isEmail = values.mode === 'email';
        const fail = (message: string) =>
            ctx.addIssue({ code: 'custom', path: ['identifier'], message });

        if (!values.identifier) {
            fail(isEmail ? 'auth.validation.emailRequired' : 'common.validation.phoneRequired');
            return;
        }
        if (isEmail ? !isValidEmail(values.identifier) : !isValidE164(values.identifier)) {
            fail(isEmail ? 'common.validation.email' : 'common.validation.phone');
        }
    });

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
    .object({
        name: z.string().trim().min(1, 'auth.validation.nameRequired'),
        business_name: z.string().trim().min(1, 'auth.validation.businessRequired'),
        // Stored as E.164 by `<PhoneInput>`. This is the account's primary
        // identifier, so it is required even though `email` is not.
        phone: z
            .string()
            .trim()
            .min(1, 'common.validation.phoneRequired')
            .refine(isValidE164, 'common.validation.phone'),
        // Optional, but the only password-recovery channel — the copy says so.
        email: z
            .string()
            .trim()
            .refine((v) => v === '' || isValidEmail(v), 'common.validation.email'),
        password,
        confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
        message: 'auth.validation.confirmMismatch',
        path: ['confirmPassword'],
    });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ identifier });

export type ForgotFormValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
    .object({
        password,
        confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
        message: 'auth.validation.confirmMismatch',
        path: ['confirmPassword'],
    });

export type ResetFormValues = z.infer<typeof resetSchema>;
