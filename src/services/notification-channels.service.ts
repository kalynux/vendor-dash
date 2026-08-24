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

/** Send the verification email to the authenticated vendor. */
export async function sendEmailVerification(): Promise<{ message: string }> {
  return unwrapEnvelope<{ message: string }>(await api.post('/auth/send-email-verification'));
}
