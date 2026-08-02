import { Truck, Warehouse } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    FilterChips,
    FilterField,
    FilterMultiChips,
    FilterSection,
} from '@/components/filters';
import type { AgencyFilters } from '@/components/delivery/agencyFilters';

export interface AgencyFiltersPanelProps {
    filters: AgencyFilters;
    onChange: (key: keyof AgencyFilters, value: string | boolean) => void;
}

type Capability = 'storage_based' | 'pickup_based';

const CAPABILITIES: { value: Capability; label: string; icon: React.ReactNode }[] = [
    { value: 'storage_based', label: 'Storage-based', icon: <Warehouse className="h-3.5 w-3.5" /> },
    { value: 'pickup_based', label: 'Pickup-based', icon: <Truck className="h-3.5 w-3.5" /> },
];

const RETURNS_PAYERS: { value: 'vendor' | 'agency' | 'customer'; label: string }[] = [
    { value: 'vendor', label: 'Vendor' },
    { value: 'agency', label: 'Agency' },
    { value: 'customer', label: 'Customer' },
];

/** Body of the agency filter sheet — the sheet itself supplies the shell and actions. */
export function AgencyFiltersPanel({ filters, onChange }: AgencyFiltersPanelProps) {
    const activeCapabilities = CAPABILITIES.filter((c) => filters[c.value]).map((c) => c.value);

    return (
        <>
            <FilterSection title="Location">
                <div className="grid grid-cols-2 gap-3">
                    <FilterField label="Region" htmlFor="filter-region">
                        <Input
                            id="filter-region"
                            placeholder="e.g. Littoral"
                            value={filters.region}
                            onChange={(e) => onChange('region', e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </FilterField>
                    <FilterField label="City" htmlFor="filter-city">
                        <Input
                            id="filter-city"
                            placeholder="e.g. Douala"
                            value={filters.hq_city}
                            onChange={(e) => onChange('hq_city', e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </FilterField>
                </div>
            </FilterSection>

            <FilterSection title="Capabilities">
                <FilterMultiChips
                    options={CAPABILITIES}
                    values={activeCapabilities}
                    onToggle={(v) => onChange(v, !filters[v])}
                />
            </FilterSection>

            <FilterSection title="Returns paid by">
                <FilterChips
                    options={RETURNS_PAYERS}
                    value={filters.returns_payer || undefined}
                    onChange={(v) => onChange('returns_payer', v ?? '')}
                    allLabel="Any"
                />
            </FilterSection>

            <FilterSection title="Claim window">
                <FilterField label="Minimum days to claim" htmlFor="filter-claim">
                    <Input
                        id="filter-claim"
                        type="number"
                        min={0}
                        placeholder="e.g. 7"
                        value={filters.min_claim_deadline_days}
                        onChange={(e) => onChange('min_claim_deadline_days', e.target.value)}
                        className="h-11 rounded-xl"
                    />
                </FilterField>
            </FilterSection>
        </>
    );
}
