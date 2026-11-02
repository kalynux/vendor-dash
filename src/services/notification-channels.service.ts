import { api, unwrapEnvelope } from './api';

// Email verification for the authenticated vendor.
//
// This file used to carry the Telegram and WhatsApp linking flows too. All seven
// of those calls 404 now — the whole surface moved to `/api/me/connections` and
// the handshake inverted (the bot mints the code, the vendor carries it back).
// See `connections.service.ts` and api-doc/MIGRATION-2026-08.md § 1.
//
// The pause/resume toggle did not move with them: linking and muting are separate
// concerns now, and muting lives on `PATCH /vendor/notification-preferences` as
// `telegramEnabled` / `whatsappEnabled`.

/** The two fields of `GET /vendor/profile` this flow reads. */
export interface EmailVerificationState {
  email: string;
  emailVerified: boolean;
}

/**
 * Send the verification email to the authenticated vendor.
 *
 * ⚠ The link goes to the address on the vendor PROFILE, not the sign-in email in
 * `GET /me/contact`. Compare the two (see `fetchEmailVerificationState`) before
 * telling the vendor which address to look in.
 *
 * There is no server cooldown: each call mails a new link and earlier ones keep
 * working for their 24 hours. The only limit is the shared credential bucket
 * (20/min/IP), the same one sign-in uses.
 */
export async function sendEmailVerification(): Promise<{ message: string }> {
  return unwrapEnvelope<{ message: string }>(await api.post('/auth/send-email-verification'));
}

/**
 * The profile's address and whether it is verified, read live.
 *
 * Not `session.role_entity.email_verified`: the link is opened in a mail client,
 * usually somewhere else entirely, so the session this page loaded with goes stale
 * the moment the vendor succeeds. `email` is `''` when the profile has none.
 */
export async function fetchEmailVerificationState(): Promise<EmailVerificationState> {
  return unwrapEnvelope<EmailVerificationState>(await api.get('/vendor/profile'));
}
