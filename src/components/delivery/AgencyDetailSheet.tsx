import type { ReactNode } from 'react';
import { Building2, FileText } from 'lucide-react';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatAgencyAddressDetail, formatAgencyLocality } from '@/lib/agencyAddress';
import { fileRefUrl } from '@/services/files.service';
import { useTranslation, useFormatters, type TranslationKey } from '@/i18n';
import type { VendorAgencyListItemDto } from '@/types/product.types';

/** Just the party: the row's label already says "Cost paid by". */
const RETURNS_PAYER_KEYS: Record<string, TranslationKey> = {
    vendor: 'agency.detail.payer.vendor',
    agency: 'agency.detail.payer.agency',
    customer: 'agency.detail.payer.customer',
};

const INSPECTOR_KEYS: Record<string, TranslationKey> = {
    agency: 'agency.detail.inspector.agency',
    vendor: 'agency.detail.inspector.vendor',
    admin: 'agency.detail.inspector.admin',
};

/** One flat block of the terms. Hairlines between blocks come from the parent's `divide-y`. */
function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="py-4">
            <h3 className="mb-1 text-sm font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium tabular-nums">{value}</span>
        </div>
    );
}

/** The agency's own words for a section. Shown as written, under the figures it qualifies. */
function Note({ children }: { children: ReactNode }) {
    return <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{children}</p>;
}

export interface AgencyDetailSheetProps {
    agency: VendorAgencyListItemDto | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Primary action(s) rendered in the sheet's sticky footer (e.g. a "Select" or connection-request button). */
    footerSlot?: ReactNode;
}

/**
 * A bottom sheet on a phone, a centred window from `md` up. It used to be the
 * bottom sheet everywhere, which on a desktop slid a tall strip up from the
 * bottom edge of a wide screen.
 *
 * Everything an agency will hold a vendor to, read before the vendor asks to
 * connect — the request IS the vendor accepting these terms, so nothing the
 * agency charges or limits is left off. Fields that arrived on 2026-10-03 are
 * optional on the type and their rows simply drop out against an older server.
 */
