// Server-side product share — POST /api/vendor/products/:id/share.
// See api-doc/vendor/product-share.md.
//
// 🔴 This sends the product to the vendor's OWN linked messaging account, which
// they then forward. It is not a share link, not a token, not a generated card,
// and there is NO recipient field — "send this to myself on WhatsApp so I can
// forward it", which is how social-commerce sellers actually work.
//
// It is deliberately distinct from the deep-link route in `ShareProductDialog`,
// which composes the message client-side and hands it to wa.me / t.me. That works
// with no linked account and lets the vendor pick the recipient in the messaging
// app. This one needs a connection but formats server-side from
// `descriptionRich`, and works from a device with neither app installed.
//
// The product may be in any state — the route is deliberately not behind the
// vectorisation lock, because sharing only reads.

import { api } from './api';
import type { ApiError } from '@/types/api';
import type { ConnectionInstructions, MessagingChannel } from '@/types/connections.types';

/**
 * What the backend sent, and where.
 *
 * 🔴 Do not render `sentTo`. The backend's own doc calls it "a masked hint, never
 * the raw identifier" and both halves are wrong: the masking function is never
 * called on this path, so Telegram returns the **raw @handle**, and WhatsApp
 * returns **`null`** because a WhatsApp connection carries no handle at all.
 * Name the channel instead — which is what `message` already does correctly.
 */
export interface ProductShareResult {
  channel: MessagingChannel;
  sentTo: string | null;
}

interface ProductShareResponse {
  success: boolean;
  data: ProductShareResult;
  message?: string;
}

/**
 * Send a product to the vendor's own linked WhatsApp or Telegram.
 *
 * The message is composed server-side and the vendor cannot edit it first:
 * title (truncated to 200), storefront URL, then the description rendered from
 * `descriptionRich` when present. The URL line is **omitted entirely** when the
 * vendor has no store or the deployment has no storefront base configured — so a
 * product with no description and no store sends a message that is just a title.
 *
 * Errors, all worth distinct copy:
 *   404 CATALOG_PRODUCT_NOT_FOUND            — gone, or not this vendor's
 *   422 PRODUCT_SHARE_CHANNEL_NOT_CONNECTED  — carries the connection recipe
 *   422 PRODUCT_SHARE_WINDOW_CLOSED          — WhatsApp's free-form window shut
 *   502 PRODUCT_SHARE_SEND_FAILED            — downstream; tells you nothing
 *
 * ⚠ The request schema is strict. A `to`, `recipient` or `phone` field is a
 * `400 VALIDATION_ERROR`, not a silently ignored extra.
 */
export async function shareProductToChannel(
  productId: string,
  channel: MessagingChannel,
): Promise<{ result: ProductShareResult; message?: string }> {
  const res = await api.post<ProductShareResponse>(
    `/vendor/products/${encodeURIComponent(productId)}/share`,
    { channel },
  );
  return { result: res.data, message: res.message };
}

/**
 * The connection recipe a `PRODUCT_SHARE_CHANNEL_NOT_CONNECTED` carries, or
 * `null` for any other error.
 *
 * 🔴 Worth reading rather than redirecting to settings. The error's category is
 * `business_rule`, so unlike a 5xx both its message and its `details` survive the
 * boundary filter intact — meaning the bot handle and deep link needed to fix the
 * problem arrive with the complaint. Render the link inline.
 */
export function shareConnectionHint(err: ApiError): ConnectionInstructions | null {
  if (err.code !== 'PRODUCT_SHARE_CHANNEL_NOT_CONNECTED') return null;
  const hint = err.detailsObject?.howToConnect;
  if (!hint || typeof hint !== 'object') return null;
  const { command, botHandle, deepLink } = hint as Record<string, unknown>;
  return {
    command: typeof command === 'string' ? command : '/connect',
    botHandle: typeof botHandle === 'string' ? botHandle : null,
    deepLink: typeof deepLink === 'string' ? deepLink : null,
  };
}
