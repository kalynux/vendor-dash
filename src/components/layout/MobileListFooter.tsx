import { useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

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
 * "Showing 1–20 of 247 orders". Sits just above the MobileTabBar (h-16).
 */
export function MobileListFooter({
  shown,
  total,
  nounKey,
  className,
}: MobileListFooterProps) {
  const { t } = useTranslation();
  if (total <= 0) return null;
  const upper = Math.min(shown, total);
  return (
    <div
      className={cn(
        'fixed bottom-16 left-0 right-0 z-40 border-t bg-background/90 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur-sm',
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
