// Changing the account email or phone — mirrors `/api/me/contact`, `/api/me/email`
// and `/api/me/phone`. See api-doc/me/contact-change.md.
//
// Both changes are two-step with a pending state, and the two halves prove
// control in completely different ways.
//
// 🔴 **Changing a phone number requires a linked WhatsApp connection, and a
// Telegram connection does not count.** There is no SMS code: the proof is that
// the account already has a WhatsApp connection whose number IS the pending
// number. So an account with no WhatsApp connection cannot change its phone here
// at all — say so before the form rather than after a 422.
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

/** `GET /api/me/contact`. The token and its hash are never returned. */
export interface ContactState {
  email: string;
  phone: string;
  pendingEmail: PendingContactChange | null;
  pendingPhone: PendingContactChange | null;
}

export interface ContactStateResponse {
  success: boolean;
  data: ContactState;
}
