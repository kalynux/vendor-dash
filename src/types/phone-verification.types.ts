// Proving a phone number with a WhatsApp OTP — mirrors `/api/me/phone/verify/*`.
// See api-doc/me/phone-verification.md.
//
// 🔴 **This is not an alternative to `POST /api/me/phone/confirm`, it is the other
// half of it.** There are two proofs of a phone number and they serve accounts
// the other cannot reach:
//
//   - `/me/phone/confirm` proves the number by an existing WhatsApp *connection*
//     on it. Stronger — a message actually arrived from the number — but it
//     serves customers, who reach the platform through the bot.
//   - `/me/phone/verify/confirm` proves it with a six-digit code we sent there.
//     Weaker, and it is what serves **vendor · agency · agent · admin**.
//
// A dashboard role never registers through the bot, so it holds no connection and
// `phone_verified` could never become true for it. That is what this flow is for.
//
// ⚠ **The confirm body is `.strict()` and accepts only `code`.** Sending `phone`
// alongside it is a 400, not a silently-stripped field: the number was fixed when
// the code was minted. A caller that could name the number could prove control of
// one and have another marked verified.

/** `GET /api/me/phone/verify` — what is verifiable, and whether a code is in flight. */
export interface PhoneVerificationState {
  /**
   * The target, masked (`"+237•••••3456"`), or `null` when the account carries no
   * number at all. `null` is the signal not to offer the flow — the GET reports it
   * rather than refusing, and only `request` raises `PHONE_VERIFICATION_NO_TARGET`.
   */
  phoneMasked: string | null;
  /**
   * The field that decides the copy. `true` when a phone change is in flight, so
   * the code proves the **new** number and confirming swaps the account's
   * identifier; `false` when it merely proves the number already on the account.
   */
  completesPendingChange: boolean;
  /** A code is live right now. */
  pending: boolean;
  /** Absolute, and `null` when nothing is in flight. */
  expiresAt: string | null;
}

/** `POST /api/me/phone/verify/request`. No body — the target is chosen server-side. */
export interface PhoneVerificationRequestResult {
  phoneMasked: string;
  expiresAt: string;
  /**
   * `"text"` inside Meta's 24-hour service window, `"template"` outside it.
   * Reported because it is the first thing to ask in support when a code did not
   * arrive — and outside the window delivery currently fails outright, because
   * this WABA holds no approved template yet.
   */
  delivery: 'text' | 'template';
}

/** `POST /api/me/phone/verify/confirm`. */
export interface PhoneVerificationResult {
  phone: string;
  /** `true` when the account's login phone moved; `false` when it was verified in place. */
  changed: boolean;
}

export interface PhoneVerificationStateResponse {
  success: boolean;
  data: PhoneVerificationState;
}
