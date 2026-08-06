import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import {
    ALL_PHONE_COUNTRIES,
    OTHER_PHONE_COUNTRIES,
    PLATFORM_COUNTRIES,
    countryFlag,
    dialCode,
    type CountryCode,
} from '@/lib/phone';
import { useFormatters, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';

export interface PhoneCountrySelectProps {
    value: CountryCode;
    onChange: (country: CountryCode) => void;
    disabled?: boolean;
    /** Id of the field this selector belongs to, for the accessible name. */
    describedBy?: string;
}

/**
 * The country half of `<PhoneInput>`: a searchable list of every country
 * libphonenumber knows, with the platform's own markets pinned to the top.
 *
 * A `Command` inside a `Popover` rather than a `Select` — 245 countries in a
 * Radix listbox is unusable without typeahead, and searching has to match the
 * dial code ("237") as readily as the name.
 */
export function PhoneCountrySelect({
    value,
    onChange,
    disabled,
    describedBy,
}: PhoneCountrySelectProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const [open, setOpen] = useState(false);

    // Country names are locale-dependent, so the searchable index is rebuilt
    // when the dashboard language changes — not once at module load.
    const labels = useMemo(() => {
        const map = new Map<CountryCode, { name: string; dial: string; search: string }>();
        for (const code of ALL_PHONE_COUNTRIES) {
            const name = fmt.country(code);
            const dial = dialCode(code);
            // cmdk filters on this string: name, ISO code and dial code with and
            // without the `+`, so "237", "+237", "cm" and "Cameroon" all hit.
            map.set(code, { name, dial, search: `${name} ${code} ${dial} ${dial.slice(1)}` });
        }
        return map;
    }, [fmt]);

    const selected = labels.get(value);
    const selectedName = selected?.name ?? value;
    const selectedDial = selected?.dial ?? dialCode(value);

    const renderItem = (code: CountryCode) => {
        const label = labels.get(code)!;
        return (
            <CommandItem
                key={code}
                value={label.search}
                onSelect={() => {
                    onChange(code);
                    setOpen(false);
                }}
                className="gap-2"
            >
                <span aria-hidden className="w-6 shrink-0 text-base leading-none">
                    {countryFlag(code)}
                </span>
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {label.dial}
                </span>
                <Check
                    className={cn('size-4 shrink-0', code === value ? 'opacity-100' : 'opacity-0')}
                />
            </CommandItem>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-describedby={describedBy}
                    aria-label={t('common.phone.countryLabel', {
                        country: selectedName,
                        dial: selectedDial,
                    })}
                    disabled={disabled}
                    className={cn(
                        // Logical properties, so the selector still leads the field in Arabic.
                        'flex h-full shrink-0 items-center gap-1 self-stretch rounded-s-md border-e border-input',
                        'px-2.5 text-sm transition-colors outline-none',
                        'hover:bg-accent/60 focus-visible:bg-accent/60',
                        'disabled:pointer-events-none disabled:opacity-50',
                    )}
                >
                    <span aria-hidden className="text-base leading-none">
                        {countryFlag(value)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{selectedDial}</span>
                    <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
                <Command>
                    <CommandInput placeholder={t('common.phone.searchPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>{t('common.phone.noCountry')}</CommandEmpty>
                        <CommandGroup heading={t('common.phone.commonCountries')}>
                            {PLATFORM_COUNTRIES.map(renderItem)}
                        </CommandGroup>
                        <CommandGroup heading={t('common.phone.allCountries')}>
                            {OTHER_PHONE_COUNTRIES.map(renderItem)}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
