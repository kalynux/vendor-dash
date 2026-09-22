// Proving a phone number with a WhatsApp OTP — 3 routes. See
// api-doc/me/phone-verification.md.
//
// Role-agnostic: these live under /api/me and resolve the account from the token.
// They are the one way this dashboard proves a phone number — both the number
// already on the account and the new one in a pending change. See the type module
// for why the connection proof (`/me/phone/confirm`) is not used here.
//
// Refusals:
//   422 PHONE_VERIFICATION_NO_TARGET         no number on the account — PATCH /me/phone first
//   422 PHONE_VERIFICATION_CODE_INVALID      wrong code — `details.attemptsLeft`, let them retype
//   422 PHONE_VERIFICATION_CODE_EXPIRED      past its TTL, or nothing in flight — offer a new code
//   429 PHONE_VERIFICATION_TOO_MANY_ATTEMPTS the code is destroyed — request a new one
//   429 PHONE_VERIFICATION_RESEND_TOO_SOON   cooldown — `details.retryAfterSeconds`
//   502 PHONE_VERIFICATION_DELIVERY_FAILED   WhatsApp refused the send — retryable
//
// ⚠ `CODE_INVALID` and `CODE_EXPIRED` are deliberately **distinct** and must stay
// that way in the UI: the remedies differ — retype versus request a new code.
// Collapsing them sends people hunting for a typo that is not there.
//
// ⛔ **`DELIVERY_FAILED` must NEVER tell the vendor to message the WhatsApp bot.**
// It used to, when no approved template existed and texting the bot was thought
// to be the only way to get a code through. As of 2026-09-21 the backend sends
// free text where it can and falls back to an approved template everywhere else,
// so by the time this 502 comes back every route has been tried and WhatsApp
// refused them all. Nothing the vendor does in the bot changes that — and while
// the old advice stood, texting the bot actually steered the code onto a path
// that failed. The contract now (api-doc/me/phone-verification.md):
//
//   - a temporary failure with a way to try again — no cooldown was started, so
//     an immediate retry is allowed (the code is stored only after a send works);
//   - a way to contact support if it keeps happening;
//   - never "we can't reach our systems" — branch on the code, not the status.

import { api } from './api';
import { ApiError } from '@/types/api';
import type {
  PhoneVerificationRequestResult,
  PhoneVerificationResult,
  PhoneVerificationState,
  PhoneVerificationStateResponse,
} from '@/types/phone-verification.types';

/**
 * What is verifiable and whether a code is in flight. Free, no side effect.
 *
 * Does **not** refuse on an account with no number — it reports `phoneMasked:
 * null`, which is the signal not to offer the flow at all. Only `request` raises
 * `PHONE_VERIFICATION_NO_TARGET`.
 */
export async function fetchPhoneVerificationState(): Promise<PhoneVerificationState> {
  const res = await api.get<PhoneVerificationStateResponse>('/me/phone/verify');
  return res.data;
}

/**
 * Send a code.
 *
 * No body: the target is chosen **server-side** — the pending number when a change
 * is in flight, otherwise the current one. The caller never names it.
 */
export async function requestPhoneVerificationCode(): Promise<PhoneVerificationRequestResult> {
  const res = await api.post<{ success: boolean; data: PhoneVerificationRequestResult }>(
    '/me/phone/verify/request',
  );
  return res.data;
}

/**
 * Spend the code.
 *
 * ⚠ Send **only** `code`. The schema is `.strict()`, so adding `phone` is a 400 —
 * and the number is not the caller's to name anyway: it was bound to the code when
 * the code was minted.
 */
export async function confirmPhoneVerification(code: string): Promise<PhoneVerificationResult> {
  const res = await api.post<{ success: boolean; data: PhoneVerificationResult }>(
    '/me/phone/verify/confirm',
    { code },
  );
  return res.data;
}

/**
 * Attempts remaining after a wrong code, or `null` when the backend did not say.
 *
 * Disclosed on purpose: it tells the holder of the real code that they mistyped
 * and how much room is left, and tells an attacker only what they could count
 * themselves. The secret is the code, not the counter. Read only off
 * `CODE_INVALID` — an invented number here is worse than none.
 *
 * ⚠ The key is `attemptsLeft`. Billing's OTP relay spells the same idea
 * `attemptsRemaining` (`otpAttemptsRemaining` in billing.constants) — they are
 * different surfaces and neither reader works on the other's error.
 */
export function phoneVerificationAttemptsLeft(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.code !== 'PHONE_VERIFICATION_CODE_INVALID') return null;
  const value = err.detailsObject?.attemptsLeft;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
