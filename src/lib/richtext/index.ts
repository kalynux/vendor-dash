/**
 * Chat-native product descriptions.
 *
 *   editor ──▶ RichDoc ──┬──▶ toPlainText     → `description` (storefront, search, AI index)
 *                        ├──▶ toWhatsApp      → Cloud API `text.body` / caption
 *                        ├──▶ toTelegramHtml  → Bot API `sendMessage` + parse_mode: 'HTML'
 *                        └──▶ toTelegramPlain → `t.me/share/url?text=` (no parse_mode)
 *
 * The document is the source of truth. Every channel string is generated from
 * it, never parsed back out of it — which is what keeps adding a fourth channel
 * a matter of writing one formatter.
 */

export { EMPTY_DOC, INLINE_MARKS, RICH_DOC_VERSION, ALLOWED_LINK_SCHEMES } from './types';
export type { Block, BlockType, InlineMark, InlineNode, RichDoc } from './types';

export {
  cloneDoc,
  docCharCount,
  docsEqual,
  flattenLink,
  isEmptyDoc,
  listPrefix,
  marksOf,
  normalizeDoc,
  toPlainText,
  truncateDoc,
} from './doc';

export { CHAT_LIMITS, DESCRIPTION_BUDGET, truncate } from './limits';
export { isAllowedHref, parseRichDoc, richDocSchema } from './schema';
export { hydrateDoc, linkifyInline, plainTextToDoc } from './plaintext';
export { docToHtml, htmlToDoc } from './dom';
export { lintDoc } from './lint';
export type { LintNotice, LintSeverity } from './lint';

export { toWhatsApp } from './format/whatsapp';
export { escapeTelegramHtml, toTelegramHtml, toTelegramPlain } from './format/telegram';

export {
  buildProductShareMessage,
  productPublicUrl,
  shareUrlFor,
  telegramShareUrl,
  whatsappShareUrl,
} from './share';
export type { ShareChannel, ShareProductInput } from './share';

export {
  RICH_DESCRIPTION_WIRE_ENABLED,
  descriptionCreateWire,
  descriptionUpdateWire,
} from './wire';
export type { DescriptionWire } from './wire';
