import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

export interface PickerOption {
  value: string;
  label: string;
  /** Optional muted second line. */
  description?: string;
  /** Extra terms to match against (not displayed). */
  keywords?: string[];
}

export interface PickerGroup {
  label?: string;
  options: PickerOption[];
}

interface SearchSelectFieldProps {
  groups: PickerGroup[];
  value: string;
  onChange: (value: string) => void;
  modalTitle: string;
  modalDescription?: string;
  /** Trigger text when nothing is selected. */
  placeholder: string;
  searchPlaceholder?: string;
  invalid?: boolean;
}

/**
 * A single-select field whose options open in a searchable modal (centered popup on
 * desktop, bottom sheet on mobile). The chosen option is highlighted with a leading
 * tick in the list. Used for ticket type and "related to".
 */
export function SearchSelectField({
  groups, value, onChange, modalTitle, modalDescription, placeholder, searchPlaceholder, invalid,
}: SearchSelectFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const found = g.options.find((o) => o.value === value);
      if (found) return found.label;
    }
    return null;
  }, [groups, value]);

  function handleSelect(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-invalid={invalid}
        onClick={() => setOpen(true)}
        className={cn('w-full justify-between font-normal', !selectedLabel && 'text-muted-foreground')}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={modalTitle}
        description={modalDescription}
        desktopClassName="sm:max-w-md"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder={searchPlaceholder ?? 'Search…'} />
          <CommandList className="max-h-[55vh]">
            <CommandEmpty>{t('tickets.detail.noMatches')}</CommandEmpty>
            {groups.map((group, i) => (
              <CommandGroup key={group.label ?? i} heading={group.label}>
                {group.options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label, ...(option.keywords ?? [])]}
                      onSelect={() => handleSelect(option.value)}
                      className={cn('gap-2', isSelected && 'bg-accent text-accent-foreground')}
                    >
                      <Check className={cn('h-4 w-4 shrink-0 text-primary', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </ResponsiveModal>
    </>
  );
}
