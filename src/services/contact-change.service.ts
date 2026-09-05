// Changing the account email or phone — 6 routes. See api-doc/me/contact-change.md.
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

// ─── Phone — proven by a WhatsApp connection ──────────────────────────────────

/**
 * Start a phone change. TTL 24 hours. Strict E.164, strict schema.
 *
 * 🔴 Gate this on a linked WhatsApp connection whose number is the NEW one. The
 * proof for a phone change is that connection existing — there is no code to
 * type — so an account without it cannot complete the flow and should be told
 * before the form, not after `422 CONTACT_CHANGE_PHONE_UNPROVEN`.
 */
export async function requestPhoneChange(phone: string): Promise<void> {
  await api.patch<{ success: boolean; message?: string }>('/me/phone', { phone });
}

/**
 * Complete a phone change.
 *
 * Authenticated, and takes **no body** — the call itself asks the backend to check,
 * at that moment, whether a WhatsApp connection exists whose number equals the
 * pending one.
 *
 * `422 CONTACT_CHANGE_PHONE_UNPROVEN` with `details: { channel: 'whatsapp' }`
 * when it does not.
 */
export async function confirmPhoneChange(): Promise<{ phone: string }> {
  const res = await api.post<{ success: boolean; data: { phone: string } }>(
    '/me/phone/confirm',
  );
  return res.data;
}

/** Abandon a pending phone change. `409 CONTACT_CHANGE_NOT_PENDING` if there is none. */
export async function cancelPhoneChange(): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>('/me/phone/pending');
}
