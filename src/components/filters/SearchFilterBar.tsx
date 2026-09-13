import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * The one search-and-filter row used by every list page: a rounded search field
 * that takes all the free width, then a square filter button that opens the
 * page's `FilterSheet`. Keeping the arrangement identical everywhere means the
 * filter affordance is always in the same place on both desktop and mobile.
 */
export interface SearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Active filter dimensions — badges the button and tints it. Search isn't counted. */
  activeFilterCount?: number;
  /** Omit to render the bar without a filter button (search-only pages). */
  onOpenFilters?: () => void;
  filterLabel?: string;
  /** Controls rendered after the filter button (view toggles, page actions…). */
  trailing?: ReactNode;
  className?: string;
}

export function SearchFilterBar({
  value,
  onChange,
  placeholder,
  activeFilterCount = 0,
  onOpenFilters,
  filterLabel,
  trailing,
  className,
}: SearchFilterBarProps) {
  const { t } = useTranslation();
  const searchPlaceholder = placeholder ?? t('common.search.placeholder');
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={cn(
            'h-11 rounded-xl pl-10 shadow-none',
            // Kill the WebKit clear affordance — we render our own so it matches.
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
            value ? 'pr-10' : 'pr-3',
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('common.search.clearSearch')}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground tap-target"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {onOpenFilters && (
        <FilterTriggerButton
          onClick={onOpenFilters}
          activeCount={activeFilterCount}
          label={filterLabel ?? t('common.filters.openFilters')}
        />
      )}

      {trailing}
    </div>
  );
}

/**
 * Standalone filter button, for the few panels that filter without searching
 * (bookings). Same size and colour as the one inside `SearchFilterBar`.
 */
export function FilterTriggerButton({
  onClick,
  activeCount = 0,
  label,
  className,
}: {
  onClick: () => void;
  activeCount?: number;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? t('common.filters.openFilters')}
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        activeCount > 0
          ? 'border-primary bg-primary/10 hover:bg-primary/15'
          : 'border-primary/35 bg-background hover:bg-accent',
        className,
      )}
    >
      <SlidersHorizontal className="h-[18px] w-[18px] text-primary" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
          {activeCount}
        </span>
      )}
    </button>
  );
}
