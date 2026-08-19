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
 * Phone **or** email, in one field.
 *
 * `POST /auth/login` takes a single `identifier` and works out which it is, so
 * the form does too rather than making the vendor pick a mode. Phone is checked
 * as E.164 against the numbering plan; anything containing an `@` is checked as
 * an email. A value that is neither fails as "not valid" rather than silently
 * being sent for the server to reject.
 */
const identifier = z
    .string()
    .trim()
    .min(1, 'auth.validation.identifierRequired')
    .refine(
        (value) => (value.includes('@') ? isValidEmail(value) : isValidE164(value)),
        'auth.validation.identifierInvalid',
    );

export const loginSchema = z.object({
    identifier,
    password: z.string().min(1, 'auth.validation.passwordRequired'),
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
