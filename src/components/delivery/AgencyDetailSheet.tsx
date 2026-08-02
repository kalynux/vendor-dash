import type { ReactNode } from 'react';
import {
    AlertCircle, Building2, RotateCcw, Shield, ShieldCheck, Truck, Warehouse,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatAgencyAddressDetail, formatAgencyLocality } from '@/lib/agencyAddress';
import { fileRefUrl } from '@/services/files.service';
import type { VendorAgencyListItemDto } from '@/types/product.types';

function PolicyRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            <span className="text-xs font-medium text-right">{value}</span>
        </div>
    );
}

export interface AgencyDetailSheetProps {
    agency: VendorAgencyListItemDto | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Primary action(s) rendered in the sheet's sticky footer (e.g. a "Select" or connection-request button). */
    footerSlot?: ReactNode;
}

export function AgencyDetailSheet({ agency, open, onOpenChange, footerSlot }: AgencyDetailSheetProps) {
    if (!agency) return null;

    const hq = agency.headquartersAddress;
    const p = agency.policies;
    const logoUrl = fileRefUrl(agency.logo);

    const returnsPayer: Record<string, string> = {
        vendor: 'Vendor bears cost',
        agency: 'Agency bears cost',
        customer: 'Customer bears cost',
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="max-h-[85vh] flex flex-col rounded-t-2xl px-0 pb-0"
            >
                <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />

                <SheetHeader className="px-5 pb-2 flex-shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={agency.agencyName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Building2 className="w-7 h-7 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <SheetTitle className="text-base leading-tight">{agency.agencyName}</SheetTitle>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {agency.kycVerified ? (
                                    <Badge variant="secondary" className="gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
                                        <ShieldCheck className="w-3 h-3" />
                                        KYC Verified
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="gap-1 text-xs font-medium text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800">
                                        <Shield className="w-3 h-3" />
                                        Unverified
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <Separator className="flex-shrink-0" />

                <ScrollArea className="flex-1 overflow-hidden">
                    <div className="px-5 py-4 space-y-5">
                        {hq && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Headquarters
                                </h3>
                                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                    <p className="text-sm font-medium">{formatAgencyLocality(hq)}</p>
                                    {formatAgencyAddressDetail(hq) && (
                                        <p className="text-xs text-muted-foreground">{formatAgencyAddressDetail(hq)}</p>
                                    )}
                                </div>
                            </section>
                        )}

                        {agency.coverageAreas.length > 0 && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Coverage Areas
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {agency.coverageAreas.map((area) => (
                                        <Badge key={area} variant="secondary" className="text-xs capitalize">
                                            {area}
                                        </Badge>
                                    ))}
                                </div>
                            </section>
                        )}

                        {p && (
                            <>
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Pricing
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Storage-based"
                                            value={
                                                <span className={cn('flex items-center gap-1', p.pricing.storage_based_enabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                                                    <Warehouse className="w-3 h-3" />
                                                    {p.pricing.storage_based_enabled ? 'Available' : 'Not available'}
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Pickup-based"
                                            value={
                                                <span className={cn('flex items-center gap-1', p.pricing.pickup_based_enabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                                                    <Truck className="w-3 h-3" />
                                                    {p.pricing.pickup_based_enabled ? 'Available' : 'Not available'}
                                                </span>
                                            }
                                        />
                                        {p.pricing.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.pricing.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Returns
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Cost paid by"
                                            value={
                                                <span className="flex items-center gap-1">
                                                    <RotateCcw className="w-3 h-3" />
                                                    {returnsPayer[p.returns.payer] ?? p.returns.payer}
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Return window"
                                            value={
                                                p.returns.return_window_days === 0
                                                    ? 'No returns accepted'
                                                    : `${p.returns.return_window_days} days after delivery`
                                            }
                                        />
                                        {p.returns.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.returns.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Damage Claims
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Claim deadline"
                                            value={
                                                <span className="flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {p.damage.claim_deadline_days} days after delivery
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Max refund per item"
                                            value={`${p.damage.max_refund_per_item.toLocaleString()} XAF`}
                                        />
                                        {p.damage.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.damage.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </ScrollArea>

                {footerSlot && (
                    <div className="px-5 py-4 border-t flex-shrink-0">
                        {footerSlot}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
