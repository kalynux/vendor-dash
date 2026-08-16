import { useIsMobile } from '@/hooks/use-mobile';
import type { PreviewDevice } from './StorefrontFrame';

/**
 * Which frame to open on.
 *
 * A vendor on a phone is shown the mobile layout, because that is both the only
 * one that fits and — on a WhatsApp-first marketplace — the one most of their
 * customers will see. On a larger screen the desktop frame opens, so the preview
 * starts at full width rather than inside a bezel the vendor did not ask for.
 *
 * Read once as the initial value, not bound: re-deriving it on resize would
 * silently overwrite a choice the vendor made from the toggle.
 */
export function useDefaultPreviewDevice(): PreviewDevice {
  return useIsMobile() ? 'mobile' : 'desktop';
}
