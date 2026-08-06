import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DATE_RANGE_PRESETS, DATE_RANGE_PRESET_KEYS, presetRange } from '@/services/analytics.service';
import type { DateRange } from '@/types';
import { useFormatters, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [open, setOpen] = useState(false);

  const formatRange = (from: Date, to: Date): string =>
    from.toDateString() === to.toDateString()
      ? fmt.date(from, 'dayMonth')
      : `${fmt.date(from, 'dayMonth')} – ${fmt.date(to, 'dayMonth')}`;
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>({ from: value.from, to: value.to });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setShowCustom(value.label === 'Custom');
      setDraft({ from: value.from, to: value.to });
    }
  };

  const applyPreset = (label: string) => {
    const r = presetRange(label);
    if (r) {
      onChange(r);
      setOpen(false);
    }
  };

  const applyCustom = () => {
    if (!draft?.from) return;
    onChange({ from: draft.from, to: draft.to ?? draft.from, label: 'Custom' });
    setOpen(false);
  };

  const triggerLabel =
    value.label === 'Custom'
      ? formatRange(value.from, value.to)
      : t(DATE_RANGE_PRESET_KEYS[value.label] ?? 'common.time.custom');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[150px] justify-between font-normal">
          <span className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            {triggerLabel}
          </span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col p-2 gap-0.5 border-r min-w-[150px]">
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition-colors',
                  value.label === preset && !showCustom && 'bg-muted font-medium'
                )}
              >
                {t(DATE_RANGE_PRESET_KEYS[preset])}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className={cn(
                'text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition-colors',
                (showCustom || value.label === 'Custom') && 'bg-muted font-medium'
              )}
            >
              {t('common.time.custom')}
            </button>
          </div>

          {showCustom && (
            <div className="flex flex-col">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={draft}
                onSelect={setDraft}
                autoFocus
                className="p-2"
              />
              <div className="flex justify-end gap-2 border-t p-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  {t('common.actions.cancel')}
                </Button>
                <Button size="sm" onClick={applyCustom} disabled={!draft?.from}>
                  {t('common.actions.apply')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
