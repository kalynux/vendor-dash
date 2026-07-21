import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toDateFromIso, toDateToIso } from '@/lib/orderFilters';
import { cn } from '@/lib/utils';

function fmt(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Optional order-date range filter. Unlike the analytics DateRangePicker (which
 * always holds a preset range), this defaults to "Any time" and can be cleared —
 * the Orders list has no date filter by default. Emits ISO 8601 start-of-day /
 * end-of-day bounds via `onApply`, matching the `dateFrom`/`dateTo` contract.
 */
export function OrderDateRangeFilter({
  from,
  to,
  onApply,
  className,
}: {
  from?: string;
  to?: string;
  onApply: (from?: string, to?: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  }));

  const handleOpen = (next: boolean) => {
    setOpen(next);
    // Re-sync the draft to the applied value each time the popover opens.
    if (next) setDraft({ from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
  };

  const apply = () => {
    if (!draft?.from) {
      onApply(undefined, undefined);
    } else {
      onApply(toDateFromIso(draft.from), toDateToIso(draft.to ?? draft.from));
    }
    setOpen(false);
  };

  const clear = () => {
    setDraft(undefined);
    onApply(undefined, undefined);
    setOpen(false);
  };

  const label =
    from ? (to && fmt(to) !== fmt(from) ? `${fmt(from)} – ${fmt(to)}` : fmt(from)) : 'Any time';

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start gap-2 font-normal', className)}>
          <CalendarIcon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={draft}
          onSelect={setDraft}
          autoFocus
          className="p-2"
        />
        <div className="flex justify-between gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={clear} disabled={!from && !draft?.from}>
            Clear
          </Button>
          <Button size="sm" onClick={apply} disabled={!draft?.from}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
