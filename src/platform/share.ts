/**
 * The system share sheet (CAPACITOR-PLAN.md → P4.5).
 *
 * `ShareProductDialog` already reads `navigator.share` once at mount and hides
 * its "Share" row when it is absent — so on a device that detection simply
 * starts being true. What this module changes is *which* sheet opens: a WebView's
 * `navigator.share` is a partial implementation with a shorter target list, and
 * `@capacitor/share` reaches the real `Intent.ACTION_SEND` /
 * `UIActivityViewController` instead.
 *
 * On the web the path is the same `navigator.share` it always was, so the
 * browser build is untouched (ground rule 3) and its copy-link fallback is
 * unchanged.
 */
import { Share } from '@capacitor/share';
import { isNative } from './env';

/** Whether a share sheet exists at all. Read once — this is a static capability. */
export const shareAvailable: boolean =
  isNative || (typeof navigator !== 'undefined' && !!navigator.share);

export type ShareOutcome =
  /** The sheet opened and the vendor picked a target. */
  | 'shared'
  /** The sheet opened and was dismissed. A choice, not a failure — say nothing. */
  | 'cancelled'
  | 'failed';

export interface SharePayload {
  title?: string;
  text?: string;
  /**
   * ⚠ The link rides here rather than inside `text`, because this is the field
   * receiving apps unfurl into a preview card — a URL buried in the body arrives
   * as bare characters.
   */
  url?: string;
  /** Android only: the chooser's own heading. */
  dialogTitle?: string;
  /**
   * `file://` URIs to attach. **Native only** — the Web Share API takes `File`
   * objects rather than paths, and nothing in this app needs that, so the web
   * branch below ignores this field rather than pretending to support it.
   *
   * Used by `platform/filesystem.ts` to hand a staged download to the OS, which
   * is how "Save to Files" and every send-to-an-app target are reached.
   */
  files?: string[];
}

/**
 * True when an error means "the vendor dismissed the sheet".
 *
 * The two platforms spell it differently: the Web Share API throws a DOMException
 * named `AbortError`, while the plugin rejects with a message. Neither deserves
 * an error toast — dismissing a share sheet is a decision.
 */
function isDismissal(err: unknown): boolean {
  if ((err as DOMException | undefined)?.name === 'AbortError') return true;
  const message = (err as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && /cancel|abort|dismiss/i.test(message);
}

/**
 * Open the system share sheet. Never throws — the outcome is the answer, because
 * a dismissal and a failure need different things said about them.
 */
export async function shareContent(payload: SharePayload): Promise<ShareOutcome> {
  try {
    if (isNative) {
      await Share.share(payload);
      return 'shared';
    }
    if (typeof navigator === 'undefined' || !navigator.share) return 'failed';
    await navigator.share({
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.text ? { text: payload.text } : {}),
      ...(payload.url ? { url: payload.url } : {}),
    });
    return 'shared';
  } catch (err) {
    if (isDismissal(err)) return 'cancelled';
    console.warn('[share] could not open the share sheet', err);
    return 'failed';
  }
}