export function AgencyDetailSheet({ agency, open, onOpenChange, footerSlot }: AgencyDetailSheetProps) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const isMobile = useIsMobile();
    if (!agency) return null;

    const hq = agency.headquartersAddress;
    const p = agency.policies;
    const logoUrl = fileRefUrl(agency.logo);
    const hqDetail = hq ? formatAgencyAddressDetail(hq) : null;
    /** A zero fee is a real answer, and "Free" says it better than "FCFA 0". */
    const money = (amount: number) => (amount === 0 ? t('agency.detail.free') : fmt.currency(amount));

    const pickup = p?.pricing.pickup_based;
    const storage = p?.pricing.storage_based;
    const fees = p?.pricing.additional_fees;
    const documents = p?.documents ?? [];

    const logo = (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
        </div>
    );
    const titleContent = (
        <>
            <span className="truncate">{agency.agencyName}</span>
            {agency.kycVerified && <VerifiedBadge kind="agency" />}
        </>
    );
    // Verified shows as the check beside the name; only the missing check is
    // worth a word of its own.
    const subtitle = [hq ? formatAgencyLocality(hq) : null, agency.kycVerified ? null : t('agency.detail.unverified')]
        .filter(Boolean)
        .join(' · ');
    const headerClass = 'flex-shrink-0 flex-row items-center gap-3 border-b px-4 pb-4 pr-12 text-left';
    const titleClass = 'flex items-center gap-1 text-base leading-tight';
    const subtitleClass = 'mt-0.5 truncate text-sm';

    const body = (
        <>
                {/* Native scrolling, not Radix's ScrollArea: that one keeps its
                    viewport at `overflow: hidden` until a scrollbar mounts, which
                    never happens on a touch screen — the lower sections could not
                    be reached on a phone at all. */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                    <div className="divide-y">
                        {(hq || agency.coverageAreas.length > 0) && (
                            <Section title={t('agency.detail.deliversTo')}>
                                {agency.coverageAreas.length > 0 && (
                                    <p className="text-sm capitalize">{agency.coverageAreas.join(', ')}</p>
                                )}
                                {hq && (
                                    <p className="mt-1.5 text-sm text-muted-foreground">
                                        {t('agency.detail.headquarters')}: {formatAgencyLocality(hq)}
                                        {hqDetail && <> — {hqDetail}</>}
                                    </p>
                                )}
                            </Section>
                        )}

                        {p && (
                            <>
                                <Section title={t('agency.detail.pickupTitle')}>
                                    {!p.pricing.pickup_based_enabled ? (
                                        <p className="text-sm text-muted-foreground">{t('agency.detail.notOffered')}</p>
                                    ) : pickup ? (
                                        <>
                                            <Row label={t('agency.detail.firstKg')} value={money(pickup.base_rate_first_kg)} />
                                            <Row label={t('agency.detail.extraKg')} value={money(pickup.additional_per_kg)} />
                                            <Row label={t('agency.detail.outOfRegionSurcharge')} value={money(pickup.out_of_region_surcharge)} />
                                        </>
                                    ) : (
                                        <p className="text-sm">{t('agency.detail.available')}</p>
                                    )}
                                </Section>

                                <Section title={t('agency.detail.storageTitle')}>
                                    {!p.pricing.storage_based_enabled ? (
                                        <p className="text-sm text-muted-foreground">{t('agency.detail.notOffered')}</p>
                                    ) : storage ? (
                                        <>
                                            <Row label={t('agency.detail.storagePerProduct')} value={money(storage.monthly_storage_fee_per_sku)} />
                                            <Row label={t('agency.detail.pickPack')} value={money(storage.pick_pack_fee_per_order)} />
                                            <Row label={t('agency.detail.localDelivery')} value={money(storage.local_delivery_fee)} />
                                            <Row label={t('agency.detail.outOfRegionDelivery')} value={money(storage.out_of_region_delivery_fee)} />
                                        </>
                                    ) : (
                                        <p className="text-sm">{t('agency.detail.available')}</p>
                                    )}
                                </Section>

                                {/* 2026-10-03 — absent on older servers, so each row shows only when sent. */}
                                {(p.pricing.max_fee_per_shipment !== undefined || p.pricing.accepts_cash_delivery_fee !== undefined) && (
                                    <Section title={t('agency.detail.deliveryFeeTitle')}>
                                        {p.pricing.max_fee_per_shipment !== undefined && (
                                            <Row
                                                label={t('agency.detail.maxFeePerParcel')}
                                                value={p.pricing.max_fee_per_shipment === null ? t('agency.detail.noLimit') : fmt.currency(p.pricing.max_fee_per_shipment)}
                                            />
                                        )}
                                        {p.pricing.accepts_cash_delivery_fee !== undefined && (
                                            <Row
                                                label={t('agency.detail.cashDeliveryFee')}
                                                value={t(p.pricing.accepts_cash_delivery_fee ? 'agency.detail.codAccepted' : 'agency.detail.codNotAccepted')}
                                            />
                                        )}
                                    </Section>
                                )}

                                {(fees || p.pricing.notes) && (
                                    <Section title={t('agency.detail.otherFees')}>
                                        {fees && (
                                            <>
                                                <Row
                                                    label={t('agency.detail.codFee')}
                                                    value={
                                                        fees.cod_handling_fee.type === 'percentage'
                                                            ? t('agency.detail.codFeePercent', { value: fmt.percent(fees.cod_handling_fee.value, Number.isInteger(fees.cod_handling_fee.value) ? 0 : 1) })
                                                            : money(fees.cod_handling_fee.value)
                                                    }
                                                />
                                                <Row label={t('agency.detail.failedDelivery')} value={money(fees.failed_delivery_fee)} />
                                                <Row label={t('agency.detail.returnToSender')} value={money(fees.rto_fee)} />
                                                {fees.peak_season_surcharge > 0 && (
                                                    <Row label={t('agency.detail.peakSeason')} value={money(fees.peak_season_surcharge)} />
                                                )}
                                            </>
                                        )}
                                        {p.pricing.notes && <Note>{p.pricing.notes}</Note>}
                                    </Section>
                                )}

                                {p.cod && (
                                    <Section title={t('agency.detail.supportsCod')}>
                                        <p className="py-1.5 text-sm">
                                            {p.cod.enabled ? t('agency.detail.codAccepted') : t('agency.detail.codNotAccepted')}
                                        </p>
                                        {p.cod.enabled && (
                                            <Row
                                                label={t('agency.detail.codMaxOrder')}
                                                value={p.cod.max_order_amount == null ? t('agency.detail.noLimit') : fmt.currency(p.cod.max_order_amount)}
                                            />
                                        )}
                                    </Section>
                                )}

                                <Section title={t('agency.detail.returns')}>
                                    <Row
                                        label={t('agency.detail.returnWindow')}
                                        value={
                                            p.returns.return_window_days === 0
                                                ? t('agency.detail.noReturns')
                                                : t('agency.detail.returnWindowDays', { count: p.returns.return_window_days })
                                        }
                                    />
                                    <Row
                                        label={t('agency.detail.costPaidBy')}
                                        value={RETURNS_PAYER_KEYS[p.returns.payer] ? t(RETURNS_PAYER_KEYS[p.returns.payer]) : p.returns.payer}
                                    />
                                    {p.returns.handling_fee != null && (
                                        <Row label={t('agency.detail.handlingFee')} value={money(p.returns.handling_fee)} />
                                    )}
                                    {p.returns.notes && <Note>{p.returns.notes}</Note>}
                                </Section>

                                <Section title={t('agency.detail.damageClaims')}>
                                    <Row
                                        label={t('agency.detail.claimDeadline')}
                                        value={t('agency.detail.claimDeadlineDays', { count: p.damage.claim_deadline_days })}
                                    />
                                    <Row label={t('agency.detail.maxRefundPerItem')} value={fmt.currency(p.damage.max_refund_per_item)} />
                                    {p.damage.inspector && INSPECTOR_KEYS[p.damage.inspector] && (
                                        <Row label={t('agency.detail.checkedBy')} value={t(INSPECTOR_KEYS[p.damage.inspector])} />
                                    )}
                                    {p.damage.investigation_fee != null && (
                                        <Row label={t('agency.detail.investigationFee')} value={money(p.damage.investigation_fee)} />
                                    )}
                                    {p.damage.notes && <Note>{p.damage.notes}</Note>}
                                </Section>

                                {documents.length > 0 && (
                                    <Section title={t('agency.detail.documents')}>
                                        {documents.map((url, i) => (
                                            <a
                                                key={url}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
                                            >
                                                <FileText className="h-4 w-4 flex-shrink-0" />
                                                {t('agency.detail.documentN', { n: i + 1 })}
                                            </a>
                                        ))}
                                    </Section>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {footerSlot && (
                    <div className="flex flex-shrink-0 justify-end border-t px-4 py-3">
                        {footerSlot}
                    </div>
                )}
        </>
    );

    if (!isMobile) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className={`${headerClass} pt-4`}>
                        {logo}
                        <div className="min-w-0">
                            <DialogTitle className={titleClass}>{titleContent}</DialogTitle>
                            <DialogDescription className={subtitleClass}>{subtitle}</DialogDescription>
                        </div>
                    </DialogHeader>
                    {body}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="h-[85dvh] gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
            >
                <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />

                <SheetHeader className={`${headerClass} pt-2`}>
                    {logo}
                    <div className="min-w-0">
                        <SheetTitle className={titleClass}>{titleContent}</SheetTitle>
                        <SheetDescription className={subtitleClass}>{subtitle}</SheetDescription>
                    </div>
                </SheetHeader>

                {body}
            </SheetContent>
        </Sheet>
    );
}
