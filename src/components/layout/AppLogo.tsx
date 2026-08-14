import logoUrl from '@/assets/brand/wimall-logo.png';
import { cn } from '@/lib/utils';

/**
 * The WiMall app mark.
 *
 * One component for every surface that shows the *platform's* identity — the
 * sidebar footer, the onboarding header, the login screen. Not to be confused
 * with the vendor's own store logo, which the sidebar renders at the top and
 * which comes from the API.
 *
 * The artwork is the transparent PNG cut from `AppLogos/` (the same source the
 * mobile app icons come from), so it needs no plate behind it: the brand green
 * clears 3:1 against both the light and the dark `--card`, and the mark's white
 * inner strokes carry it in dark mode. It is `import`ed rather than referenced
 * by path so Vite fingerprints and long-caches it, and so a missing file is a
 * build error instead of a broken image in production.
 *
 * Sizing is the caller's job — pass a `size-*` class. The intrinsic dimensions
 * are declared so the row does not reflow while the image decodes.
 */
export function AppLogo({
  className,
  /**
   * Every placement but one pairs the mark with the "WiMall" wordmark beside
   * it, where a second announcement is just noise — hence the decorative
   * default. Pass a label when the mark stands alone.
   */
  alt = '',
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      aria-hidden={alt === '' || undefined}
      width={512}
      height={512}
      draggable={false}
      decoding="async"
      className={cn('shrink-0 select-none object-contain', className)}
      {...props}
    />
  );
}
