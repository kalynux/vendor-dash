import { useState } from 'react';
import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

interface StarRatingInputProps {
  /** 0 means "nothing chosen yet" — the backend only ever accepts 1–5. */
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * The 1–5 integer rating.
 *
 * 🔴 Integers only. The backend takes `rating` as an integer 1–5 — not a 1–10
 * scale and not half-stars — so this deliberately offers five discrete choices
 * rather than a slider a vendor could land between.
 *
 * Built as a radiogroup rather than five buttons so the keyboard story is the
 * platform's: arrows move between stars, and the group takes a single tab stop
 * instead of five.
 */
export function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  const { t } = useTranslation();
  // Hover preview is separate from the committed value so moving away restores
  // what was actually chosen rather than leaving the last hovered star lit.
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div
      role="radiogroup"
      aria-label={t('orders.review.ratingLabel')}
      className="flex items-center gap-1"
      onMouseLeave={() => setHovered(0)}
    >
      {STARS.map((star) => {
        const filled = star <= shown;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={t('orders.review.starsAria', { count: star })}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            className={cn(
              'rounded-md p-1 transition-transform',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !disabled && 'hover:scale-110',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            <Star
              className={cn(
                'size-7 transition-colors',
                filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
