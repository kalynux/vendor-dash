import { useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import { useKeyboardOpen } from '@/platform/shell/keyboard';

interface MobileListFooterProps {
  /** Number of items currently loaded/visible. */
  shown: number;
  /** Total number of items available. */
  total: number;
  /**
   * Plural unit key for the items, e.g. `common.units.orders`. Interpolated as a
   * whole phrase ("247 orders") rather than a bare noun, so the count and the
   * noun stay grammatically agreed in every language.
   */
  nounKey: TranslationKey;
  className?: string;
}

/**
 * Sticky mobile footer that reports list progress, e.g.
 * "Showing 1–20 of 247 orders". Sits just above the
 * MobileTabBar, whose height is `h-16` PLUS `pb-safe` — so the offset has to
 * carry that same bottom inset, or on any device with a non-zero one the
 * footer's lower edge sits behind the bar.
 *
 * While the on-screen keyboard is up the tab bar hides itself
 * (CAPACITOR-PLAN.md → P3.2), so that allowance would leave this stranded
 * above the keys with nothing underneath it. It drops to the bottom of the
 * resized viewport instead — which is where the vendor wants it anyway, since
 * the surface that raises a keyboard on these pages is the search field and this
 * is the readout of how many results it left. `useKeyboardOpen()` is hardwired
 * to false on the web, so the browser build is unchanged.
 */
export function MobileListFooter({
  shown,
  total,
  nounKey,
  className,
}: MobileListFooterProps) {
  const { t } = useTranslation();
  const keyboardOpen = useKeyboardOpen();
  if (total <= 0) return null;
  const upper = Math.min(shown, total);
  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 border-t bg-background/90 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur-sm',
        keyboardOpen ? 'bottom-0' : 'bottom-[calc(4rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {t('common.pagination.showingRange', {
        from: 1,
        to: upper,
        items: t(nounKey, { count: total }),
      })}
    </div>
  );
}
