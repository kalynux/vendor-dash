import { api } from './api';
import type {
  TelegramLinkToken,
  TelegramStatus,
  WhatsappVerification,
  WhatsappStatus,
} from '@/types/notifications.types';

// Linking/verification flows for the secondary notification channels.
// These flip the read-only `*Verified` flags read by GET /vendor/notification-preferences.
// See api-doc/vendor/notification-channels.md.

// ─── Email ──────────────────────────────────────────────────────────────────

/** Send the verification email to the authenticated vendor. */
export async function sendEmailVerification(): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/send-email-verification');
}

// ─── Telegram ───────────────────────────────────────────────────────────────

/** Get a single-use bot deep-link (valid 10 min) for the vendor to open in Telegram. */
export async function requestTelegramLink(): Promise<TelegramLinkToken> {
  return api.post<TelegramLinkToken>('/webhooks/telegram/link-token');
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  return api.get<TelegramStatus>('/webhooks/telegram/status');
}

/** Pause/resume delivery without removing the link. `isActive: false` ⇒ telegramVerified reports false. */
export async function toggleTelegram(isActive: boolean): Promise<TelegramStatus> {
  return api.post<TelegramStatus>('/webhooks/telegram/toggle', { is_active: isActive });
}

export async function disconnectTelegram(): Promise<{ message?: string }> {
  return api.post<{ message?: string }>('/webhooks/telegram/disconnect');
}

// ─── WhatsApp ───────────────────────────────────────────────────────────────

/** Request a verification code + wa.me deep-link the vendor sends to the bot. */
export async function requestWhatsappVerification(): Promise<WhatsappVerification> {
  return api.post<WhatsappVerification>('/auth/request-wa-verification');
}

export async function getWhatsappStatus(): Promise<WhatsappStatus> {
  return api.get<WhatsappStatus>('/webhooks/whatsapp/link/status');
}

export async function unlinkWhatsapp(): Promise<{ message?: string }> {
  return api.delete<{ message?: string }>('/webhooks/whatsapp/link');
}
