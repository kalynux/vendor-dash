import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFormatters, useTranslation } from '@/i18n';
import { PaymentBrandLogo } from './PaymentBrandLogo';
import {
    MOBILE_MONEY_BRANDS,
    mobileMoneyBrandById,
    type MobileMoneyBrand,
    type MobileMoneyBrandId,
} from './paymentBrands';

export interface MobileMoneyBrandSelectProps {
    /**
     * Required: the trigger borrows this id to name itself, so a label above it
     * can be pointed at the control with `aria-labelledby` without swallowing
     * the selected wallet from the accessible name.
     */
    id: string;
    /** Selected brand id, or `null` while nothing is chosen. */
    value: MobileMoneyBrandId | null;
    onChange: (id: MobileMoneyBrandId) => void;
    /**
     * Restrict selection to wallets a gateway can debit. The rest still list
     * — greyed, with a note — because hiding them reads as "we don't support
     * your wallet", which is the wrong message: they work for payouts today.
     */
    chargeableOnly?: boolean;
    disabled?: boolean;
    /** Draws the error outline and flags the control for assistive tech. */
    invalid?: boolean;
    /** Id of the element labelling this control (usually the field's label). */
    'aria-labelledby'?: string;
    className?: string;
}

/**
 * The wallet picker in dropdown form: one line showing the chosen mark and name,
 * opening a list of logo + name rows.
 *
 * The list is a popover anchored to the trigger on desktop and a bottom sheet on
 * a phone, where an anchored menu would sit under the thumb and clip against the
 * keyboard. `MobileMoneyBrandPicker` is the same catalog laid out as a grid of
 * tiles — use that where the wallet choice is the whole point of the screen, and
 * this where it is one field among several.
 */
export function MobileMoneyBrandSelect({
    id,
    value,
    onChange,
    chargeableOnly = false,
    disabled = false,
    invalid = false,
    className,
    'aria-labelledby': ariaLabelledBy,
}: MobileMoneyBrandSelectProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);

    const selected = mobileMoneyBrandById(value);
    const isUnavailable = (brand: MobileMoneyBrand) =>
        chargeableOnly && brand.chargeOperator === null;
    const unavailable = MOBILE_MONEY_BRANDS.filter(isUnavailable);

    const listId = `${id}-listbox`;

    const triggerProps = {
        id,
        type: 'button' as const,
        disabled,
        role: 'combobox',
        // Overrides the `dialog` Radix's PopoverTrigger would otherwise assert.
        'aria-haspopup': 'listbox' as const,
        'aria-expanded': open,
        'aria-controls': listId,
        'aria-invalid': invalid || undefined,
        // Both the field label and the trigger's own text, so the control is
        // announced as "Provider, MTN Mobile Money" rather than one or the other.
        'aria-labelledby': ariaLabelledBy ? `${ariaLabelledBy} ${id}` : undefined,
        className: cn(
            'flex h-11 w-full items-center gap-2.5 rounded-md border bg-transparent px-3 text-left text-sm',
            'border-input shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'dark:bg-input/30 dark:hover:bg-input/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40',
            className,
        ),
    };

    const triggerBody = (
        <>
            {selected ? (
                <>
                    <PaymentBrandLogo brand={selected} size="sm" decorative />
                    <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
                </>
            ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {t('payments.providers.placeholder')}
                </span>
            )}
            <ChevronDown
                aria-hidden
                className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    open && 'rotate-180',
                )}
            />
        </>
    );

    const options = (
        <div id={listId} role="listbox" aria-labelledby={ariaLabelledBy} className="space-y-0.5">
            {MOBILE_MONEY_BRANDS.map((brand) => {
                const blocked = isUnavailable(brand);
                const active = brand.id === value;
                return (
                    <button
                        key={brand.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={blocked}
                        title={
                            blocked ? t('payments.providers.soonHint', { brand: brand.name }) : undefined
                        }
                        onClick={() => {
                            onChange(brand.id);
                            setOpen(false);
                        }}
                        className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-2.5 text-left transition-colors',
                            // Comfortably above the 44px touch target in the sheet;
                            // tighter in the popover, where it is pointer-driven.
                            isMobile ? 'min-h-14 py-2.5' : 'min-h-11 py-2',
                            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'enabled:hover:bg-accent enabled:focus-visible:bg-accent',
                            active && 'bg-primary/5',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                    >
                        <PaymentBrandLogo brand={brand} size="sm" decorative />
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate text-sm',
                                active ? 'font-semibold text-primary' : 'font-medium text-foreground',
                            )}
                        >
                            {brand.name}
                        </span>
                        {blocked && (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('payments.providers.soon')}
                            </span>
                        )}
                        {active && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
                    </button>
                );
            })}

            {unavailable.length > 0 && (
                <p className="px-2.5 pt-2 text-xs text-muted-foreground">
                    {t('payments.providers.soonNote', {
                        brands: fmt.list(unavailable.map((b) => b.name)),
                    })}
                </p>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <>
                <button {...triggerProps} onClick={() => setOpen(true)}>
                    {triggerBody}
                </button>

                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent
                        side="bottom"
                        // The title names the sheet; Radix only warns when neither a
                        // description nor this opt-out is present.
                        aria-describedby={undefined}
                        className="max-h-[80dvh] gap-0 rounded-t-2xl p-0"
                    >
                        {/* Grab handle — signals the sheet is dismissable by swipe/tap-away. */}
                        <div className="flex shrink-0 justify-center pt-2.5">
                            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
                        </div>
                        <SheetHeader className="shrink-0 border-b pb-3 pr-14 pt-2">
                            <SheetTitle className="text-base">
                                {t('payments.providers.legend')}
                            </SheetTitle>
                        </SheetHeader>
                        <SheetBody className="px-2 py-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                            {options}
                        </SheetBody>
                    </SheetContent>
                </Sheet>
            </>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger {...triggerProps}>{triggerBody}</PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                // Matches the trigger so the list reads as an extension of the
                // field rather than a floating menu.
                className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1.5"
            >
                {options}
            </PopoverContent>
        </Popover>
    );
}
