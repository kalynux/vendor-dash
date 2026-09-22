// Changing the account email or phone — mirrors `/api/me/contact`, `/api/me/email`
// and `/api/me/phone`. See api-doc/me/contact-change.md.
//
// Both changes are two-step with a pending state, and the two halves prove
// control in completely different ways: a link emailed to the new address, and a
// six-digit WhatsApp code sent to the new number (`/me/phone/verify/*` — see
// phone-verification.types.ts).
//
// ⛔ **A phone change no longer needs a linked WhatsApp connection.** It used to:
// the only proof was a connection on the new number, confirmed through
// `POST /me/phone/confirm`. Since 2026-09-21 every frontend confirms with the
// code, and that route is left to the bot. Do not bring back "connect WhatsApp
// from your new number first" copy.
//
// ⚠ **No session is revoked.** Neither change stamps the password epoch, so every
// existing token on every device keeps working. Do not warn the vendor they will
// be signed out; they will not be. (Changing a *password* does sign other
// sessions out — different endpoint.)
//
// ⚠ **The pending value is not the identifier.** Sign-in keeps using the old value
// until confirmation, which a pending banner has to say explicitly, or a vendor
// who changes their email and closes the tab will try the new one and fail.

/** An in-flight change. `null` on the response when nothing is pending. */
export interface PendingContactChange {
  /** The requested new value. */
  target: string;
  requestedAt: string;
  /** Absolute. Email TTL is 1 hour; phone is 24 hours. */
  expiresAt: string;
}

/**
 * `GET /api/me/contact`. The token and its hash are never returned.
 *
 * ⚠ `email` and `phone` are each nullable — an account may hold only one of the
 * two, and a vendor registers with a phone and an *optional* email. A `null` here
 * is "nothing yet, add one", not a load failure.
 */
export interface ContactState {
  email: string | null;
  phone: string | null;
  pendingEmail: PendingContactChange | null;
  pendingPhone: PendingContactChange | null;
}

export interface ContactStateResponse {
  success: boolean;
  data: ContactState;
}
