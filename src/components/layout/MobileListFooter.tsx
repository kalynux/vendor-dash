import { cn } from '@/lib/utils';

interface MobileListFooterProps {
  /** Number of items currently loaded/visible. */
  shown: number;
  /** Total number of items available. */
  total: number;
  /** Plural noun for the items, e.g. "orders", "products", "files". */
  noun: string;
  className?: string;
}

/**
 * Sticky mobile footer that reports list progress, e.g.
 * "Showing 1–20 of 247 orders". Sits just above the MobileTabBar (h-16).
 */
export function MobileListFooter({
  shown,
  total,
  noun,
  className,
}: MobileListFooterProps) {
  if (total <= 0) return null;
  const upper = Math.min(shown, total);
  return (
    <div
      className={cn(
        'fixed bottom-16 left-0 right-0 z-40 border-t bg-background/90 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur-sm',
        className,
      )}
    >
      Showing 1–{upper} of {total} {noun}
    </div>
  );
}
