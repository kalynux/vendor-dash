import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { contrastColor } from '@/components/customers/customer.constants';
import type { CustomerFlag } from '@/types/customers.types';

interface FlagBadgeProps {
  flag: Pick<CustomerFlag, 'name' | 'color'>;
  /** When set, renders a remove (×) button calling this handler. */
  onRemove?: () => void;
  className?: string;
}

/** Colour-coded customer flag pill, tinted with the flag's own hex colour. */
export function FlagBadge({ flag, onRemove, className }: FlagBadgeProps) {
  const { t } = useTranslation();
  const fg = contrastColor(flag.color);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: flag.color, color: fg }}
    >
      <span className="truncate">{flag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-80 transition hover:opacity-100 tap-target"
          style={{ color: fg }}
          aria-label={t('customers.flags.removeFlag', { name: flag.name })}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/** A small swatch dot of a flag colour. */
export function FlagDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  );
}
