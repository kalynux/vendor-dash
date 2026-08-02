import type { ReactNode } from 'react';
import { Building2, Check, Info, MapPin, ShieldCheck, Truck, Warehouse } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatAgencyLocality } from '@/lib/agencyAddress';
import { fileRefUrl } from '@/services/files.service';
import type { VendorAgencyListItemDto } from '@/types/product.types';

export interface AgencyCardProps {
    agency: VendorAgencyListItemDto;
    /** Selection state — only meaningful when `onSelect` is provided (radio-style pickers). */
    selected?: boolean;
    /** When provided, the whole card body is clickable and acts as a single-select radio item. */
    onSelect?: () => void;
    onInfo?: () => void;
    /** Custom content (e.g. connection-status action buttons) rendered at the right of the card. */
    rightSlot?: ReactNode;
}

/** Presentational agency card — logo, name, KYC badge, HQ, coverage chips. */
export function AgencyCard({ agency, selected = false, onSelect, onInfo, rightSlot }: AgencyCardProps) {
    const hq = agency.headquartersAddress;
    const p = agency.policies;
    const logoUrl = fileRefUrl(agency.logo);

    const body = (
        <div className="flex items-start gap-3">
            <div
                className={cn(
                    'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden',
                    selected ? 'bg-primary/10' : 'bg-muted',
                )}
            >
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={agency.agencyName}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Building2
                        className={cn('w-5 h-5', selected ? 'text-primary' : 'text-muted-foreground')}
                    />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm truncate">{agency.agencyName}</p>
                    {agency.kycVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-label="KYC Verified" />
                    )}
                    {onSelect && selected && (
                        <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-auto">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                    )}
                </div>

                {hq && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{formatAgencyLocality(hq)}</span>
                    </p>
                )}

                {p && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {p.pricing.storage_based_enabled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <Warehouse className="w-2.5 h-2.5" />
                                Storage
                            </span>
                        )}
                        {p.pricing.pickup_based_enabled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <Truck className="w-2.5 h-2.5" />
                                Pickup
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div
            className={cn(
                'rounded-xl border-2 overflow-hidden transition-all duration-200',
                selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
            )}
        >
            {/* Below `md` the actions drop to their own row under the body. Side-by-side
                they need ~150px of fixed width ("Approve"+"Reject", "Set as default"),
                which a phone-width card can't spare — they used to be pushed out of the
                card and clipped, taking the info button with them. */}
            <div className="flex flex-col md:flex-row md:items-stretch">
                {onSelect ? (
                    <button
                        type="button"
                        onClick={onSelect}
                        aria-pressed={selected}
                        className="flex-1 p-4 text-left min-w-0 hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                        {body}
                    </button>
                ) : (
                    <div className="flex-1 p-4 min-w-0">{body}</div>
                )}

                {(rightSlot || onInfo) && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0 border-t border-border/60 px-4 py-2.5 md:flex-nowrap md:items-stretch md:gap-0 md:border-t-0 md:px-0 md:py-0">
                        {rightSlot && (
                            <div className="flex items-center justify-center gap-1.5 md:border-l md:border-border/60 md:px-3">
                                {rightSlot}
                            </div>
                        )}

                        {onInfo && (
                            <button
                                type="button"
                                onClick={onInfo}
                                aria-label={`View details for ${agency.agencyName}`}
                                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:h-auto md:w-12 md:rounded-none md:border-l md:border-border/60"
                            >
                                <Info className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function AgencyCardSkeleton() {
    return (
        <div className="rounded-xl border p-4 flex items-center gap-3">
            <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
            </div>
        </div>
    );
}
