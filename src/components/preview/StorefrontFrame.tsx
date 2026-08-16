import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

/**
 * The customer storefront, embedded.
 *
 * ── Why an iframe rather than a rebuilt copy ─────────────────────────────────
 *
 * The preview's whole value is being *the same page a customer gets*. Porting
 * the storefront's components into this app would make it a copy that starts
 * drifting the day the storefront team touches anything — a restyle, a new
 * breakpoint, a translation — and the drift would be invisible from here. An
 * iframe has none of that maintenance, and it is more accurate in one way a copy
 * could never be: an iframe **is** a viewport, so the storefront's own media
 * queries fire against the frame width. Switching to "Mobile" therefore produces
 * the real mobile layout rather than an approximation of it.
 *
 * ── What we deliberately do not do ───────────────────────────────────────────
 *
 * No `sandbox`. The storefront is first-party and reads `localStorage` for the
 * cart, saved items and theme; sandboxing without `allow-same-origin` breaks it
 * outright, and sandboxing *with* `allow-same-origin` and `allow-scripts` buys
 * essentially nothing against our own origin.
 *
 * No content inspection. The frame is cross-origin, so `contentDocument` is
 * unreadable and `onLoad` fires for an error page exactly as it does for a real
 * one. It means "finished", never "succeeded" — so nothing here infers success
 * from it. Callers that know a page cannot exist (an unpublished product) must
 * not render this at all; see `ProductPreview`.
 */

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

/**
 * Frame widths, in CSS pixels.
 *
 * `mobile` is a 390pt phone and `tablet` a portrait tablet — both chosen to sit
 * on the far side of the storefront's own breakpoints (640 / 1024 / 1280) rather
 * than near them, so each option shows a distinctly different layout. `desktop`
 * is unconstrained: the storefront caps its own content at 1200px.
 */
export const DEVICE_WIDTHS: Record<PreviewDevice, number | null> = {
  mobile: 390,
  tablet: 820,
  desktop: null,
};

interface StorefrontFrameProps {
  src: string;
  device: PreviewDevice;
  /** Bump to force a reload of the same URL. */
  reloadToken?: number;
  className?: string;
}

export function StorefrontFrame({ src, device, reloadToken = 0, className }: StorefrontFrameProps) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const frameKey = `${src}::${device}::${reloadToken}`;

  // Remounting via `key` gives a fresh iframe, but this component's own state
  // survives — so the spinner has to be re-armed by hand or the second load
  // renders behind a frame that is still marked loaded.
  const armedFor = useRef(frameKey);
  if (armedFor.current !== frameKey) {
    armedFor.current = frameKey;
    if (loaded) setLoaded(false);
  }

  // A frame that never fires `onLoad` — the storefront is down, or the origin is
  // misconfigured — would otherwise spin forever with nothing to read. Give up
  // on the spinner and show the frame; whatever the browser rendered (an error
  // page, a blank) is more informative than an indefinite loader.
  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setLoaded(true), 15000);
    return () => window.clearTimeout(timer);
  }, [loaded, frameKey]);

  const width = DEVICE_WIDTHS[device];
  const framed = width !== null;

  return (
    <div
      className={cn(
        'relative flex h-full w-full justify-center overflow-auto bg-muted/40',
        framed && 'p-3 sm:p-6',
        className,
      )}
    >
      <div
        className={cn(
          'relative h-full bg-background',
          framed
            ? 'w-full overflow-hidden rounded-2xl border shadow-lg'
            : 'w-full',
        )}
        // A max-width rather than a width: on a phone, a 390px frame inside a
        // ~360px viewport would overflow and force the page to scroll sideways.
        style={framed ? { maxWidth: width } : undefined}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('common.preview.loading')}</p>
          </div>
        )}
        <iframe
          key={frameKey}
          src={src}
          title={t('common.preview.frameTitle')}
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
