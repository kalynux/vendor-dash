// Messaging connections — WhatsApp and Telegram linking.
// Base: /api/me/connections · any signed-in role · see api-doc/connections/README.md.
//
// Replaces `notification-channels.service.ts`'s Telegram and WhatsApp functions,
// every one of which called an endpoint that no longer exists. Those routes lived
// under `/api/webhooks/*`, which is exempt from both rate limiting and maintenance
// mode so gateway callbacks always get through; the linking endpoints inherited
// both exemptions for no reason. These inherit neither — all three are refused
// during a `down` window, and the two writes during `readonly` as well.
//
// Linking and muting are now two separate concerns:
//   • linked?         → here
//   • deliver there?  → GET/PATCH /vendor/notification-preferences

import { api } from './api';
import type {
  ConnectionRedeemResponse,
  ConnectionsListResponse,
  MessagingChannel,
  MessagingConnection,
} from '@/types/connections.types';
import type { SecondaryChannel } from '@/types/notifications.types';

const BASE = '/me/connections';

/**
 * Narrow a notification-settings channel to the two that have a messaging
 * connection, or `null` for email.
 *
 * Email is *verified*, not *linked* — it has no entry here, no bot and nothing to
 * disconnect. The settings screen lists all three together, so this is the guard
 * that keeps an email row out of a connections call.
 */
export function asMessagingChannel(
  channel: SecondaryChannel,
): MessagingChannel | null {
  return channel === 'telegram' || channel === 'whatsapp' ? channel : null;
}

/**
 * Every channel's current state, linked or not.
 *
 * Always returns one entry per channel, so a missing entry means the backend
 * added a channel this build does not know about — not that it is unlinked.
 */
export async function listConnections(): Promise<MessagingConnection[]> {
  const res = await api.get<ConnectionsListResponse>(BASE);
  return res.data.connections;
}

/**
 * Redeem the 6-character code the bot gave the vendor.
 *
 * 🔴 Send exactly what was typed. The server strips whitespace and dashes,
 * uppercases, and maps the confusable characters O→0, I→1, L→1 — and its schema
 * is deliberately loose (6–32 chars) so that `a7k9p-2` reaches that normaliser
 * intact. Normalising here gets it subtly wrong and produces
 * CONNECTION_CODE_INVALID for codes that would have worked.
 *
 * 🔴 A code is spent by the attempt even when the redeem fails — it is consumed
 * atomically before the ownership check. So a 409 means "get a new code", not
 * "try again"; retrying the same code afterwards gives CONNECTION_CODE_INVALID
 * and reads as a second, different failure.
 *
 * Errors: CONNECTION_CODE_INVALID (400) · CONNECTION_CODE_EXPIRED (400) ·
 * CONNECTION_CODE_ATTEMPTS_EXCEEDED (429, 5 per 10 min per account) ·
 * MESSAGING_IDENTITY_ALREADY_LINKED (409, `details.channel` only — it never says
 * which account holds it) · RATE_LIMIT_EXCEEDED (429, 30/min per IP).
 */
export async function redeemConnectionCode(code: string): Promise<MessagingConnection> {
  const res = await api.post<ConnectionRedeemResponse>(BASE, { code });
  return res.data;
}

/**
 * Unlink a channel.
 *
 * ⚠ Not idempotent — a second delete gives 404
 * MESSAGING_CONNECTION_NOT_FOUND with `details.channel`. Gate the button on
 * `connected === true`.
 */
export async function disconnectChannel(channel: MessagingChannel): Promise<void> {
  await api.delete<{ success: boolean; data: null; message?: string }>(
    `${BASE}/${channel}`,
  );
}
