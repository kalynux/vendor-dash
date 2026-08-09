import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatters, useTranslation } from '@/i18n';
import { PaymentBrandLogo } from './PaymentBrandLogo';
import { MOBILE_MONEY_BRANDS, type MobileMoneyBrand, type MobileMoneyBrandId } from './paymentBrands';

export interface MobileMoneyBrandPickerProps {
    /** Selected brand id, or `null` while nothing is chosen. */
    value: MobileMoneyBrandId | null;
    onChange: (id: MobileMoneyBrandId) => void;
    /**
     * Restrict selection to wallets a gateway can debit. The rest still render
     * — greyed, with a note — because hiding them reads as "we don't support
     * your wallet", which is the wrong message: they work for payouts today.
     */
    chargeableOnly?: boolean;
    disabled?: boolean;
    /** Draws the error outline and flags the group for assistive tech. */
    invalid?: boolean;
    /** Id of the element labelling this group (usually the field's label). */
    'aria-labelledby'?: string;
    'aria-label'?: string;
    className?: string;
}

/**
 * The wallet picker: one logo tile per provider, in place of a text dropdown.
 *
 * Vendors recognise the mark long before they read the name, and a 5-item
 * dropdown on a phone costs a sheet, a scroll, and a tap. Radix's RadioGroup
 * supplies the radio semantics and arrow-key roving focus; the grid is a
 * presentational detail on top of it.
 */
export function MobileMoneyBrandPicker({
    value,
    onChange,
    chargeableOnly = false,
    disabled = false,
    invalid = false,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
}: MobileMoneyBrandPickerProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();

    const isUnavailable = (brand: MobileMoneyBrand) =>
        chargeableOnly && brand.chargeOperator === null;
    const unavailable = MOBILE_MONEY_BRANDS.filter(isUnavailable);

    return (
        <div className={className}>
            <RadioGroupPrimitive.Root
                value={value ?? ''}
                onValueChange={(next) => onChange(next as MobileMoneyBrandId)}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                aria-labelledby={ariaLabelledBy}
                // Never unlabelled: a grid of logos with no group name is opaque
                // to a screen reader, so fall back to a generic one.
                aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? t('payments.providers.legend'))}
                // Three per row keeps every tile above the 44px touch target on a
                // 320px screen while still fitting the full brand name; five
                // abreast from `sm`, where the whole set reads as one row.
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
                {MOBILE_MONEY_BRANDS.map((brand) => {
                    const blocked = isUnavailable(brand);
                    return (
                        <RadioGroupPrimitive.Item
                            key={brand.id}
                            value={brand.id}
                            disabled={blocked}
                            title={blocked ? t('payments.providers.soonHint', { brand: brand.name }) : brand.name}
                            className={cn(
                                'group relative flex min-h-[5.5rem] flex-col items-center justify-start gap-1.5 rounded-xl border-2 px-1.5 py-2.5',
                                'transition-[border-color,background-color,box-shadow,transform] duration-200',
                                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                'border-border bg-card',
                                'enabled:hover:border-primary/50 enabled:hover:bg-accent/40',
                                'data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:shadow-sm',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                                'motion-safe:enabled:active:scale-[0.97]',
                                invalid && 'border-destructive/60',
                            )}
                        >
                            {/* Decorative: the tile's own text already names the brand. */}
                            <PaymentBrandLogo brand={brand} size="md" decorative />
                            <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-muted-foreground group-data-[state=checked]:text-primary">
                                {brand.name}
                            </span>

                            {blocked && (
                                <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t('payments.providers.soon')}
                                </span>
                            )}

                            <span
                                aria-hidden
                                className={cn(
                                    'absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary',
                                    'scale-50 opacity-0 transition-[opacity,transform] duration-200',
                                    'group-data-[state=checked]:scale-100 group-data-[state=checked]:opacity-100',
                                )}
                            >
                                <Check className="size-2.5 text-primary-foreground" />
                            </span>
                        </RadioGroupPrimitive.Item>
                    );
                })}
            </RadioGroupPrimitive.Root>

            {unavailable.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {t('payments.providers.soonNote', {
                        brands: fmt.list(unavailable.map((b) => b.name)),
                    })}
                </p>
            )}
        </div>
    );
}
