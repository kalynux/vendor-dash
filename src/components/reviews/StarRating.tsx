import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * A rating, read-only.
 *
 * The display half of `StarRatingInput`, and deliberately a separate component
 * rather than a `disabled` prop on that one: a disabled radiogroup still carries
 * a tab stop and announces itself as a control the reader cannot operate, which
 * is the wrong story for a row in a list of things already submitted. This is
 * one `img`-role node with a text label, so a screen reader reads "4 out of 5
 * stars" and moves on.
 *
 * Ratings here are always integers 1–5 — the backend accepts nothing else, so
 * there is no half-star case to handle.
 */
export function StarRating({
  value,
  className,
  size = 'md',
}: {
  value: number;
  className?: string;
  /** `sm` for a dense table row, `md` for a card. */
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const star = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <span
      role="img"
      aria-label={t('orders.review.starsAria', { count: value })}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {STARS.map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            star,
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}
