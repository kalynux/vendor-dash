/**
 * Length budgets for a description that has to survive a chat message.
 *
 * The hard numbers mirror the backend's `WA_LIMITS`
 * (`src/modules/whatsapp/constants/whatsapp-limits.ts`) and Telegram's Bot API
 * `sendMessage` cap, which are the same 4096. The soft numbers are editorial:
 * nothing rejects a long description, but a wall of text is the single most
 * common way a good product reads badly in a chat bubble.
 */

export const CHAT_LIMITS = {
  /** WhatsApp `text.body` and Telegram `sendMessage.text` both cap here. */
  MAX: 4096,
  /**
   * Reserved for the title, price and product URL the share composer wraps
   * around the description. A description that fits this budget can always be
   * sent whole; one that does not gets truncated in the message, not in storage.
   */
  SHARE_CHROME_RESERVE: 320,
  /** Soft ceiling: past here the editor warns that the message will be trimmed. */
  WARN: 2000,
  /** The length a description reads well at in a bubble. Advisory only. */
  IDEAL: 900,
  /**
   * WhatsApp interactive/caption bodies cap at 1024. A description under this
   * can also ride along as an image caption, which is how most product shares
   * actually go out.
   */
  CAPTION: 1024,
  /** Past this many list items a bullet list stops scanning as a list. */
  MAX_LIST_ITEMS: 12,
} as const;

/** The description budget once the share chrome is accounted for. */
export const DESCRIPTION_BUDGET = CHAT_LIMITS.MAX - CHAT_LIMITS.SHARE_CHROME_RESERVE;

/**
 * Hard-cap a string, appending an ellipsis only when it fits.
 *
 * Deliberately identical in behaviour to the backend `truncate()` in
 * `whatsapp-limits.ts`, so a message clamped on either side of the wire comes
 * out the same length with the same marker.
 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, max);
  return `${value.slice(0, max - 1)}…`;
}
