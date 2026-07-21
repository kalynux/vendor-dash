import { api, unwrapEnvelope } from './api';
import type {
  TelegramLinkToken,
  TelegramStatus,
  TelegramToggleResult,
  WhatsappVerification,
  WhatsappStatus,
} from '@/types/notifications.types';

// Linking/verification flows for the secondary notification channels.
// These flip the read-only `*Verified` flags read by GET /vendor/notification-preferences.
// See api-doc/vendor/notification-channels.md.
//
// NOTE (envelope migration, 2026-07-17): auth + Telegram/WhatsApp link-status
// endpoints now return the standard `{ success, data }` envelope. We unwrap via
// `unwrapEnvelope`, which also tolerates the bare payload some per-feature docs
// still show. See the WhatsApp path ambiguity noted in the implementation report.

// ─── Email ──────────────────────────────────────────────────────────────────

/** Send the verification email to the authenticated vendor. */
export async function sendEmailVerification(): Promise<{ message: string }> {
  return unwrapEnvelope<{ message: string }>(await api.post('/auth/send-email-verification'));
}

// ─── Telegram ───────────────────────────────────────────────────────────────

/** Get a single-use bot deep-link (valid 10 min) for the vendor to open in Telegram. */
export async function requestTelegramLink(): Promise<TelegramLinkToken> {
  return unwrapEnvelope<TelegramLinkToken>(await api.post('/webhooks/telegram/link-token'));
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  return unwrapEnvelope<TelegramStatus>(await api.get('/webhooks/telegram/status'));
}

/** Pause/resume delivery without removing the link. `isActive: false` ⇒ telegramVerified reports false. */
export async function toggleTelegram(isActive: boolean): Promise<TelegramToggleResult> {
  return unwrapEnvelope<TelegramToggleResult>(
    await api.post('/webhooks/telegram/toggle', { is_active: isActive }),
  );
}

export async function disconnectTelegram(): Promise<void> {
  await api.post('/webhooks/telegram/disconnect');
}

// ─── WhatsApp ───────────────────────────────────────────────────────────────

/** Request a verification code + wa.me deep-link the vendor sends to the bot. */
export async function requestWhatsappVerification(): Promise<WhatsappVerification> {
  return unwrapEnvelope<WhatsappVerification>(await api.post('/auth/request-wa-verification'));
}

export async function getWhatsappStatus(): Promise<WhatsappStatus> {
  return unwrapEnvelope<WhatsappStatus>(await api.get('/webhooks/whatsapp/link/status'));
}

export async function unlinkWhatsapp(): Promise<void> {
  await api.delete('/webhooks/whatsapp/link');
}
