// Changing the account email or phone. See api-doc/me/contact-change.md.
//
// Five of the doc's six routes are called from here. The sixth,
// `POST /me/phone/confirm`, is deliberately not — see the note where
// `confirmPhoneChange` used to be.
//
// Role-agnostic: these live under /api/me and resolve the account from the token.
//
// Errors shared by both flows:
//   422 CONTACT_CHANGE_SAME_IDENTIFIER    the new value equals the current one
//   409 CONTACT_CHANGE_IDENTIFIER_TAKEN   another account holds it
//   422 CONTACT_CHANGE_EXPIRED            past the TTL
//   409 CONTACT_CHANGE_NOT_PENDING        nothing in flight (the cancels too)
//
// ⚠ CONTACT_CHANGE_IDENTIFIER_TAKEN can arrive at CONFIRM time, not just at
// request time — the address was free an hour ago and is not now. Handle it on
// both calls.

import { api } from './api';
import type { ContactState, ContactStateResponse } from '@/types/contact-change.types';

/**
 * Current identifiers plus anything in flight.
 *
 * Re-fetch after every action to drive the pending banner and its countdown;
 * `expiresAt` is absolute.
 */
export async function fetchContactState(): Promise<ContactState> {
  const res = await api.get<ContactStateResponse>('/me/contact');
  return res.data;
}

// ─── Email — proven by a link sent to the NEW address ─────────────────────────

/** Start an email change. TTL 1 hour. Strict schema. */
export async function requestEmailChange(email: string): Promise<void> {
  await api.patch<{ success: boolean; message?: string }>('/me/email', { email });
}

/**
 * `confirmEmailChange` lived here and is GONE, along with the page that called it.
 *
 * It existed to hedge an open question — which app owns `/account/confirm-email`
 * — and that question is closed. The backend builds the link from
 * `STOREFRONT_URL`, a single variable with no role branch, so it has always
 * pointed at the main site; the page there now serves all four apps and receives
 * `app=vendor` so it can send the vendor back here afterwards.
 *
 * ⚠ **Do not reinstate it.** `POST /api/auth/email-change/confirm` reads no
 * session, resolves the account from the token in the link, and syncs the
 * confirmed address onto every role profile the account holds — so a second
 * implementation would have nothing to do differently, and would only be another
 * place to get the POST-not-GET rule wrong. (A `GET` that mutates is spent by
 * whatever prefetches the mail.)
 *
 * The half of the flow this dashboard *does* own is `requestEmailChange` above:
 * it is authenticated, and it is what stamps `app=vendor` into the link.
 *
 * See jovi-mall `api-doc/auth/FRONTEND-CHANGELOG-email-verification.md`.
 */

/** Abandon a pending email change. `409 CONTACT_CHANGE_NOT_PENDING` if there is none. */
export async function cancelEmailChange(): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>('/me/email/pending');
}

// ─── Phone — proven by a WhatsApp code ────────────────────────────────────────

/**
 * Start a phone change. TTL 24 hours. Strict E.164, strict schema.
 *
 * Writes the pending change and nothing else. The three calls are:
 *
 *   PATCH /me/phone              → pending; the old number still signs in
 *   POST  /me/phone/verify/request → code sent to the NEW number
 *   POST  /me/phone/verify/confirm → the sign-in number swaps
 *
 * ⚠ **This does not send the code — ask for it explicitly, straight after.**
 * The backend deliberately leaves the send out of this call: doing it here would
 * start the 60-second resend cooldown, and the explicit request every client
 * makes next would then be refused with a 429. The last two calls live in
 * phone-verification.service.ts.
 */
export async function requestPhoneChange(phone: string): Promise<void> {
  await api.patch<{ success: boolean; message?: string }>('/me/phone', { phone });
}

/**
 * `confirmPhoneChange` (`POST /me/phone/confirm`) lived here and is GONE.
 *
 * It completed a change by checking for a WhatsApp *connection* on the new
 * number — the only proof there was, once. Since 2026-09-21 the backend's
 * contract is that every frontend confirms with the six-digit code instead, and
 * that route stays for the WhatsApp bot, where the person is already writing from
 * the number. For a vendor it could only ever succeed if they had linked WhatsApp
 * from the new number before changing it, and otherwise answered
 * `CONTACT_CHANGE_PHONE_UNPROVEN`.
 *
 * ⚠ **Do not reinstate it.** The code path covers everything it did: when a code
 * completes a change, the backend also moves the account's WhatsApp link off the
 * number being given up.
 */

/** Abandon a pending phone change. `409 CONTACT_CHANGE_NOT_PENDING` if there is none. */
export async function cancelPhoneChange(): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>('/me/phone/pending');
}
