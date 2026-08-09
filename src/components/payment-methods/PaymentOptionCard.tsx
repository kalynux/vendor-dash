import type { ReactNode } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The big, obvious "how do you want to pay?" tile.
 *
 * Built on Radix's RadioGroup rather than a row of `<button>`s: that is what
 * gives arrow-key navigation, a single tab stop for the whole group, roving
 * focus, and correct `role="radio"`/`aria-checked` semantics for free — all of
 * which the hand-rolled chip rows this replaces were missing.
 */

export interface PaymentOptionCardProps {
    value: string;
    title: string;
    description?: ReactNode;
    /** The mark shown at the leading edge — a brand logo or an icon tile. */
    visual: ReactNode;
    /** Secondary row under the description, e.g. a strip of accepted brands. */
    footer?: ReactNode;
    /** Small pill at the trailing edge of the title row (e.g. a currency). */
    badge?: ReactNode;
    /**
     * `row` (default) is the full-width list shape. `stacked` puts the visual and
     * the tick on their own top line with the copy underneath, so several cards
     * fit abreast in a narrow grid without the text being squeezed to a column.
     */
    orientation?: 'row' | 'stacked';
    disabled?: boolean;
    className?: string;
}

export function PaymentOptionCard({
    value,
    title,
    description,
    visual,
    footer,
    badge,
    orientation = 'row',
    disabled,
    className,
}: PaymentOptionCardProps) {
    const stacked = orientation === 'stacked';

    // Selection is already carried by `aria-checked` on the item, so the tick is
    // decorative — it must not be announced a second time.
    const tick = (
        <span
            aria-hidden
            className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                'border-muted-foreground/35',
                'group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary',
            )}
        >
            <Check className="size-3 text-primary-foreground opacity-0 transition-opacity group-data-[state=checked]:opacity-100" />
        </span>
    );

    const copy = (
        <span className={cn('min-w-0', stacked ? 'w-full' : 'flex-1')}>
            <span className="flex items-center gap-1.5">
                <span
                    className={cn(
                        'text-sm font-semibold text-foreground group-data-[state=checked]:text-primary',
                        stacked ? 'min-w-0 break-words' : 'truncate',
                    )}
                >
                    {title}
                </span>
                {badge}
            </span>
            {description && (
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {description}
                </span>
            )}
            {footer && <span className="mt-2 flex flex-wrap items-center gap-1">{footer}</span>}
        </span>
    );

    return (
        <RadioGroupPrimitive.Item
            value={value}
            disabled={disabled}
            className={cn(
                'group relative flex w-full rounded-xl border-2 p-3 text-left',
                stacked ? 'flex-col items-start gap-2' : 'items-center gap-3',
                'transition-[border-color,background-color,box-shadow,transform] duration-200',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'border-border bg-card',
                'enabled:hover:border-primary/50 enabled:hover:bg-accent/40',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:shadow-sm',
                'disabled:cursor-not-allowed disabled:opacity-55',
                'motion-safe:enabled:active:scale-[0.99]',
                className,
            )}
        >
            {stacked ? (
                <>
                    <span className="flex w-full items-center justify-between gap-2">
                        <span className="shrink-0">{visual}</span>
                        {tick}
                    </span>
                    {copy}
                </>
            ) : (
                <>
                    <span className="shrink-0">{visual}</span>
                    {copy}
                    {tick}
                </>
            )}
        </RadioGroupPrimitive.Item>
    );
}

/**
 * The default `visual` for a category that has no single brand mark of its own.
 * Only meaningful inside a `PaymentOptionCard` — it fills in on selection from
 * the card's `group` state.
 */
export function PaymentOptionIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-10 items-center justify-center rounded-lg transition-colors duration-200',
                'bg-muted text-muted-foreground',
                'group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground',
            )}
        >
            <Icon className="size-5" />
        </span>
    );
}

/**
 * The group wrapper. Kept next to the card so both stay on the same primitive —
 * a `PaymentOptionCard` outside one would silently lose its radio semantics.
 */
export function PaymentOptionGroup({
    value,
    onValueChange,
    disabled,
    className,
    children,
    ...props
}: RadioGroupPrimitive.RadioGroupProps) {
    return (
        <RadioGroupPrimitive.Root
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            className={cn('grid gap-2.5', className)}
            {...props}
        >
            {children}
        </RadioGroupPrimitive.Root>
    );
}
