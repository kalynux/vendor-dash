import { useState } from 'react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { brandLabel, type PaymentBrand } from './paymentBrands';

/**
 * A brand mark on a white plate.
 *
 * The plate stays white in dark mode on purpose: these are third-party marks
 * drawn for light backgrounds (MTN's yellow, Visa's navy), and tinting the
 * surface behind them is both illegible and a trademark problem. The ring keeps
 * the plate from floating on a light card.
 */

export type PaymentBrandLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<PaymentBrandLogoSize, string> = {
    xs: 'size-6 rounded-[6px] p-0.5',
    sm: 'size-8 rounded-md p-1',
    md: 'size-10 rounded-lg p-1.5',
    lg: 'size-12 rounded-xl p-1.5',
};

const ICON_SIZES: Record<PaymentBrandLogoSize, string> = {
    xs: 'size-3.5',
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
};

export interface PaymentBrandLogoProps {
    brand: PaymentBrand;
    size?: PaymentBrandLogoSize;
    /**
     * Hide from assistive tech. Use when the brand is already named in adjacent
     * text — the default is a real `alt`, which is right for a bare logo row.
     */
    decorative?: boolean;
    className?: string;
}

export function PaymentBrandLogo({
    brand,
    size = 'md',
    decorative = false,
    className,
}: PaymentBrandLogoProps) {
    const { t } = useTranslation();
    // A logo that 404s must not leave an empty plate — fall back to the icon.
    const [failed, setFailed] = useState(false);
    const label = brandLabel(brand, t);
    const Icon = brand.icon;

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/[0.08] dark:ring-white/15',
                SIZES[size],
                className,
            )}
        >
            {brand.logo && !failed ? (
                <img
                    src={brand.logo}
                    alt={decorative ? '' : label}
                    aria-hidden={decorative || undefined}
                    // Every one of these sits behind a dialog or an accordion, so
                    // deferring the fetch until it is actually laid out is free.
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onError={() => setFailed(true)}
                    className="size-full object-contain"
                />
            ) : (
                <Icon
                    className={cn('text-muted-foreground', ICON_SIZES[size])}
                    aria-hidden={decorative || undefined}
                    aria-label={decorative ? undefined : label}
                    role={decorative ? undefined : 'img'}
                />
            )}
        </span>
    );
}
