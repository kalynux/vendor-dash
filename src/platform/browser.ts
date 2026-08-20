/**
 * Outbound links (CAPACITOR-PLAN.md → P3.5).
 *
 * A Capacitor shell is a single WebView with no chrome: no address bar, no tab
 * strip, no back gesture out of a page it navigated to. Let an `<a>` to
 * `https://wa.me/…` navigate that WebView and the app is *gone* — replaced by a
 * web page the user has no way to leave except by force-quitting. `target
 * ="_blank"` does not save it either; a WebView has nowhere to put a second
 * window, so those links tend to do nothing at all.
 *
 * `@capacitor/browser` opens a Chrome Custom Tab (Android) /
 * `SFSafariViewController` (iOS) instead: a real browser, over the app, with its
 * own close button, and the app still running underneath.
 *
 * Two entry points, because outbound links arrive two ways:
 *
 *  - {@link openExternal} for code that opens a URL itself — `ShareProductDialog`
 *    handing a message to WhatsApp or Telegram.
 *  - {@link installExternalLinkInterceptor} for markup, which is most of them in
 *    this app: the storefront links in `StorefrontSettings` and
 *    `PreviewLinkActions`, the ticket attachments in `AttachmentsPanel`, the
 *    storefront `/login` link on the web sign-in card, the help links in
 *    `PoliciesFields`, `Header`, `Overview` and `ChannelSetupDialog`. A
 *    document-level interceptor covers all of them, including any added later,
 *    without a component-by-component sweep that would need repeating.
 *
 * ⚠ **`window.open` is deliberately not monkey-patched.** Callers that
 * dereference the returned `Window` — Stripe's hosted script among them — get
 * `null` from a patch that cannot return one.
 *
 * On web both entry points fall through to today's behaviour, so the browser
 * build is untouched (ground rule 3).
 */
import { Browser } from '@capacitor/browser';

import { isNative } from './env';

/**
 * Open a URL outside the app.
 *
 * Native gets an in-app browser; the web build gets the `window.open` it always
 * had. Never throws — a link that cannot be opened is not worth taking a screen
 * down for.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    await Browser.open({ url });
  } catch (err) {
    console.warn('[shell] could not open an external URL', url, err);
  }
}

/**
 * Dismiss the in-app browser, if one is open.
 *
 * Used by `shell/deepLinks.ts` when a redirect out of that browser lands back in
 * the app: the tab is still on screen behind us otherwise, and pressing back
 * would return to a consent screen that has already been consented to. A no-op
 * on the web and when nothing is open, and it never throws — failing to close a
 * browser is not worth taking a screen down for.
 */
export async function closeExternal(): Promise<void> {
  if (!isNative) return;
  try {
    await Browser.close();
  } catch {
    // Nothing to close, or a platform that will not. Either way the app is
    // already in the foreground, which is the outcome that mattered.
  }
}

/**
 * Whether a resolved URL points somewhere the WebView must not navigate to.
 *
 * ⚠ Compared on **protocol + host, never `origin`**. Under iOS the document's
 * scheme is `capacitor:`, which `URL` does not treat as a special scheme, so
 * `new URL('/dashboard', location.href).origin` is the string `"null"` — and an
 * origin comparison would classify every in-app route as external and hand the
 * whole app to Safari.
 *
 * ⚠ Non-http schemes (`mailto:`, `tel:`, `whatsapp:`, `intent:`) are
 * deliberately left alone: Capacitor's own `WebViewClient` already hands those
 * to the system, which is the correct destination, and `Browser.open` cannot
 * load any of them.
 */
function isExternal(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.host !== window.location.host || url.protocol !== window.location.protocol;
}

function onDocumentClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = (event.target as Element | null)?.closest?.('a');
  const href = anchor?.getAttribute('href');
  if (!anchor || !href) return;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    // Not a URL we can reason about (`#anchor` handling lives in the router).
    return;
  }
  if (!isExternal(url)) return;

  event.preventDefault();
  void openExternal(url.href);
}

let interceptorInstalled = false;

/**
 * Route every external `<a>` through the in-app browser. Native only.
 *
 * Registered in the **capture** phase so it runs before any component's own
 * `onClick`, and bails on `defaultPrevented` so a handler that already dealt
 * with the click (a router link, a menu item) keeps precedence.
 *
 * ⚠ This is also what covers `AttachmentsPanel`'s `<a download>`, since
 * `download` is inert in a Capacitor WebView — the attachment opens in the
 * system browser for viewing rather than silently doing nothing. Saving it to
 * the device would need the filesystem plugin, and the attachment URL is
 * cookie-authenticated (`crossOrigin="use-credentials"`), which the bearer
 * transport has no cookie for. Both are Phase 4 problems; this at least turns a
 * dead button into a visible one.
 *
 * Returns an uninstall function; the app never calls it, but a test can.
 */
export function installExternalLinkInterceptor(): () => void {
  if (!isNative || interceptorInstalled) return () => {};
  interceptorInstalled = true;

  document.addEventListener('click', onDocumentClick, { capture: true });
  return () => {
    document.removeEventListener('click', onDocumentClick, { capture: true });
    interceptorInstalled = false;
  };
}
