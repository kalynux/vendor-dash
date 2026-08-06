import { X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Removable summary of what's currently filtering the list. Sits under the
 * `SearchFilterBar` so the sheet's selections stay visible after it closes —
 * without it, a filter applied in a bottom sheet is invisible once dismissed.
 */
export function ActiveFilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: ActiveFilterChip[];
  onClearAll?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (chips.length === 0) return null;

  return (
    <div className={cn('-mx-1 flex flex-wrap items-center gap-2 px-1', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/15"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      ))}
      {chips.length > 1 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {t('common.actions.clearAll')}
        </button>
      )}
    </div>
  );
}
