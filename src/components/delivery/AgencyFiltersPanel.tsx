import { Truck, Warehouse } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    FilterChips,
    FilterField,
    FilterMultiChips,
    FilterSection,
} from '@/components/filters';
import type { AgencyFilters } from '@/components/delivery/agencyFilters';
import { useTranslation, type TranslationKey } from '@/i18n';

export interface AgencyFiltersPanelProps {
    filters: AgencyFilters;
    onChange: (key: keyof AgencyFilters, value: string | boolean) => void;
}

type Capability = 'storage_based' | 'pickup_based';

const CAPABILITIES: { value: Capability; labelKey: TranslationKey; icon: React.ReactNode }[] = [
    { value: 'storage_based', labelKey: 'agency.detail.storageBased', icon: <Warehouse className="h-3.5 w-3.5" /> },
    { value: 'pickup_based', labelKey: 'agency.detail.pickupBased', icon: <Truck className="h-3.5 w-3.5" /> },
];

const RETURNS_PAYERS: { value: 'vendor' | 'agency' | 'customer'; labelKey: TranslationKey }[] = [
    { value: 'vendor', labelKey: 'agency.payerShort.vendor' },
    { value: 'agency', labelKey: 'agency.payerShort.agency' },
    { value: 'customer', labelKey: 'agency.payerShort.customer' },
];

/** Body of the agency filter sheet — the sheet itself supplies the shell and actions. */
export function AgencyFiltersPanel({ filters, onChange }: AgencyFiltersPanelProps) {
    const { t } = useTranslation();
    const activeCapabilities = CAPABILITIES.filter((c) => filters[c.value]).map((c) => c.value);

    return (
        <>
            <FilterSection title={t('agency.filters.location')}>
                <div className="grid grid-cols-2 gap-3">
                    <FilterField label={t('agency.filters.region')} htmlFor="filter-region">
                        <Input
                            id="filter-region"
                            placeholder={t('agency.filters.regionPlaceholder')}
                            value={filters.region}
                            onChange={(e) => onChange('region', e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </FilterField>
                    <FilterField label={t('agency.filters.city')} htmlFor="filter-city">
                        <Input
                            id="filter-city"
                            placeholder={t('agency.filters.cityPlaceholder')}
                            value={filters.hq_city}
                            onChange={(e) => onChange('hq_city', e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </FilterField>
                </div>
            </FilterSection>

            <FilterSection title={t('agency.filters.capabilities')}>
                <FilterMultiChips
                    options={CAPABILITIES}
                    values={activeCapabilities}
                    onToggle={(v) => onChange(v, !filters[v])}
                />
            </FilterSection>

            <FilterSection title={t('agency.filters.returnsPayer')}>
                <FilterChips
                    options={RETURNS_PAYERS}
                    value={filters.returns_payer || undefined}
                    onChange={(v) => onChange('returns_payer', v ?? '')}
                    allLabel={t('agency.filters.anyPayer')}
                />
            </FilterSection>

            <FilterSection title={t('agency.filters.claimWindow')}>
                <FilterField label={t('agency.filters.minClaimDays')} htmlFor="filter-claim">
                    <Input
                        id="filter-claim"
                        type="number"
                        min={0}
                        placeholder={t('agency.filters.claimDaysPlaceholder')}
                        value={filters.min_claim_deadline_days}
                        onChange={(e) => onChange('min_claim_deadline_days', e.target.value)}
                        className="h-11 rounded-xl"
                    />
                </FilterField>
            </FilterSection>
        </>
    );
}
