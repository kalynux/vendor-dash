// Proving a phone number with a WhatsApp OTP — mirrors `/api/me/phone/verify/*`.
// See api-doc/me/phone-verification.md.
//
// There are two proofs of a phone number, and this dashboard uses only this one:
//
//   - `/me/phone/verify/confirm` proves it with a six-digit code we sent there.
//     It serves **every dashboard and the storefront** — customers included
//     since 2026-09-21 — both to verify the number already on the account and to
//     complete a pending change to a new one.
//   - `/me/phone/confirm` proves it by an existing WhatsApp *connection* on the
//     number. It is left to the bot surface, where the person is already writing
//     from that number. See contact-change.service.ts for why it was dropped here.
//
// A dashboard role never registers through the bot, so it holds no connection and
// `phone_verified` could never become true for it without this flow.
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
   * `"text"` when the code went as a free-form message inside Meta's 24-hour
   * service window, `"template"` otherwise — outside the window, or inside it when
   * the free-form send was refused and the backend fell back. Reported because it
   * is the first thing to ask in support when a code did not arrive.
   *
   * ⚠ It does not say WHICH template, deliberately. Never build UI on it.
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
