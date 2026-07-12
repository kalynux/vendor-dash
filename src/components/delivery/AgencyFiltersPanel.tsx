import { Truck, Warehouse, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgencyFilters } from '@/components/delivery/agencyFilters';

export interface AgencyFiltersPanelProps {
    filters: AgencyFilters;
    onChange: (key: keyof AgencyFilters, value: string | boolean) => void;
    onClear: () => void;
}

export function AgencyFiltersPanel({ filters, onChange, onClear }: AgencyFiltersPanelProps) {
    return (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="filter-region" className="text-xs">Region</Label>
                    <Input
                        id="filter-region"
                        placeholder="e.g. Littoral"
                        value={filters.region}
                        onChange={e => onChange('region', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="filter-city" className="text-xs">City</Label>
                    <Input
                        id="filter-city"
                        placeholder="e.g. Douala"
                        value={filters.hq_city}
                        onChange={e => onChange('hq_city', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Returns payer</Label>
                    <Select
                        value={filters.returns_payer}
                        onValueChange={v => onChange('returns_payer', v === '_all' ? '' : v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">Any</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="agency">Agency</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="filter-claim" className="text-xs">Min. claim window (days)</Label>
                    <Input
                        id="filter-claim"
                        type="number"
                        min={0}
                        placeholder="e.g. 7"
                        value={filters.min_claim_deadline_days}
                        onChange={e => onChange('min_claim_deadline_days', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        id="filter-storage"
                        checked={filters.storage_based}
                        onCheckedChange={v => onChange('storage_based', !!v)}
                    />
                    <span className="text-xs flex items-center gap-1">
                        <Warehouse className="w-3 h-3" /> Storage-based
                    </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        id="filter-pickup"
                        checked={filters.pickup_based}
                        onCheckedChange={v => onChange('pickup_based', !!v)}
                    />
                    <span className="text-xs flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Pickup-based
                    </span>
                </label>
            </div>

            <button
                type="button"
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
                <X className="w-3 h-3" />
                Clear filters
            </button>
        </div>
    );
}
