import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Filter shell shared by every list page: a bottom sheet on mobile, a right-side
 * panel on desktop — the same responsive shape the ticket sheets use.
 *
 * Layout is fixed on purpose so filters feel identical everywhere: pinned title
 * row, scrolling body of `FilterSection`s, and a pinned action bar ("Clear all"
 * + apply). Filters apply live as they're tapped — the apply button only
 * dismisses — so the sheet never holds a draft the user can lose.
 */
export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Drives the "Clear all" enabled state and the count next to the title. */
  activeCount?: number;
  onClear?: () => void;
  /** Primary button label — pass a result count when the page knows it. */
  applyLabel?: string;
  children: ReactNode;
  className?: string;
}

export function FilterSheet({
  open,
  onOpenChange,
  title,
  description,
  activeCount = 0,
  onClear,
  applyLabel,
  children,
  className,
}: FilterSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'gap-0 p-0',
          isMobile ? 'max-h-[85dvh] rounded-t-2xl' : 'w-full sm:max-w-md',
          // Grow the sheet's built-in close button into a real touch target.
          '[&>button]:top-4 [&>button]:right-3 [&>button]:flex [&>button]:size-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:hover:bg-muted',
          className,
        )}
      >
        {/* Grab handle — signals the sheet is dismissable by swipe/tap-away.
            Meaningless on a side panel, so mobile only. */}
        {isMobile && (
          <div className="flex shrink-0 justify-center pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          </div>
        )}

        {/* Borders run full-bleed; the content inside them is capped at `max-w-3xl`
            so the sheet stays readable on a wide desktop viewport. */}
        <div className="shrink-0 border-b">
          <SheetHeader
            className={cn(
              'mx-auto w-full max-w-3xl gap-1 px-4 pb-3 pr-14',
              isMobile ? 'pt-2' : 'pt-4',
            )}
          >
            <SheetTitle className="flex items-center gap-2 text-base">
              {title ?? t('common.actions.filters')}
              {activeCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </SheetTitle>
            {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
          </SheetHeader>
        </div>

        <SheetBody>
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-5">{children}</div>
        </SheetBody>

        <div className="shrink-0 border-t pb-[env(safe-area-inset-bottom)]">
          <SheetFooter className="mx-auto mt-0 w-full max-w-3xl flex-row gap-3 p-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={onClear}
              disabled={!onClear || activeCount === 0}
            >
              {t('common.actions.clearAll')}
            </Button>
            <Button type="button" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
              {applyLabel ?? t('common.filters.showResults')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One labelled group of controls inside a `FilterSheet`. */
export function FilterSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  /** Optional right-aligned affordance (e.g. a per-section reset). */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        {hint}
      </div>
      {children}
    </section>
  );
}

/**
 * Either form of label is accepted: `labelKey` for the fixed enum options that
 * live in a constants module (no React context there to translate with), and
 * `label` for the ones built at runtime from data — an agency name, a flag the
 * vendor typed. `labelKey` wins when both are given.
 */
export interface FilterOption<T extends string> {
  value: T;
  label?: string;
  labelKey?: TranslationKey;
  /** Optional leading adornment (colour dot, glyph) rendered inside the chip. */
  icon?: ReactNode;
}

/** Optional grouping for long option lists (e.g. ticket types). */
export interface FilterOptionGroup<T extends string> {
  label?: string;
  labelKey?: TranslationKey;
  options: FilterOption<T>[];
}

function Chip({
  label,
  icon,
  selected,
  onClick,
  showCheck,
}: {
  label: string;
  icon?: ReactNode;
  selected: boolean;
  onClick: () => void;
  showCheck?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'tap-target inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected
          ? 'border-primary bg-primary text-primary-foreground font-medium'
          : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {showCheck && selected ? <Check className="h-3.5 w-3.5" /> : icon}
      {label}
    </button>
  );
}

/**
 * Single-select chip group. A leading "any" chip clears the dimension, so every
 * filter can be undone without hunting for a reset.
 */
export function FilterChips<T extends string>({
  options,
  groups,
  value,
  onChange,
  allLabel,
  hideAll = false,
}: {
  options?: FilterOption<T>[];
  groups?: FilterOptionGroup<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  allLabel?: string;
  hideAll?: boolean;
}) {
  const { t } = useTranslation();
  const labelOf = (o: { label?: string; labelKey?: TranslationKey }) =>
    o.labelKey ? t(o.labelKey) : o.label ?? '';

  const allChip = !hideAll && (
    <Chip
      label={allLabel ?? t('common.labels.all')}
      selected={!value}
      onClick={() => onChange(undefined)}
    />
  );

  if (groups) {
    return (
      <div className="space-y-3">
        {!hideAll && <div className="flex flex-wrap gap-2">{allChip}</div>}
        {groups.map((group) => (
          <div key={group.labelKey ?? group.label} className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground/80">{labelOf(group)}</p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((o) => (
                <Chip
                  key={o.value}
                  label={labelOf(o)}
                  icon={o.icon}
                  selected={value === o.value}
                  onClick={() => onChange(value === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allChip}
      {(options ?? []).map((o) => (
        <Chip
          key={o.value}
          label={labelOf(o)}
          icon={o.icon}
          selected={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
        />
      ))}
    </div>
  );
}

/** Multi-select chip group — selected chips carry a check so the mode reads clearly. */
export function FilterMultiChips<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: FilterOption<T>[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.labelKey ? t(o.labelKey) : o.label ?? ''}
          icon={o.icon}
          selected={values.includes(o.value)}
          onClick={() => onToggle(o.value)}
          showCheck
        />
      ))}
    </div>
  );
}

/** Full-width row wrapper for controls that aren't chips (selects, inputs, dates). */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
