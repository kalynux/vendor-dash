import { isEmptyDoc } from './doc';
import { toWhatsApp } from './format/whatsapp';
import { toTelegramPlain } from './format/telegram';
import { CHAT_LIMITS, DESCRIPTION_BUDGET } from './limits';
import type { RichDoc } from './types';

/**
 * Composing the message a vendor actually sends.
 *
 * The formatters render a *description*; this renders a *product*. Keeping them
 * apart matters because the backend will need the description formatters on
 * their own (for bot replies and catalog messages) without this chrome, and
 * because the chrome is the part most likely to change with marketing.
 */

export type ShareChannel = 'whatsapp' | 'telegram';

export type ShareProductInput = {
  title: string;
  /** Pre-formatted by the caller, which owns the locale and the currency. */
  price?: string | null;
  doc: RichDoc;
  url?: string | null;
};

/**
 * The storefront URL for a product.
 *
 * There is no product-level `publicUrl` on the vendor API — the product carries
 * a bare `slug` and the store carries its own `publicUrl` — so the customer-
 * facing address has to be composed here. Isolated in one function precisely
 * because it is the piece most likely to need correcting against the live
 * storefront's routing.
 */
export function productPublicUrl(storePublicUrl: string | null | undefined, slug: string | null | undefined): string | null {
  if (!storePublicUrl || !slug) return null;
  return `${storePublicUrl.replace(/\/+$/, '')}/products/${encodeURIComponent(slug)}`;
}

/**
 * Build the message body for a channel.
 *
 * The title is emphasised per channel rather than being folded into the
 * description: a vendor should not have to remember to bold their own product
 * name, and a title that is *always* the first bold line is what makes a shared
 * product recognisable in a busy chat.
 */
export function buildProductShareMessage(input: ShareProductInput, channel: ShareChannel): string {
  const parts: string[] = [];

  // WhatsApp gets its marker; the Telegram share deep-link has no `parse_mode`,
  // so its title is plain. (A Bot API send would use `toTelegramHtml` and could
  // bold it — that path belongs to the backend, not to a share URL.)
  parts.push(channel === 'whatsapp' ? `*${input.title.trim()}*` : input.title.trim());

  if (input.price) parts.push(input.price);

  if (!isEmptyDoc(input.doc)) {
    const body =
      channel === 'whatsapp'
        ? toWhatsApp(input.doc, { maxLength: DESCRIPTION_BUDGET })
        : toTelegramPlain(input.doc, { maxLength: DESCRIPTION_BUDGET });
    if (body) parts.push(body);
  }

  // Only WhatsApp carries the link in the body. `t.me/share/url` takes the URL
  // as its own parameter and renders it as a link preview, so putting it in
  // `text` as well would show the customer the same address twice.
  if (input.url && channel === 'whatsapp') parts.push(input.url);

  const message = parts.join('\n\n');
  return message.length > CHAT_LIMITS.MAX ? `${message.slice(0, CHAT_LIMITS.MAX - 1)}…` : message;
}

/**
 * `https://wa.me/?text=…` opens the WhatsApp contact picker with the message
 * pre-filled — no phone number, because the vendor chooses the recipient.
 */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Telegram's share endpoint takes the link and the message separately, and
 * renders `text` verbatim — which is why it is fed `toTelegramPlain` output and
 * never the HTML formatter.
 */
export function telegramShareUrl(message: string, url?: string | null): string {
  const params = new URLSearchParams();
  // `url` is required by t.me/share; when a product has no public URL we pass an
  // empty one so the whole message still lands in `text`.
  params.set('url', url ?? '');
  params.set('text', message);
  return `https://t.me/share/url?${params.toString()}`;
}

export function shareUrlFor(channel: ShareChannel, message: string, url?: string | null): string {
  return channel === 'whatsapp' ? whatsappShareUrl(message) : telegramShareUrl(message, url);
}
